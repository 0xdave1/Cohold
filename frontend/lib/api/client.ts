import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth.store';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  meta?: unknown;
}

const DEFAULT_BASE_URL = 'http://localhost:3000/api/v1';

function getBaseURL(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_BASE_URL;
}

function requestHadAuthorization(config: InternalAxiosRequestConfig | undefined): boolean {
  if (!config?.headers) return false;
  const h = config.headers;
  const auth =
    (typeof (h as Record<string, unknown>).Authorization === 'string'
      ? (h as Record<string, string>).Authorization
      : undefined) ??
    (typeof (h as Record<string, unknown>).authorization === 'string'
      ? (h as Record<string, string>).authorization
      : undefined);
  return !!auth && String(auth).length > 0;
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

class ApiClient {
  private instance: AxiosInstance;
  private refreshPromise: Promise<void> | null = null;

  constructor() {
    const baseURL = getBaseURL();

    this.instance = axios.create({
      baseURL,
      withCredentials: true,
    });

    this.instance.interceptors.request.use((config) => {
      const token = useAuthStore.getState().accessToken;

      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    });

    this.instance.interceptors.response.use(
      (response) => response,
      async (error: unknown) => this.handleResponseError(error),
    );
  }

  private ensureRefreshed(): Promise<void> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshAccessToken().finally(() => {
        this.refreshPromise = null;
      });
    }

    return this.refreshPromise;
  }

  private async refreshAccessToken(): Promise<void> {
    const { refreshToken, setTokens } = useAuthStore.getState();

    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const res = await axios.post<ApiResponse<{ accessToken: string; refreshToken?: string }>>(
      `${getBaseURL()}/auth/refresh`,
      { refreshToken },
      {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      },
    );

    const body = res.data;

    if (!body.success || !body.data?.accessToken) {
      throw new Error(body.error ?? 'Refresh failed');
    }

    setTokens({
      accessToken: body.data.accessToken,
      refreshToken: body.data.refreshToken ?? refreshToken,
    });
  }

  private async handleResponseError(error: unknown): Promise<unknown> {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (isRefreshRequest(originalRequest)) {
      useAuthStore.getState().clearSession();
      return Promise.reject(error);
    }

    if (isAuthMutation401Allowed(originalRequest)) {
      return Promise.reject(error);
    }

    if (!requestHadAuthorization(originalRequest)) {
      return Promise.reject(error);
    }

    if (!useAuthStore.getState().refreshToken) {
      useAuthStore.getState().clearSession();
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      useAuthStore.getState().clearSession();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      await this.ensureRefreshed();

      const token = useAuthStore.getState().accessToken;
      originalRequest.headers = originalRequest.headers ?? {};

      if (token) {
        originalRequest.headers.Authorization = `Bearer ${token}`;
      }

      return this.instance(originalRequest);
    } catch {
      useAuthStore.getState().clearSession();
      return Promise.reject(error);
    }
  }

  async get<T>(
    url: string,
    params?: Record<string, unknown>,
    config?: { headers?: Record<string, string> },
  ): Promise<ApiResponse<T>> {
    const res = await this.instance.get<ApiResponse<T>>(url, { params, ...config });
    return res.data;
  }

  async post<T, B = unknown>(
    url: string,
    body?: B,
    config?: { headers?: Record<string, string> },
  ): Promise<ApiResponse<T>> {
    const res = await this.instance.post<ApiResponse<T>>(url, body, config);
    return res.data;
  }

  async put<T, B = unknown>(url: string, body?: B): Promise<ApiResponse<T>> {
    const res = await this.instance.put<ApiResponse<T>>(url, body);
    return res.data;
  }

  async patch<T, B = unknown>(url: string, body?: B): Promise<ApiResponse<T>> {
    const res = await this.instance.patch<ApiResponse<T>>(url, body);
    return res.data;
  }

  async del<T>(url: string): Promise<ApiResponse<T>> {
    const res = await this.instance.delete<ApiResponse<T>>(url);
    return res.data;
  }

  isApiError(error: unknown): error is AxiosError<ApiResponse<unknown>> {
    return axios.isAxiosError(error);
  }
}

export const apiClient = new ApiClient();