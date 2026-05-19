'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { adminLogout } from '@/lib/admin/auth';
import { isAdminNavActive, visibleAdminNavGroups } from '@/lib/admin/nav-config';
import { adminTheme } from '@/lib/admin/admin-theme';
import { useAuthStore } from '@/stores/auth.store';
import { LogOut } from 'lucide-react';

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [showLogout, setShowLogout] = useState(false);
  const adminRole = useAuthStore((s) => s.adminRole);

  const groups = useMemo(() => visibleAdminNavGroups(adminRole), [adminRole]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash === '#ops-outbox') {
      document.getElementById('ops-outbox')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [pathname]);

  const handleLogout = async () => {
    await adminLogout();
    router.push('/admin/login');
  };

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-[240px] flex-col border-r border-[#DDD8D2] bg-white lg:flex">
        <div className="px-5 py-6">
          <span className="text-xl font-bold tracking-tight text-[#171717]">Cohold</span>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {groups.map((group) => (
            <div key={group.id}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-[#6F6A64]">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isAdminNavActive(pathname, item.href, item.matchPrefix ?? true);
                  const Icon = item.icon;
                  return (
                    <li key={`${group.id}-${item.href}`}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${
                          active
                            ? 'bg-[#F0EEEA] text-[#054870]'
                            : 'text-[#6F6A64] hover:bg-[#F5F1EC] hover:text-[#171717]'
                        }`}
                      >
                        <Icon
                          className="h-[18px] w-[18px] shrink-0"
                          strokeWidth={1.75}
                          style={{ color: active ? adminTheme.primary : undefined }}
                        />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-[#DDD8D2] px-3 py-3">
          <button
            type="button"
            onClick={() => setShowLogout(true)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-[#6F6A64] transition-colors hover:bg-[#F5F1EC] hover:text-[#171717]"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
            Logout
          </button>
        </div>
      </aside>

      {showLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#DDD8D2] bg-white p-6 shadow-xl">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-[#DDD8D2] bg-[#F5F1EC]">
              <LogOut className="h-5 w-5 text-[#6F6A64]" />
            </div>
            <h2 className="text-lg font-semibold text-[#171717]">Logout</h2>
            <p className="mt-1 text-sm text-[#6F6A64]">Are you sure you want to sign out of the admin panel?</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogout(false)}
                className="flex-1 rounded-lg border border-[#DDD8D2] bg-white py-2.5 text-sm font-medium text-[#171717] hover:bg-[#F5F1EC]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex-1 rounded-lg py-2.5 text-sm font-medium text-white hover:opacity-90"
                style={{ backgroundColor: adminTheme.primary }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
