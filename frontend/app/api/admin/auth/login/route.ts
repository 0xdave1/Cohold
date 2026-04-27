import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  void request;
  return NextResponse.json(
    {
      success: false,
      error: 'Deprecated admin auth proxy route. Use backend /admin-auth/login with cookie auth.',
    },
    { status: 410 },
  );
}
