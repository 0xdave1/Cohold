'use client';

import { usePathname } from 'next/navigation';
import { ChevronDown, Search, Settings } from 'lucide-react';

const MONTH_OPTIONS = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'all', label: 'All time' },
] as const;

export function AdminTopbar() {
  const pathname = usePathname();
  const onDashboard = pathname === '/admin/dashboard' || pathname.startsWith('/admin/dashboard/');

  return (
    <header className="sticky top-0 z-30 border-b border-[#DDD8D2] bg-[#F5F1EC]/95 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
        <div className="relative min-w-[200px] max-w-xl flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6F6A64]" />
          <input
            type="search"
            placeholder="Search here"
            className="w-full rounded-full border border-[#DDD8D2] bg-white py-2.5 pl-10 pr-4 text-sm text-[#171717] placeholder:text-[#6F6A64] focus:border-[#054870]/40 focus:outline-none focus:ring-2 focus:ring-[#054870]/15"
            aria-label="Search admin panel"
          />
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {onDashboard ? (
            <div className="relative">
              <select
                defaultValue="this_month"
                onChange={(e) => {
                  window.dispatchEvent(new CustomEvent('admin-month-filter', { detail: e.target.value }));
                }}
                className="appearance-none rounded-lg border border-[#DDD8D2] bg-white py-2 pl-3 pr-8 text-sm font-medium text-[#171717] focus:border-[#054870]/40 focus:outline-none focus:ring-2 focus:ring-[#054870]/15"
                aria-label="Reporting period"
              >
                {MONTH_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6F6A64]" />
            </div>
          ) : null}

          <button
            type="button"
            className="rounded-lg border border-transparent p-2 text-[#6F6A64] transition-colors hover:border-[#DDD8D2] hover:bg-white"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <div
            className="h-9 w-9 rounded-full border border-[#DDD8D2] bg-[#E8E4DE]"
            role="img"
            aria-label="Admin profile"
          />
        </div>
      </div>
    </header>
  );
}
