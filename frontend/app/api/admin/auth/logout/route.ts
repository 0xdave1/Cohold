import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    success: false,
    error: 'Deprecated admin auth proxy route. Use backend /admin-auth/logout with cookie auth.',
  }, { status: 410 });
}
