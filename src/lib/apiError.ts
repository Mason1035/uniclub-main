/**
 * 把 fetch 的失败翻译成对用户有意义的中文提示。
 *
 * 背景：后端没启动时，Vite 的 /api 代理会返回 HTTP 500 + text/plain 的空 body。
 * 此时 `await res.json()` 会抛 `Unexpected end of JSON input`，
 * 直接把它显示给用户毫无意义。
 */

/** 安全解析 JSON：解析失败返回 null，而不是抛异常。 */
export async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const BACKEND_HINT = '请稍后重试，或联系网站管理员。';

/** 根据响应状态给出可读提示；res 为 null 表示请求根本没发出去。 */
export function describeRequestFailure(res: Response | null, fallback: string): string {
  if (!res) return `暂时无法连接服务，${BACKEND_HINT}`;
  if (res.status >= 500) {
    return `服务暂时不可用（HTTP ${res.status}）。${BACKEND_HINT}`;
  }
  return fallback;
}

/**
 * 处理 fetch 抛出的异常。
 * 浏览器在网络层失败时抛的是英文 `Failed to fetch` / `Load failed`，
 * 需要换成人话；其余（我们主动 throw 的）保留原消息。
 */
export function describeFetchError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  if (!message) return fallback;
  if (/Failed to fetch|NetworkError|Load failed|ERR_/i.test(message)) {
    return `暂时无法连接服务，${BACKEND_HINT}`;
  }
  return message;
}
