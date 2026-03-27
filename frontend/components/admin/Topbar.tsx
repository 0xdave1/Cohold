'use client';

import { Search, Settings } from 'lucide-react';

export function AdminTopbar() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search here"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
          <Settings className="h-5 w-5" />
        </button>
        <div className="h-8 w-8 rounded-full bg-gray-800" />
      </div>
    </header>
  );
}
