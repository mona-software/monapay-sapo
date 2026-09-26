export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(message);
  }
}

export async function requestJson<T>(url: string, init: RequestInit, timeoutMs = 10_000): Promise<T> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new HttpError(`HTTP ${response.status} từ ${new URL(url).hostname}`, response.status, body);
  }
  return body as T;
}
