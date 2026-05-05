import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseURL } from '@/lib/api/client';
import { USER_SITE_SESSION_COOKIE } from '@/lib/constants/auth-cookies';
import { siteSessionCookieDefaults } from '@/lib/server/site-session-cookie';

export async function POST(request: NextRequest) {
  const authz = request.headers.get('authorization');
  if (!authz?.toLowerCase().startsWith('bearer ')) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const api = getApiBaseURL();
  const res = await fetch(`${api}/users/me`, {
    headers: { Authorization: authz },
  });
  const body = (await res.json().catch(() => null)) as { success?: boolean } | null;
  if (!res.ok || !body || body.success === false) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const out = NextResponse.json({ ok: true });
  out.cookies.set(USER_SITE_SESSION_COOKIE, '1', { ...siteSessionCookieDefaults(), maxAge: 60 * 60 * 24 * 30 });
  return out;
}
