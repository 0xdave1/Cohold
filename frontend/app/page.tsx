import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/** Must match `middleware.ts` and `stores/auth.store.ts` (`cohold_user_access_token`). */
const USER_AUTH_COOKIE = 'cohold_user_access_token';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const token = cookies().get(USER_AUTH_COOKIE)?.value;
  if (token) {
    redirect('/dashboard/home');
  }
  redirect('/landing');
}
