import { serverBase } from "./config";

const TOKEN_KEY = "core.token";

export function getToken(scope: string): string | null {
  return sessionStorage.getItem(`${TOKEN_KEY}.${scope}`);
}
export function setToken(scope: string, token: string | null) {
  if (token) sessionStorage.setItem(`${TOKEN_KEY}.${scope}`, token);
  else sessionStorage.removeItem(`${TOKEN_KEY}.${scope}`);
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** JSON request helper. `scope` selects which stored token to send ("dash" | "admin"). */
export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; scope?: string; form?: FormData } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = opts.scope ? getToken(opts.scope) : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${serverBase()}${path}`, { method: opts.method ?? (body ? "POST" : "GET"), headers, body });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}
