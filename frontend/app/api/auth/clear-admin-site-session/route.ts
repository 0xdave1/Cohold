import { NextResponse } from 'next/server';
import { ADMIN_SITE_SESSION_COOKIE } from '@/lib/constants/auth-cookies';
import { siteSessionCookieDefaults } from '@/lib/server/site-session-cookie';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SITE_SESSION_COOKIE, '', { ...siteSessionCookieDefaults(), maxAge: 0 });
  return res;
}
