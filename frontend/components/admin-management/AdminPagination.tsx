'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

type AdminPaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

/** Figma-style numbered pages with ring highlight on active page. */
export function AdminPagination({ page, totalPages, onPageChange }: AdminPaginationProps) {
  if (totalPages <= 1) return null;

  const pageNumbers: (number | 'ellipsis')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pageNumbers.push(i);
    } else if (pageNumbers[pageNumbers.length - 1] !== 'ellipsis') {
      pageNumbers.push('ellipsis');
    }
  }

  return (
    <div className="flex items-center justify-center gap-1 border-t border-[#E8E4DC] bg-white px-5 py-4">
      <button
        type="button"
        aria-label="Previous page"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pageNumbers.map((n, i) =>
        n === 'ellipsis' ? (
          <span
            key={`e-${i}`}
            className="flex h-9 min-w-[2.25rem] items-center justify-center text-xs text-[#9CA3AF]"
          >
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => onPageChange(n)}
            className={`flex h-9 min-w-[2.25rem] items-center justify-center rounded-full text-sm font-medium transition-colors ${
              page === n
                ? 'border-2 border-[#1a3a4a] text-[#1a3a4a] ring-2 ring-[#1a3a4a]/20'
                : 'text-[#4B5563] hover:bg-[#F3F4F6]'
            }`}
          >
            {n}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Next page"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
