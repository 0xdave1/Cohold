/**
 * HttpOnly first-party session markers on the Next origin (Issue 4).
 * Server routes validate Bearer access with the API before setting cookies.
 */
export async function establishUserSiteSession(accessToken: string): Promise<boolean> {
  if (!accessToken) return false;
  const res = await fetch('/api/auth/establish-user-site-session', {
    method: 'POST',
    credentials: 'include',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.ok;
}

export async function clearUserSiteSession(): Promise<void> {
  await fetch('/api/auth/clear-user-site-session', { method: 'POST', credentials: 'include' }).catch(() => undefined);
}

export async function establishAdminSiteSession(accessToken: string): Promise<boolean> {
  if (!accessToken) return false;
  const res = await fetch('/api/auth/establish-admin-site-session', {
    method: 'POST',
    credentials: 'include',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.ok;
}

export async function clearAdminSiteSession(): Promise<void> {
  await fetch('/api/auth/clear-admin-site-session', { method: 'POST', credentials: 'include' }).catch(() => undefined);
}
