'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  loading?: boolean;
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  page = 1,
  totalPages = 1,
  onPageChange,
  loading = false,
  emptyMessage = 'No data found.',
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#DDD8D2] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#DDD8D2] bg-[#F5F1EC]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#6F6A64]"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-[#DDD8D2]/60">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-[#6F6A64]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr key={row.id ?? i} className="border-b border-[#DDD8D2]/60 transition-colors hover:bg-[#F5F1EC]/50">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-[#171717]">
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[#DDD8D2] px-4 py-3">
          <p className="text-xs text-[#6F6A64]">Page {page} of {totalPages}</p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="rounded-lg border border-[#DDD8D2] p-1.5 text-[#6F6A64] hover:bg-[#F5F1EC] disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="rounded-lg border border-[#DDD8D2] p-1.5 text-[#6F6A64] hover:bg-[#F5F1EC] disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
