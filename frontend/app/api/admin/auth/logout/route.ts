import { NextResponse } from 'next/server';

const ADMIN_COOKIE_NAME = 'cohold_admin_access_token';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
