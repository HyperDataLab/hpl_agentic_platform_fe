import { getApiBaseUrl } from "./config";
import apiService from "./core";
import type { FileDownload } from "./types";

export const projectPath = (projectId: string) => `/projects/${encodeURIComponent(projectId)}`;
export const runPath = (projectId: string, runId: string) =>
  `${projectPath(projectId)}/runs/${encodeURIComponent(runId)}`;
export const downloadUrl = (path: string) => `${getApiBaseUrl()}${path}`;

/**
 * The `Authorization` header every worker call carries: the signed-in account's Firebase ID token. Empty when nobody
 * is signed in, and the worker answers 401.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  const { getIdToken } = await import("@/lib/firebase/client");
  const token = await getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** `fetch` to the worker with the ID token, for what axios can't do (reading a stream). */
export async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(await authHeaders())) headers.set(name, value);
  return fetch(`${getApiBaseUrl()}${path}`, { ...init, headers });
}

export async function requestDownload(url: string, signal?: AbortSignal): Promise<FileDownload> {
  const response = await apiService.get<Blob>(url, undefined, { responseType: "blob", signal });
  const disposition = String(response.headers["content-disposition"] ?? "");
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const plain = /filename="([^"]+)"|filename=([^;]+)/i.exec(disposition);
  let filename = plain?.[1] ?? plain?.[2]?.trim() ?? null;
  if (encoded) {
    try {
      filename = decodeURIComponent(encoded);
    } catch {
      filename = encoded;
    }
  }
  return { blob: response.data, filename, contentType: String(response.headers["content-type"] ?? response.data.type) };
}
