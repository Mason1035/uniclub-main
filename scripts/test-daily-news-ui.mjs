import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ts from 'typescript';
import { isValidElement } from 'react';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const transpile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText.replace(/(['"])(react|react\/jsx-runtime)\1/g,
  (_, _quote, dependency) => JSON.stringify(import.meta.resolve(dependency)));

// Isolate account/API dependencies, while exercising the real component event
// handlers, HTTP helpers, source rendering and homepage query functions.
const fixtureUrl = moduleUrl(`
  export let fixture;
  export function setFixture(options = {}) {
    fixture = { states: (options.states || []).map(value => ({value})), refs: [], stateIndex: 0, refIndex: 0,
      calls: [], notices: [], queryConfigs: [], refetches: 0, ...options };
    fixture.states = (options.states || []).map(value => ({value}));
    return fixture;
  }
  export function nextRender() { fixture.stateIndex = 0; fixture.refIndex = 0; }
  export const useEffect = () => {};
  export function useState(initial) {
    const index = fixture.stateIndex++;
    const state = fixture.states[index] ||= {value: typeof initial === 'function' ? initial() : initial};
    return [state.value, value => { state.value = typeof value === 'function' ? value(state.value) : value; }];
  }
  export function useRef(initial) { return fixture.refs[fixture.refIndex++] ||= {current:initial}; }
  export function useQuery(config) {
    fixture.queryConfigs.push(config);
    return {data: fixture.data, isPending:false, isError:false, isFetching:false,
      async refetch() { fixture.refetches++; return {data:fixture.data}; }};
  }
  const api = {
    async get(url) { fixture.calls.push({method:'get',url}); return {data:fixture.apiResponse || []}; },
    async put(url, body) { fixture.calls.push({method:'put',url,body}); return {data:fixture.data}; },
    async post(url, body) { fixture.calls.push({method:'post',url,body}); return {data:{started:true}}; },
  };
  export default api;
  export const toast = {
    success(message) { fixture.notices.push(message); },
    info(message) { fixture.notices.push(message); },
  };
  export const aiErrorMessage = () => '友好的通用错误';
  export const useLocation = () => ({pathname:'/news',state:{}});
  export const useParams = () => ({id:'0123456789abcdef01234567'});
  export const useNavigate = () => () => {};
  export const useGSAP = () => {};
  export const gsap = {};
  export const useHomeScrollReveal = () => {};
  export const useAuth = () => ({loading:false,user:{id:'member'}});
  export const useUser = () => ({isLoading:false,isAuthenticated:true,user:{uniqueId:'member'}});
  export const listFrom = value => value;
  export const formatDate = value => value || '';
  export const categoryLabel = value => value;
  export const formatBytes = () => '';
  export const transformToEventCard = value => value;
  export const isMissingContent = () => false;
  export function RefreshCw() { return null; }
  ${['AdminButton', 'Badge', 'ErrorState', 'Field', 'LoadingState', 'Modal', 'Panel', 'SelectInput', 'TextInput', 'Link'].map(name => `export function ${name}() { return null; }`).join('\n')}
`);
const inertUrl = moduleUrl('export default function InertPresentation() { return null; }');
const readSource = relative => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
const dailyUrl = moduleUrl(transpile(await readSource('src/pages/admin/ai/dailyNews.ts'))
  .replace(/(['"])(?:@\/lib\/axios|\.\/api)\1/g, JSON.stringify(fixtureUrl)));
const settingsUrl = moduleUrl(transpile((await readSource('src/pages/admin/ai/DailyNewsSettings.tsx'))
  .replace(/import\s+\{([^}]+)\}\s+from\s+'react';/, (_, names) =>
    `import {${names}} from ${JSON.stringify(fixtureUrl)};`))
  .replace(/(['"])(?:@tanstack\/react-query|lucide-react|sonner|\.\.\/components)\1/g, JSON.stringify(fixtureUrl))
  .replace(/(['"])\.\/dailyNews\1/g, JSON.stringify(dailyUrl)));
const articleUrl = moduleUrl(transpile(await readSource('src/pages/ArticlePage.tsx'))
  .replace(/(['"])(?:@tanstack\/react-query|react-router-dom|\.\.\/lib\/(?:axios|contentFormat|routeState))\1/g, JSON.stringify(fixtureUrl))
  .replace(/(['"])(?:\.\.\/components\/[^'"]+|\.\/NotFound)\1/g, JSON.stringify(inertUrl)));
const homeWithHooks = (await readSource('src/pages/Homepage.tsx'))
  .replace(/import \{ lazy, Suspense, useEffect, useRef, useState \} from 'react';/, `import {lazy,Suspense} from 'react'; import {useEffect,useRef,useState} from ${JSON.stringify(fixtureUrl)};`);
const homeUrl = moduleUrl(transpile(homeWithHooks)
  .replace(/^import ['"].*\.css['"];\n/gm, '')
  .replace(/(['"])(?:@tanstack\/react-query|react-router-dom|@\/lib\/gsap|\.\.\/lib\/(?:axios|contentFormat)|\.\.\/utils\/eventTransform|\.\.\/hooks\/useHomeScrollReveal|\.\.\/context\/(?:authContextState|userContextState))\1/g, JSON.stringify(fixtureUrl))
  .replace(/(['"])\.\.\/components\/[^'"]+\1/g, JSON.stringify(inertUrl)));
const [daily, {default:DailyNewsSettings}, {default:ArticlePage}, {default:Homepage}, hooks] =
  await Promise.all([import(dailyUrl), import(settingsUrl), import(articleUrl), import(homeUrl), import(fixtureUrl)]);

function elements(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => elements(child, predicate));
  if (!isValidElement(node)) return [];
  return [...(predicate(node) ? [node] : []), ...['children','footer','actions'].flatMap(key => elements(node.props[key], predicate))];
}
function label(node) {
  if (Array.isArray(node)) return node.map(label).join('');
  if (isValidElement(node)) return label(node.props.children);
  return typeof node === 'string' || typeof node === 'number' ? String(node) : '';
}
const button = (tree, text) => elements(tree, node => node.type === hooks.AdminButton && label(node) === text)[0];
const flush = async () => { for (let count=0; count<12; count++) await Promise.resolve(); };
const config = {enabled:true,time:'19:00',timezone:'Asia/Shanghai',articleCount:2,categories:['ai','technology','software','science','education'],webSearch:true,reasoning:'auto'};
function state(overrides = {}) { return {settings:config,activeDate:null,activeBatchId:null,lastRun:null,nextRun:'2026-10-06T11:00:00Z',history:[],running:false,ai:{configured:true,provider:'deepseek',model:'deepseek-flash'},search:{configured:true,provider:'newsapi'},...overrides}; }
function settingsFixture(data=state(), draft=data.settings) { return hooks.setFixture({data,states:[draft,false,false,false,false,'']}); }

test('settings reject invalid time, amount and empty preferences before any request', async () => {
  for (const draft of [{...config,time:'25:01'},{...config,articleCount:0},{...config,articleCount:2.5},{...config,articleCount:6},{...config,categories:[]}]) {
    const fixture=settingsFixture(state(),draft), tree=DailyNewsSettings();
    elements(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});
    await flush();
    assert.equal(fixture.calls.length,0);
    assert.ok(fixture.states[5].value, 'Validation must be visible to the administrator');
  }
});

test('saved settings use the existing admin API and retain the fixed Shanghai timezone', async () => {
  const fixture=settingsFixture(),tree=DailyNewsSettings();
  elements(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});
  await flush();
  assert.deepEqual(fixture.calls,[{method:'put',url:'/api/admin/ai/daily-news',body:config}]);
  assert.equal(fixture.calls[0].body.timezone,'Asia/Shanghai');
  assert.equal(fixture.refetches,1);
});

test('manual generation requires confirmation, prevents duplicate requests, then polls status', async () => {
  const fixture=settingsFixture();
  button(DailyNewsSettings(),'立即运行一次').props.onClick();
  assert.equal(fixture.calls.length,0);
  hooks.nextRender();
  const tree=DailyNewsSettings(),modal=elements(tree,node=>node.type===hooks.Modal)[0];
  assert.equal(modal.props.open,true);
  assert.equal(modal.props.title,'立即运行每日新闻？');
  const confirmButton=button(tree,'确认运行');
  confirmButton.props.onClick(); confirmButton.props.onClick();
  await flush();
  assert.deepEqual(fixture.calls,[{method:'post',url:'/api/admin/ai/daily-news/run',body:{confirm:true,force:false}}]);
  assert.equal(fixture.refetches,1);
  assert.equal(fixture.queryConfigs[0].refetchInterval({state:{data:{running:true}}}),4000);
});

test('today success warns about replacement and sends force only after confirmation', async () => {
  const today=daily.shanghaiDate(),fixture=settingsFixture(state({activeDate:today}));
  button(DailyNewsSettings(),'立即运行一次').props.onClick(); hooks.nextRender();
  const tree=DailyNewsSettings(),modal=elements(tree,node=>node.type===hooks.Modal)[0];
  assert.equal(modal.props.title,'重新生成今天的每日新闻？');
  assert.match(modal.props.description,/通过核验后/);
  assert.equal(fixture.calls.length,0);
  button(tree,'确认运行').props.onClick(); await flush();
  assert.equal(fixture.calls[0].body.force,true);
  assert.equal(daily.todayHasDailyNews(state({activeDate:'2026-10-06'}),new Date('2026-10-06T15:59:59Z')),true);
  assert.equal(daily.todayHasDailyNews(state({activeDate:'2026-10-06'}),new Date('2026-10-06T16:00:00Z')),false);
});

test('running or unsaved settings disable immediate runs and real search failure is visible', () => {
  settingsFixture(state({running:true}));
  assert.equal(button(DailyNewsSettings(),'立即运行一次').props.disabled,true);
  const fixture=settingsFixture();fixture.states[1].value=true;
  assert.equal(button(DailyNewsSettings(),'立即运行一次').props.disabled,true);
  settingsFixture(state({search:{configured:true,provider:'newsapi',errorCode:'SEARCH_UNAVAILABLE',errorMessage:'provider stack with secret'}}));
  const tree=DailyNewsSettings();
  assert.match(label(tree),/联网搜索失败/);
  assert.doesNotMatch(label(tree),/provider stack|secret/);
});

test('failure diagnostics are friendly and unknown provider details stay hidden', () => {
  assert.match(daily.dailyNewsError({response:{data:{errorCode:'SEARCH_NO_RESULTS'}}}),/未发布/);
  assert.match(daily.dailyNewsError({response:{data:{code:'ALREADY_RUNNING'}}}),/正在运行/);
  assert.match(daily.dailyNewsJobError({errorCode:'AI_TIMEOUT'}),/超时/);
  assert.doesNotMatch(daily.dailyNewsJobError({errorCode:'unknown',errorMessage:'stack trace secret'}),/stack|secret/);
  assert.equal(daily.dailyNewsTime('invalid'),'—');
  assert.equal(daily.shanghaiDate(new Date('2026-10-06T16:00:00Z')),'2026-10-07');
});

test('provider configured status does not hide partial live-feed failure or evidence diversity', () => {
  settingsFixture(state({ search: { configured:true, provider:'newsapi + publisher-rss', checkedFeeds:5, failedFeeds:3,
    publisherCount:4, primaryCount:12 } }));
  const text = label(DailyNewsSettings());
  assert.match(text, /实时订阅：5 个读取成功 · 3 个暂不可用/);
  assert.match(text, /独立发布者 4 个 · 一手来源 12 条/);
});

test('article references render server-provided HTTP(S) URLs and reject executable or credential URLs', () => {
  const sources=[{title:'官方来源',publisher:'大学',url:'https://example.edu/news',publishedAt:'2026-10-06'},
    {title:'注入',url:'javascript:alert(1)'},{title:'数据',url:'data:text/html,test'},
    {title:'密码',url:'https://reader:secret@example.com/page'},{title:'相对链接',url:'/fake'},null];
  hooks.setFixture({data:{_id:'id',title:'新闻',source:'ClassHub',timestamp:'2026-10-06',category:'AI/ML',origin:'ai_daily',sourceReferences:sources}});
  const tree=ArticlePage(),links=elements(tree,node=>node.type==='a');
  assert.deepEqual(links.map(link=>link.props.href),['https://example.edu/news']);
  assert.match(label(tree),/AI 每日精选/);
  assert.match(label(tree),/官方来源/);
  assert.doesNotMatch(label(tree),/注入|数据|密码|相对链接/);
  assert.equal(links[0].props.rel,'noopener noreferrer');
});

test('homepage requests the preferred active daily batch through the existing one-item news query', async () => {
  const fixture=hooks.setFixture();Homepage();
  const newsQuery=fixture.queryConfigs.find(query=>query.queryKey[0]==='news');
  assert.ok(newsQuery);await newsQuery.queryFn();
  const requested=new URL(fixture.calls[0].url,'https://classhub.test');
  assert.equal(requested.pathname,'/api/news');
  assert.equal(requested.searchParams.get('view'),'home');
  assert.equal(requested.searchParams.get('limit'),'1');
  assert.equal(requested.searchParams.get('sort'),'latest');
});
