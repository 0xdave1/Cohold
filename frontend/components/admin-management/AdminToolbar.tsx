'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { PERIOD_OPTIONS, ROLE_OPTIONS, STATUS_OPTIONS, type UiPeriod } from './constants';

type AdminToolbarProps = {
  search: string;
  role: string;
  status: string;
  period: UiPeriod;
  onSearchChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onPeriodChange: (value: UiPeriod) => void;
  onAddAdmin: () => void;
};

export function AdminToolbar({
  search,
  role,
  status,
  period,
  onSearchChange,
  onRoleChange,
  onStatusChange,
  onPeriodChange,
  onAddAdmin,
}: AdminToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setFilterOpen(false);
    };
    if (filterOpen) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [filterOpen]);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="relative w-full max-w-xl">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#9CA3AF]" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search here"
          className="w-full rounded-xl border border-[#E5E7EB] bg-white py-2.5 pl-11 pr-4 text-sm text-[#111827] shadow-sm placeholder:text-[#9CA3AF] focus:border-[#1a3a4a] focus:outline-none focus:ring-2 focus:ring-[#1a3a4a]/15"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3" ref={panelRef}>
        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              filterOpen
                ? 'border-[#1a3a4a] bg-[#F8FAFC] text-[#1a3a4a]'
                : 'border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter
          </button>
          {filterOpen ? (
            <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-lg">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Filters</p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#374151]">Role</label>
                  <select
                    value={role}
                    onChange={(e) => onRoleChange(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                  >
                    <option value="">All roles</option>
                    {ROLE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#374151]">Status</label>
                  <select
                    value={status}
                    onChange={(e) => onStatusChange(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                  >
                    <option value="">All statuses</option>
                    {STATUS_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#374151]">Time period</label>
                  <select
                    value={period}
                    onChange={(e) => onPeriodChange(e.target.value as UiPeriod)}
                    className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                  >
                    {PERIOD_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onAddAdmin}
          className="rounded-full bg-[#00416A] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#003558]"
        >
          Add admin
        </button>
      </div>
    </div>
  );
}
