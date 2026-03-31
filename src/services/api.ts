import { apiBaseUrl, publicAnonKey } from "@/utils/supabase/info";
import { sanitizeError, type SanitizedError } from "@/utils/errorHandler";

/**
 * Cliente HTTP centralizado para chamadas à API
 * Garante headers consistentes, tratamento de erros e tipagem
 */

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: Record<string, unknown> | FormData;
  timeout?: number;
};

interface ApiResponse<T> {
  data: T;
  ok: true;
}

interface ApiError {
  error: SanitizedError;
  ok: false;
}

type ApiResult<T> = ApiResponse<T> | ApiError;

class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor() {
    this.baseUrl = apiBaseUrl;
    this.defaultHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${publicAnonKey}`,
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResult<T>> {
    const { body, timeout = 15000, ...fetchOptions } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const url = endpoint.startsWith("http")
        ? endpoint
        : `${this.baseUrl}${endpoint}`;

      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          ...this.defaultHeaders,
          ...fetchOptions.headers,
        },
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = response.statusText;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // response is not JSON
        }

        const error = new Error(errorMessage) as Error & { status: number };
        error.status = response.status;
        return { error: sanitizeError(error), ok: false };
      }

      const data = await response.json();
      return { data, ok: true };
    } catch (error) {
      clearTimeout(timeoutId);
      return { error: sanitizeError(error), ok: false };
    }
  }

  async get<T>(endpoint: string, params?: Record<string, string>, options?: RequestOptions): Promise<ApiResult<T>> {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url = `${endpoint}?${searchParams}`;
    }
    return this.request<T>(url, { ...options, method: "GET" });
  }

  async post<T>(endpoint: string, body?: Record<string, unknown>, options?: RequestOptions): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, { ...options, method: "POST", body });
  }

  async put<T>(endpoint: string, body?: Record<string, unknown>, options?: RequestOptions): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, { ...options, method: "PUT", body });
  }

  async patch<T>(endpoint: string, body?: Record<string, unknown>, options?: RequestOptions): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, { ...options, method: "PATCH", body });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}

/** Instância singleton do cliente API */
export const api = new ApiClient();

/** Type guard para checar sucesso */
export function isApiSuccess<T>(result: ApiResult<T>): result is ApiResponse<T> {
  return result.ok === true;
}

/** Type guard para checar erro */
export function isApiError<T>(result: ApiResult<T>): result is ApiError {
  return result.ok === false;
}

export type { ApiResult, ApiResponse, ApiError };
