'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminLogout } from '@/lib/admin/auth';
import {
  LayoutDashboard, Users, ShieldCheck, Building2, Boxes,
  Wallet, Receipt, AlertTriangle, UserCog, LogOut,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'User management', href: '/admin/users', icon: Users },
  { label: 'Verifications', href: '/admin/verifications', icon: ShieldCheck },
  { label: 'PropertyListings', href: '/admin/property-listings', icon: Building2 },
  { label: 'Cohold management', href: '/admin/coholds', icon: Boxes },
  { label: 'Wallet transactions', href: '/admin/wallet-transactions', icon: Wallet },
  { label: 'Fee logs', href: '/admin/fees', icon: Receipt },
  { label: 'Disputes', href: '/admin/disputes', icon: AlertTriangle },
  { label: 'Admin management', href: '/admin/admin-management', icon: UserCog },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [showLogout, setShowLogout] = useState(false);

  const handleLogout = async () => {
    await adminLogout();
    router.push('/admin/login');
  };

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 flex h-full w-60 flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="text-lg font-bold text-gray-900">Cohold</span>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${
                  active
                    ? 'bg-[#1a3a4a] text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 px-3 py-3">
          <button
            type="button"
            onClick={() => setShowLogout(true)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Logout
          </button>
        </div>
      </aside>

      {showLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200">
              <LogOut className="h-5 w-5 text-gray-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Logout</h2>
            <p className="mt-1 text-sm text-gray-500">Are you sure you want to temporarily logout from this account?</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 rounded-lg border border-[#1a3a4a] bg-white py-2.5 text-sm font-medium text-[#1a3a4a] hover:bg-gray-50"
              >
                Logout
              </button>
              <button
                type="button"
                onClick={() => setShowLogout(false)}
                className="flex-1 rounded-lg bg-[#1a3a4a] py-2.5 text-sm font-medium text-white hover:opacity-90"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
