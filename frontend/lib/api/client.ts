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

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Methods that must send X-CSRF-Token (matches backend non-safe, non-exempt routes; includes PUT). */
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

class ApiClient {
  private instance: AxiosInstance;
  private refreshPromise: Promise<void> | null = null;

  constructor() {
    const baseURL = getBaseURL();

    this.instance = axios.create({
      baseURL,
      /** Cookie-only auth: send HttpOnly session cookies on same-site / credentialed cross-site requests. */
      withCredentials: true,
    });

    this.instance.interceptors.request.use((config) => {
      const method = String(config.method ?? 'get').toUpperCase();
      if (methodRequiresCsrf(method)) {
        const csrfToken = getCookie('cohold_csrf_token');
        if (csrfToken) {
          config.headers = config.headers ?? {};
          config.headers['X-CSRF-Token'] = csrfToken;
        }
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
    /** Use shared instance so CSRF + withCredentials apply (refresh is not CSRF-exempt). */
    const res = await this.instance.post<ApiResponse<{ requiresUsernameSetup?: boolean }>>(
      '/auth/refresh',
      {},
    );

    const body = res.data;

    if (!body.success) {
      throw new Error(body.error ?? 'Refresh failed');
    }
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

    if (originalRequest._retry) {
      useAuthStore.getState().clearSession();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      await this.ensureRefreshed();
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
