import { NextRequest, NextResponse } from 'next/server';
import { isAdminProxyAuthorized } from '@/lib/admin-proxy-auth';
import { buildAdminProxyUpstreamHeaders } from '@/lib/admin-proxy-upstream';
import { CSRF_COOKIE } from '@/lib/constants/auth-cookies';
import { sanitizeBackendMessage } from '@/lib/api/security-errors';

function extractUpstreamErrorMessage(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const d = data as Record<string, unknown>;
  if (typeof d.error === 'string') return d.error;
  if (d.error && typeof d.error === 'object' && d.error !== null) {
    const e = d.error as Record<string, unknown>;
    if (typeof e.message === 'string') return e.message;
    if (Array.isArray(e.message) && typeof e.message[0] === 'string') return e.message[0];
  }
  if (typeof d.message === 'string') return d.message;
  return '';
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, context, 'GET');
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, context, 'POST');
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, context, 'PATCH');
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, context, 'DELETE');
}

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
  method: string,
) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  if (!isAdminProxyAuthorized(cookieHeader)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const csrfToken = request.cookies.get(CSRF_COOKIE)?.value;
  const { path } = await context.params;
  const pathStr = path.join('/');
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  const url = `${apiUrl}/${pathStr}${request.nextUrl.search}`;

  const headers = buildAdminProxyUpstreamHeaders({
    cookieHeader,
    method,
    csrfCookieValue: csrfToken,
    contentType: request.headers.get('content-type'),
  });

  let body: string | undefined;
  if (method !== 'GET') {
    try {
      body = await request.text();
    } catch {
      // no body
    }
  }

  const callBackend = async (targetUrl: string, targetMethod: string, targetBody?: string) =>
    fetch(targetUrl, {
      method: targetMethod,
      headers,
      body: targetBody || undefined,
    });

  let backendRes = await callBackend(url, method, body);
  if (backendRes.status === 401) {
    const refreshRes = await callBackend(`${apiUrl}/admin-auth/refresh`, 'POST');
    if (refreshRes.ok) {
      backendRes = await callBackend(url, method, body);
    }
  }

  const data = await backendRes.json().catch(() => ({}));
  if (!backendRes.ok) {
    const raw = extractUpstreamErrorMessage(data);
    const safeMessage = sanitizeBackendMessage(raw) || `Request failed (${backendRes.status})`;
    const code =
      typeof data === 'object' &&
      data &&
      typeof (data as Record<string, unknown>).error === 'object' &&
      (data as Record<string, unknown>).error !== null &&
      typeof ((data as Record<string, unknown>).error as Record<string, unknown>).code === 'string'
        ? String(((data as Record<string, unknown>).error as Record<string, unknown>).code)
        : undefined;
    return NextResponse.json(
      {
        success: false,
        error: code ? { message: safeMessage, code } : { message: safeMessage },
      },
      { status: backendRes.status },
    );
  }
  return NextResponse.json(data, { status: backendRes.status });
}
