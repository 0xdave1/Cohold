import { NextRequest, NextResponse } from 'next/server';
import { isAdminProxyAuthorized } from '@/lib/admin-proxy-auth';
import { buildAdminProxyUpstreamHeaders } from '@/lib/admin-proxy-upstream';
import { CSRF_COOKIE } from '@/lib/constants/auth-cookies';

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
    const errMessage =
      typeof data?.error === 'string'
        ? data.error
        : typeof data?.error?.message === 'string'
          ? data.error.message
          : typeof data?.message === 'string'
            ? data.message
            : `Proxy request failed (${backendRes.status})`;
    return NextResponse.json(
      {
        ...(typeof data === 'object' && data ? data : {}),
        error: errMessage,
      },
      { status: backendRes.status },
    );
  }
  return NextResponse.json(data, { status: backendRes.status });
}
