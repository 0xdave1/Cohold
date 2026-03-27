export async function adminLogin(email: string, password: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  const res = await fetch(`${apiUrl}/admin-auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? json?.message ?? 'Invalid credentials');
  const token = json?.data?.accessToken ?? json?.accessToken;
  if (!token) throw new Error('No token received');

  await fetch('/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  return token;
}

export async function adminLogout() {
  await fetch('/api/admin/auth/logout', { method: 'POST' });
}
