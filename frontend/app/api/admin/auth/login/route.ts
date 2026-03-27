import { NextRequest, NextResponse } from 'next/server';

const ADMIN_COOKIE_NAME = 'cohold_admin_access_token';
const MAX_AGE = 60 * 60; // 1 hour

export async function POST(request: NextRequest) {
  const { token } = await request.json();
  if (!token) {
    return NextResponse.json({ success: false, error: 'Missing token' }, { status: 400 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    path: '/',
    maxAge: MAX_AGE,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
