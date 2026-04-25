import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import { clearClientCsrfToken, getClientCsrfForRequest, setClientCsrfToken } from '@/lib/api/csrf-memory';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  meta?: unknown;
}

/** Production API (Render). Local dev: set NEXT_PUBLIC_API_URL or use localhost:4000 default. */
export const DEFAULT_API_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://cohold.onrender.com/api/v1'
    : 'http://localhost:4000/api/v1';

export function getApiBaseURL(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_BASE_URL;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function methodRequiresCsrf(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
}

function isRefreshRequest(config: InternalAxiosRequestConfig | undefined): boolean {
  const url = config?.url ?? '';
  return url.includes('/auth/refresh');
}

function isAuthMutation401Allowed(config: InternalAxiosRequestConfig | undefined): boolean {
  const url = config?.url ?? '';
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/signup') ||
    url.includes('/auth/complete-signup') ||
    url.includes('/auth/verify-otp') ||
    url.includes('/auth/request-otp') ||
    url.includes('/auth/reset-password')
  );
}

function captureCsrfFromResponseBody(body: unknown): void {
  if (!body || typeof body !== 'object') return;
  const root = body as Record<string, unknown>;
  const inner = root.data;
  const csrf =
    (typeof inner === 'object' && inner !== null && 'csrfToken' in inner
      ? (inner as Record<string, unknown>).csrfToken
      : undefined) ?? root.csrfToken;
  if (typeof csrf === 'string' && csrf.length > 0) {
    setClientCsrfToken(csrf);
  }
}

/**
 * Shared Axios instance — use this for all app API calls (`withCredentials: true`).
 * Also exported as `api` for drop-in use with the same interceptors.
 */
export const api: AxiosInstance = axios.create({
  baseURL: getApiBaseURL(),
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const method = String(config.method ?? 'get').toUpperCase();
  if (methodRequiresCsrf(method)) {
    const csrfToken = getClientCsrfForRequest() ?? getCookie('cohold_csrf_token');
    if (csrfToken) {
      config.headers = config.headers ?? {};
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return config;
});

let refreshPromise: Promise<void> | null = null;

function ensureRefreshed(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function refreshAccessToken(): Promise<void> {
  const res = await api.post<ApiResponse<{ requiresUsernameSetup?: boolean; csrfToken?: string }>>(
    '/auth/refresh',
    {},
  );
  captureCsrfFromResponseBody(res.data);
  const body = res.data;
  if (!body.success) {
    throw new Error(body.error ?? 'Refresh failed');
  }
}

api.interceptors.response.use(
  (response) => {
    captureCsrfFromResponseBody(response.data);
    return response;
  },
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (isRefreshRequest(originalRequest)) {
      clearClientCsrfToken();
      useAuthStore.getState().clearSession();
      return Promise.reject(error);
    }

    if (isAuthMutation401Allowed(originalRequest)) {
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      clearClientCsrfToken();
      useAuthStore.getState().clearSession();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      await ensureRefreshed();
      return api(originalRequest);
    } catch {
      clearClientCsrfToken();
      useAuthStore.getState().clearSession();
      return Promise.reject(error);
    }
  },
);

class ApiClient {
  async get<T>(
    url: string,
    params?: Record<string, unknown>,
    config?: { headers?: Record<string, string> },
  ): Promise<ApiResponse<T>> {
    const res = await api.get<ApiResponse<T>>(url, { params, ...config });
    return res.data;
  }

  async post<T, B = unknown>(
    url: string,
    body?: B,
    config?: { headers?: Record<string, string> },
  ): Promise<ApiResponse<T>> {
    const res = await api.post<ApiResponse<T>>(url, body, config);
    return res.data;
  }

  async put<T, B = unknown>(url: string, body?: B): Promise<ApiResponse<T>> {
    const res = await api.put<ApiResponse<T>>(url, body);
    return res.data;
  }

  async patch<T, B = unknown>(url: string, body?: B): Promise<ApiResponse<T>> {
    const res = await api.patch<ApiResponse<T>>(url, body);
    return res.data;
  }

  async del<T>(url: string): Promise<ApiResponse<T>> {
    const res = await api.delete<ApiResponse<T>>(url);
    return res.data;
  }

  isApiError(error: unknown): error is AxiosError<ApiResponse<unknown>> {
    return axios.isAxiosError(error);
  }
}

export const apiClient = new ApiClient();
