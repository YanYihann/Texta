import { readStorage, TOKEN_KEY } from "./storage";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export function apiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (configured !== undefined) return configured.replace(/\/$/, "");
  if (
    typeof location !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(location.hostname)
  )
    return "http://localhost:3000";
  return "https://api-texta.yanyihan.top";
}
export interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  token?: string;
  timeoutMs?: number;
  retries?: number;
}
export async function api<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const {
    body,
    token = readStorage(TOKEN_KEY) || "",
    timeoutMs = 25000,
    retries = 0,
    signal: externalSignal,
    ...init
  } = options;
  // Only callers of safe reads opt into retries. Generation, sync and payment writes are not replayed.
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const abort = () => controller.abort(externalSignal?.reason);
    if (externalSignal?.aborted) abort();
    else externalSignal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${apiBase()}${path}`, {
        ...init,
        signal: controller.signal,
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: {
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...init.headers,
        },
      });
      const text = await response.text();
      let data: T & { error?: string };
      try {
        data = JSON.parse(text);
      } catch {
        throw new ApiError(
          "服务返回了无法解析的数据，请稍后重试。",
          response.status || 502,
        );
      }
      if (!response.ok)
        throw new ApiError(
          data.error || "请求失败，请稍后重试。",
          response.status,
        );
      return data;
    } catch (error) {
      if (externalSignal?.aborted) throw error;
      if (
        attempt >= retries ||
        (error instanceof ApiError &&
          ![408, 429, 500, 502, 503, 504].includes(error.status))
      )
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", abort);
    }
  }
}
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.name === "AbortError")
    return "请求超时，请稍后重试。";
  if (error instanceof Error && !(error instanceof TypeError))
    return error.message;
  return "暂时无法连接服务，请检查网络后重试。";
}
