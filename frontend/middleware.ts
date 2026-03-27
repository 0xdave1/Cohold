import { NextRequest, NextResponse } from 'next/server';

/**
 * Route protection middleware.
 *
 * - Investor dashboard routes under /dashboard
 * - Admin routes under /admin
 *
 * Reads JWT cookies set by the client (SameSite=Lax so the cookie is still
 * present on top-level navigation back from Paystack / external redirects):
 *  - cohold_user_access_token
 *  - cohold_admin_access_token
 *
 * If `cohold_user_access_token` exists, we do NOT send the user to /login.
 * NOTE: Actual authorization decisions MUST still be enforced on the backend.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isDashboardRoute = pathname.startsWith('/dashboard');
  const isAdminRoute = pathname.startsWith('/admin') && !pathname.startsWith('/admin/login');
  const isAuthRoute = pathname === '/login' || pathname === '/signup' || pathname.startsWith('/auth');

  const userToken = request.cookies.get('cohold_user_access_token')?.value;
  const adminToken = request.cookies.get('cohold_admin_access_token')?.value;

  // Protect investor dashboard
  if (isDashboardRoute && !userToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Protect admin routes (except admin login)
  if (isAdminRoute && !adminToken) {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Prevent logged-in users from seeing auth pages
  if (isAuthRoute && userToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

