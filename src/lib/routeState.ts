import type { RouteObject, RouteMatch } from 'react-router-dom';

const CONTENT_ID = /^[a-f\d]{24}$/i;
const COMMENT_TYPES = new Set(['news', 'event', 'resource', 'social']);

// ClassHub content routes use database ObjectIds, not arbitrary slugs.
export function validContentParams(params: Readonly<Record<string, string | undefined>>) {
  return CONTENT_ID.test(params.id || '') && (!params.type || COMMENT_TYPES.has(params.type));
}

export function isNotFoundRoute(matches: RouteMatch<string, RouteObject>[] | null) {
  const last = matches?.[matches.length - 1];
  if (!last || last.route.path === '*') return true;
  return Boolean(last.route.handle?.contentId && !validContentParams(last.params));
}

export function isMissingContent(error: unknown) {
  return !!error && typeof error === 'object' && 'response' in error
    && (error as { response?: { status?: number } }).response?.status === 404;
}
