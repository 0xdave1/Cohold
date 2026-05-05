import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import { readCsrfCookieFromDocument } from '@/lib/csrf-cookie';
import { attachCsrfHeaderForUnsafeMethod } from '@/lib/api/attach-csrf-header';

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

export function extractAccessTokenFromEnvelope(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const root = body as Record<string, unknown>;
  const inner = root.data;
  if (typeof inner === 'object' && inner !== null && 'accessToken' in inner) {
    const t = (inner as Record<string, unknown>).accessToken;
    if (typeof t === 'string' && t.length > 0) return t;
  }
  if ('accessToken' in root && typeof root.accessToken === 'string') {
    return root.accessToken as string;
  }
  return undefined;
}

function isRefreshRequest(config: InternalAxiosRequestConfig | undefined): boolean {
  const url = config?.url ?? '';
  return url.includes('/auth/refresh');
}

function isAdminRefreshRequest(config: InternalAxiosRequestConfig | undefined): boolean {
  const url = config?.url ?? '';
  return url.includes('/admin-auth/refresh');
}

function isAdminRequest(config: InternalAxiosRequestConfig | undefined): boolean {
  const url = config?.url ?? '';
  return url.includes('/admin/') || url.includes('/admin-auth/');
}

function isAuthMutation401Allowed(config: InternalAxiosRequestConfig | undefined): boolean {
  const url = config?.url ?? '';
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/signup') ||
    url.includes('/auth/complete-signup') ||
    url.includes('/auth/verify-otp') ||
    url.includes('/auth/request-otp') ||
    url.includes('/auth/resend-otp') ||
    url.includes('/auth/reset-password') ||
    url.includes('/auth/forgot-password') ||
    url.includes('/admin-auth/login')
  );
}

/**
 * Single Axios instance: `withCredentials: true`, Bearer access token from memory when present.
 */
export const api: AxiosInstance = axios.create({
  baseURL: getApiBaseURL(),
  withCredentials: true,
});

export type RequestConfigWithSkip = InternalAxiosRequestConfig & { skipBearer?: boolean };

/** POST without attaching in-memory Bearer (used for cookie-only refresh). */
export function postWithCredentialsOnly<T = unknown>(url: string, body?: unknown) {
  return api.post<T>(url, body, { skipBearer: true } as RequestConfigWithSkip);
}

api.interceptors.request.use((config) => {
  const c = config as RequestConfigWithSkip;
  if (!c.skipBearer) {
    const { accessToken, adminAccessToken } = useAuthStore.getState();
    const token = isAdminRequest(config) ? adminAccessToken : accessToken;
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  config.headers = config.headers ?? {};
  attachCsrfHeaderForUnsafeMethod(
    config.method,
    config.headers as Record<string, string>,
    readCsrfCookieFromDocument,
  );
  return config;
});

let refreshPromise: Promise<void> | null = null;
let adminRefreshPromise: Promise<void> | null = null;

function ensureRefreshed(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function refreshAccessToken(): Promise<void> {
  const res = await postWithCredentialsOnly<ApiResponse<{ accessToken?: string; requiresUsernameSetup?: boolean }>>(
    '/auth/refresh',
    {},
  );
  const token = extractAccessTokenFromEnvelope(res.data);
  if (token) {
    useAuthStore.getState().setAccessToken(token);
  }
  const body = res.data;
  if (!body.success) {
    throw new Error(body.error ?? 'Refresh failed');
  }
}

function ensureAdminRefreshed(): Promise<void> {
  if (!adminRefreshPromise) {
    adminRefreshPromise = refreshAdminAccessToken().finally(() => {
      adminRefreshPromise = null;
    });
  }
  return adminRefreshPromise;
}

async function refreshAdminAccessToken(): Promise<void> {
  const res = await postWithCredentialsOnly<ApiResponse<{ accessToken?: string }>>('/admin-auth/refresh', {});
  const token = extractAccessTokenFromEnvelope(res.data);
  if (token) {
    useAuthStore.getState().setAdminAccessToken(token);
  }
  if (!res.data.success) {
    throw new Error(res.data.error ?? 'Admin refresh failed');
  }
}

api.interceptors.response.use(
  (response) => {
    const token = extractAccessTokenFromEnvelope(response.data);
    if (token) {
      const url = String(response.config?.url ?? '');
      if (url.includes('/admin-auth/')) {
        useAuthStore.getState().setAdminAccessToken(token);
      } else {
        useAuthStore.getState().setAccessToken(token);
      }
    }
    return response;
  },
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (isRefreshRequest(originalRequest)) {
      useAuthStore.getState().clearUserSession();
      return Promise.reject(error);
    }

    if (isAdminRefreshRequest(originalRequest)) {
      useAuthStore.getState().clearAdminSession();
      return Promise.reject(error);
    }

    if (isAuthMutation401Allowed(originalRequest)) {
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      if (isAdminRequest(originalRequest)) {
        useAuthStore.getState().clearAdminSession();
      } else {
        useAuthStore.getState().clearUserSession();
      }
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (isAdminRequest(originalRequest)) {
        await ensureAdminRefreshed();
        return api(originalRequest);
      }
      await ensureRefreshed();
      return api(originalRequest);
    } catch {
      if (isAdminRequest(originalRequest)) {
        return Promise.reject(error);
      }
      useAuthStore.getState().clearUserSession();
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
