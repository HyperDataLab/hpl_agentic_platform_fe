import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from "axios";

import { ApiError, type RequestParams } from "@/types/api";

import { getApiBaseUrl } from "./config";

export type { RequestParams } from "@/types/api";

type RequestOptions = Omit<AxiosRequestConfig, "url" | "method" | "data" | "params">;
/** Gives the bearer token for a request: the signed-in account's Firebase ID token, or null. */
export type TokenSource = () => Promise<string | null>;

/** How the worker (and the old Platform API) describe a failure. */
interface ErrorBody {
  message?: string;
  error?: string | { code?: string; message?: string; details?: ApiError["details"]; reason?: string };
  code?: string;
  meta?: { request_id?: string };
}

const STATUS_CODES: Record<number, string> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "RATE_LIMITED",
};

/** Calls the i2h-worker with the Firebase ID token. A 401 means the account's session is over. */
export class ApiService {
  private readonly client: AxiosInstance;

  constructor(
    baseURL: string,
    private readonly token: TokenSource = async () => null,
    timeout = 30000,
  ) {
    this.client = axios.create({ baseURL, timeout });
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(async (config) => {
      const token = await this.token();
      if (token) config.headers.set("Authorization", `Bearer ${token}`);
      if (typeof FormData !== "undefined" && config.data instanceof FormData) {
        config.headers.delete("Content-Type");
      }
      return config;
    });
    this.client.interceptors.response.use(
      (response) => {
        if (response.data?.success === false) {
          const error = this.responseError(response);
          this.handleApiError(error);
          throw error;
        }
        return response;
      },
      async (error: unknown) => {
        if (error instanceof ApiError) return Promise.reject(error);
        if (axios.isCancel(error)) return Promise.reject(error);
        if (!axios.isAxiosError(error)) return Promise.reject(error);
        if (error.response && typeof Blob !== "undefined" && error.response.data instanceof Blob) {
          try {
            error.response.data = JSON.parse(await error.response.data.text());
          } catch {
            error.response.data = null;
          }
        }
        const apiError = error.response
          ? this.responseError(error.response)
          : new ApiError(0, "NETWORK_ERROR", "Unable to connect to the server. Please try again.");
        this.handleApiError(apiError);
        return Promise.reject(apiError);
      },
    );
  }

  private handleApiError(error: ApiError): void {
    if (error.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("auth:expired"));
  }

  private responseError(response: AxiosResponse<unknown>): ApiError {
    const body = (response.data ?? null) as ErrorBody | null;
    const detail = typeof body?.error === "object" ? body.error : null;
    const text = typeof body?.error === "string" ? body.error : null;
    // The worker answers `{ error: code, message }` with codes such as `not_found` or `LLM_KEY_REQUIRED`.
    const textCode = text && /^[A-Za-z][A-Za-z0-9_]*$/.test(text) ? text.toUpperCase() : null;
    const retryHeader = response.headers["retry-after"];
    const retrySeconds = retryHeader == null ? NaN : Number(retryHeader);
    const retryDate = retryHeader == null ? NaN : Date.parse(String(retryHeader));
    let retryAfter: number | null = null;
    if (Number.isFinite(retrySeconds)) {
      retryAfter = Math.max(0, Math.ceil(retrySeconds));
    } else if (Number.isFinite(retryDate)) {
      retryAfter = Math.max(0, Math.ceil((retryDate - Date.now()) / 1000));
    }
    return new ApiError(
      response.status,
      detail?.code ?? body?.code ?? textCode ?? STATUS_CODES[response.status] ?? "HTTP_ERROR",
      body?.message ?? detail?.message ?? text ?? "The server encountered an error. Please try again.",
      detail?.details ?? [],
      body?.meta?.request_id ?? response.headers["x-request-id"] ?? null,
      retryAfter,
      detail?.reason ?? null,
    );
  }

  request<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.request<T>(config);
  }
  get<T>(url: string, params?: RequestParams, options?: RequestOptions): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...options, method: "GET", url, params });
  }
  post<T, D = unknown>(url: string, data?: D, options?: RequestOptions): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...options, method: "POST", url, data });
  }
  put<T, D = unknown>(url: string, data?: D, options?: RequestOptions): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...options, method: "PUT", url, data });
  }
  patch<T, D = unknown>(url: string, data?: D, options?: RequestOptions): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...options, method: "PATCH", url, data });
  }
  delete<T>(url: string, options?: RequestOptions): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...options, method: "DELETE", url });
  }
  upload<T>(
    url: string,
    data: FormData,
    onProgress?: (progress: number) => void,
    options?: RequestOptions,
  ): Promise<AxiosResponse<T>> {
    return this.request<T>({
      ...options,
      method: "POST",
      url,
      data,
      onUploadProgress: ({ loaded, total }) => {
        if (total) onProgress?.(Math.round((loaded * 100) / total));
      },
    });
  }
}

// Firebase is loaded on the first request, so modules that only import the client stay light (and testable).
const idToken: TokenSource = async () => {
  if (typeof window === "undefined") return null;
  const { getIdToken } = await import("@/lib/firebase/client");
  return getIdToken();
};

const apiService = new ApiService(getApiBaseUrl(), idToken);
export default apiService;
