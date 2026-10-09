import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ts from 'typescript';
import { isValidElement, Suspense } from 'react';
import { matchRoutes, Navigate } from 'react-router-dom';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const transpile = source => ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText.replace(/(['"])(react|react-router-dom|react\/jsx-runtime)\1/g,
  (_, _quote, dependency) => JSON.stringify(import.meta.resolve(dependency)));

// Test the real route declarations, router matching and content guard. Only
// page bodies are replaced so the test never loads browser APIs or starts HTTP.
const [stateSource, guardSource, configSource] = await Promise.all([
  readFile(new URL('../src/lib/routeState.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/ContentRoute.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/routeConfig.tsx', import.meta.url), 'utf8'),
]);
const stateUrl = moduleUrl(transpile(stateSource));
const pageUrl = moduleUrl('export default function FixturePage() { return null; }');
const guardUrl = moduleUrl(transpile(guardSource)
  .replace(/(['"])\.\.\/lib\/routeState\1/g, JSON.stringify(stateUrl))
  .replace(/(['"])\.\.\/pages\/NotFound\1/g, JSON.stringify(pageUrl)));
const configUrl = moduleUrl(transpile(configSource)
  .replace(/(['"])\.\/components\/ContentRoute\1/g, JSON.stringify(guardUrl))
  .replace(/(['"])\.\/pages\/[^'"]+\1/g, JSON.stringify(pageUrl)));
const [{ appRouteConfig }, { default: ContentRoute }, { validContentParams, isNotFoundRoute, isMissingContent }] =
  await Promise.all([import(configUrl), import(guardUrl), import(stateUrl)]);
const id = '0123456789abcdef01234567';

function matchesFor(location) {
  const matches = matchRoutes(appRouteConfig, location);
  assert.ok(matches, `The app must have a matching route for ${JSON.stringify(location)}`);
  return matches;
}
const leafFor = location => matchesFor(location).at(-1);

// These are the user-facing fallback cases, including paths whose prefixes are
// valid business routes but whose complete paths are not declared.
test('unknown paths select the shared 404 shell, including unknown admin children', () => {
  for (const pathname of ['/abc', '/hello/world', '/news/extra/segment', '/auth/extra',
    '/admin/unknown', '/admin/members/extra', '/functions/unknown']) {
    const matches = matchesFor(pathname);
    assert.equal(matches.at(-1).route.path, '*', pathname);
    assert.equal(isNotFoundRoute(matches), true, pathname);
  }
  assert.equal(isNotFoundRoute(null), true);
});

test('malformed content IDs are 404 routes before any detail page mounts', () => {
  for (const pathname of ['/news/not-exist-page', '/article/not-exist-page', '/event/not-exist-page',
    '/resource/not-exist-page', '/past-events/not-exist-page', '/comments/news/not-exist-page',
    `/news/${id.slice(1)}`, `/news/${id}0`, `/news/${'g'.repeat(24)}`]) {
    const matches = matchesFor(pathname);
    assert.equal(matches.at(-1).route.handle.contentId, true, pathname);
    assert.equal(matches.at(-1).route.element.type, ContentRoute, pathname);
    assert.equal(isNotFoundRoute(matches), true, pathname);
  }
});

test('all existing public, auth and member pages keep their declared routes', () => {
  for (const pathname of ['/', '/privacy', '/auth', '/settings', '/saved-posts', '/notifications',
    '/debug', '/news', '/announcements', '/events', '/social', '/functions',
    '/functions/random-call', '/quantification', '/fees', '/resources']) {
    const matches = matchesFor(pathname);
    assert.equal(matches.at(-1).route.path, pathname, pathname);
    assert.equal(isNotFoundRoute(matches), false, pathname);
  }
});

test('recognized admin pages retain the admin parent and its authorization boundary', () => {
  for (const segment of ['', 'roster', 'members', 'events', 'news', 'resources', 'gallery',
    'notifications', 'ai', 'quantification', 'fees']) {
    const pathname = segment ? `/admin/${segment}` : '/admin';
    const matches = matchesFor(pathname);
    assert.equal(matches[0].route.path, '/admin', pathname);
    assert.equal(matches.length, 2, pathname);
    assert.equal(isNotFoundRoute(matches), false, pathname);
    if (segment) assert.equal(matches.at(-1).route.path, segment, pathname);
    else assert.equal(matches.at(-1).route.index, true);
  }
});

test('valid database IDs still reach every dynamic business page through its content guard', () => {
  for (const prefix of ['article', 'news', 'event', 'resource', 'past-events']) {
    for (const contentId of [id, id.toUpperCase(), '0'.repeat(24)]) {
      const pathname = `/${prefix}/${contentId}`;
      const matches = matchesFor(pathname);
      assert.equal(matches.at(-1).route.path, `/${prefix}/:id`, pathname);
      assert.equal(matches.at(-1).params.id, contentId, pathname);
      assert.equal(matches.at(-1).route.element.type, ContentRoute, pathname);
      assert.equal(isNotFoundRoute(matches), false, pathname);
    }
  }
});

test('comment routes accept only supported content types with valid IDs', () => {
  for (const type of ['news', 'event', 'resource', 'social']) {
    const pathname = `/comments/${type}/${id}`;
    assert.equal(leafFor(pathname).route.handle.comment, true, pathname);
    assert.equal(isNotFoundRoute(matchesFor(pathname)), false, pathname);
    assert.equal(validContentParams({ type, id }), true, type);
  }
  for (const type of ['unknown', 'announcement', 'NEWS']) {
    const pathname = `/comments/${type}/${id}`;
    assert.equal(isNotFoundRoute(matchesFor(pathname)), true, pathname);
    assert.equal(validContentParams({ type, id }), false, type);
  }
  assert.equal(validContentParams({ id }), true);
  assert.equal(validContentParams({}), false);
});

test('route detection follows router decoding, case and trailing-slash semantics', () => {
  for (const pathname of ['/auth/', '/privacy/', '/NEWS', '/admin/fees/', `/NeWs/${id}/`,
    `/news/${'%61'.repeat(24)}`, `/news/${id}?from=mail#top`]) {
    assert.equal(isNotFoundRoute(matchesFor(pathname)), false, pathname);
  }
  assert.equal(isNotFoundRoute(matchesFor('/hello/world?from=mail#top')), true);
  assert.equal(isNotFoundRoute(matchesFor({ pathname: '/abc', search: '?from=mail', hash: '#top' })), true);
});

test('only an API 404 is missing content; auth, outages and network failures retain error handling', () => {
  assert.equal(isMissingContent({ response: { status: 404, data: { error: 'Not found' } } }), true);
  for (const status of [400, 401, 403, 429, 500, 503]) {
    assert.equal(isMissingContent({ response: { status } }), false, String(status));
  }
  for (const error of [undefined, null, new Error('Network Error'), { code: 'ERR_NETWORK' },
    { status: 404 }, { response: undefined }, { response: { status: '404' } }]) {
    assert.equal(isMissingContent(error), false, String(error));
  }
});


// Exercise the Layout's real search bridge without a browser or live accounts.
// Its hooks receive fixture state; page chrome remains inert React elements.
const layoutFixtureUrl = moduleUrl(`
  let fixture;
  export function setFixture(value) {
    fixture = { ...value, states: [], refs: [], stateIndex: 0, refIndex: 0, navigations: [] };
    return fixture;
  }
  export function nextRender() { fixture.stateIndex = 0; fixture.refIndex = 0; }
  export const useEffect = () => {};
  export const useLayoutEffect = () => {};
  export function useState(initial) {
    const index = fixture.stateIndex++;
    const state = fixture.states[index] ??= { value: initial, calls: [] };
    return [state.value, value => {
      state.value = typeof value === 'function' ? value(state.value) : value;
      state.calls.push(state.value);
    }];
  }
  export function useRef(initial) {
    const index = fixture.refIndex++;
    return fixture.refs[index] ??= { current: initial };
  }
  export const useUser = () => fixture.user;
  export const useAuth = () => fixture.auth;
  export const usePopup = () => ({ showUserProfile: false, openUserProfile() {}, closeUserProfile() {} });
  export const useLocation = () => fixture.location;
  export const useNavigate = () => (to, options) => { fixture.navigations.push({ to, options }); };
  export const document = { activeElement: { id: 'search-opener' } };
`);
const headerUrl = moduleUrl('export default function FixtureHeader() { return null; }');
const dialogUrl = moduleUrl('export const Dialog = () => null; export const DialogContent = () => null; export const DialogTitle = () => null;');
const [layoutSource, contextSource] = await Promise.all([
  readFile(new URL('../src/components/Layout.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/context/searchContextState.ts', import.meta.url), 'utf8'),
]);
const contextUrl = moduleUrl(transpile(contextSource));
function fixtureHooks(source, dependency, mockedNames) {
  return source.replace(new RegExp(`import\\s+\\{([^}]+)\\}\\s+from\\s+(['"])${dependency}\\2;`),
    (_import, specifiers) => {
      const names = specifiers.split(',').map(name => name.trim());
      const mocked = names.filter(name => mockedNames.includes(name));
      const retained = names.filter(name => !mockedNames.includes(name));
      assert.equal(mocked.length, mockedNames.length, `Expected hook imports from ${dependency}`);
      return `import { ${retained.join(', ')} } from '${dependency}';\nimport { ${mocked.join(', ')} } from ${JSON.stringify(layoutFixtureUrl)};`;
    });
}
const layoutWithHookFixtures = fixtureHooks(fixtureHooks(layoutSource, 'react',
  ['useEffect', 'useLayoutEffect', 'useRef', 'useState']), 'react-router-dom', ['useLocation', 'useNavigate']);
const layoutUrl = moduleUrl(transpile(`import { document } from ${JSON.stringify(layoutFixtureUrl)};\n${layoutWithHookFixtures}`)
  .replace(/(['"])\.\.\/context\/(?:userContextState|authContextState|popupContextState)\1/g, JSON.stringify(layoutFixtureUrl))
  .replace(/(['"])\.\.\/context\/searchContextState\1/g, JSON.stringify(contextUrl))
  .replace(/(['"])\.\/SiteHeader\1/g, JSON.stringify(headerUrl))
  .replace(/(['"])\.\/ui\/dialog\1/g, JSON.stringify(dialogUrl))
  .replace(/(['"])\.\/(?:SiteFooter|BottomNavigation|ContentState|SearchDialog|UserProfile)\1/g, JSON.stringify(pageUrl)));
const [{ default: Layout }, { SearchContext }, { default: SiteHeader }, fixtureHooksModule] =
  await Promise.all([import(layoutUrl), import(contextUrl), import(headerUrl), import(layoutFixtureUrl)]);

function findElement(node, predicate) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
  } else if (isValidElement(node)) {
    if (predicate(node)) return node;
    return findElement(node.props.children, predicate);
  }
  return undefined;
}

function layoutFixture(member, location) {
  return fixtureHooksModule.setFixture({
    user: { user: { name: 'Fixture member' }, isAuthenticated: member, isLoading: false },
    auth: { user: member ? { id: 'member' } : null, loading: false },
    location,
  });
}

test('the 404 and Header share the member callback that opens the existing search dialog', () => {
  const fixture = layoutFixture(true, { pathname: '/abc', search: '?from=mail', hash: '#top' });
  const tree = Layout({ children: '404 content', notFound: true });
  assert.equal(tree.type, SearchContext.Provider);
  const header = findElement(tree, element => element.type === SiteHeader);
  assert.ok(header);
  assert.equal(header.props.isAuthenticated, true);
  assert.equal(tree.props.value.openSearch, header.props.onSearch);
  assert.equal(findElement(tree, element => element.type === 'main').props.children, '404 content');

  tree.props.value.openSearch();
  assert.deepEqual(fixture.navigations, []);
  fixtureHooksModule.nextRender();
  const opened = Layout({ children: '404 content', notFound: true });
  const dialog = findElement(opened, element => element.type === Suspense && element.props.children?.props.isOpen === true);
  assert.ok(dialog, 'The existing Layout search dialog must become open');
  assert.equal(dialog.props.children.type.$$typeof, Symbol.for('react.lazy'));
  dialog.props.children.props.onClose();
  fixtureHooksModule.nextRender();
  const closed = Layout({ children: '404 content', notFound: true });
  assert.equal(findElement(closed, element => element.type === Suspense && element.props.children?.props.isOpen === true), undefined);
});

test('guest 404 search preserves the auth return URL while known member pages remain protected', () => {
  const location = { pathname: '/hello/world', search: '?from=mail', hash: '#top' };
  const fixture = layoutFixture(false, location);
  const tree = Layout({ children: '404 content', notFound: true });
  assert.equal(tree.type, SearchContext.Provider);
  assert.ok(findElement(tree, element => element.type === 'div' && element.props.className === 'site-shell'));
  const header = findElement(tree, element => element.type === SiteHeader);
  assert.equal(header.props.isAuthenticated, false);
  assert.equal(tree.props.value.openSearch, header.props.onSearch);
  tree.props.value.openSearch();
  assert.deepEqual(fixture.navigations, [{ to: '/auth', options: { state: { from: '/hello/world?from=mail#top' } } }]);
  assert.equal(fixture.states.some(state => state.calls.includes(true)), false);

  layoutFixture(false, { pathname: '/news', search: '?from=mail', hash: '#top' });
  const protectedPage = Layout({ children: 'private content' });
  assert.equal(protectedPage.type, Navigate);
  assert.equal(protectedPage.props.to, '/auth');
  assert.equal(protectedPage.props.replace, true);
  assert.deepEqual(protectedPage.props.state, { from: '/news?from=mail#top' });
});
