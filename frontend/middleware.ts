import { NextRequest, NextResponse } from 'next/server';
import { getAuthMiddlewareRedirect, parseMiddlewareAuthEnv } from '@/lib/middleware-auth';

export function middleware(request: NextRequest) {
  const redirectUrl = getAuthMiddlewareRedirect(
    request.nextUrl.pathname,
    request.cookies,
    request.url,
    parseMiddlewareAuthEnv(),
  );
  if (redirectUrl) {
    return NextResponse.redirect(redirectUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
