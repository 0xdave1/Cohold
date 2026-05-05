export function siteSessionCookieDefaults(): {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: '/';
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}
