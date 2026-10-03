import api from './axios';
import { listFrom } from './contentFormat';

/** Read every page before applying local filters, so older content stays reachable. */
export async function fetchContentPages<T>(endpoint: string, keys: string[], signal?: AbortSignal): Promise<T[]> {
  const items: T[] = [];
  const batchSize = 100;
  for (let page = 1; ; page += 1) {
    const { data } = await api.get<unknown>(endpoint, { params: { page, limit: batchSize }, signal });
    const batch = listFrom<T>(data, ...keys);
    items.push(...batch);
    if (!batch.length) break;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const pagination = (data as { pagination?: { pages?: number; totalPages?: number; hasMore?: boolean } }).pagination;
      const pages = pagination?.pages ?? pagination?.totalPages;
      if (pages !== undefined && Number.isFinite(pages)) {
        if (page >= pages) break;
        continue;
      }
      if (pagination?.hasMore !== undefined) {
        if (!pagination.hasMore) break;
        continue;
      }
      break;
    }
    if (batch.length < batchSize) break;
  }
  return items;
}
