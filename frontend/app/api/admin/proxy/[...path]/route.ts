import { NextRequest, NextResponse } from 'next/server';

const ADMIN_COOKIE_NAME = 'cohold_admin_access_token';

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
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { path } = await context.params;
  const pathStr = path.join('/');
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  const url = `${apiUrl}/${pathStr}${request.nextUrl.search}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const contentType = request.headers.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;

  let body: string | undefined;
  if (method !== 'GET') {
    try {
      body = await request.text();
    } catch {
      // no body
    }
  }

  const backendRes = await fetch(url, {
    method,
    headers,
    body: body || undefined,
  });

  const data = await backendRes.json().catch(() => ({}));
  // Preserve backend payload but normalize message for frontend consumers.
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
