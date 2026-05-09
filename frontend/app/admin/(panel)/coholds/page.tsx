'use client';

import Link from 'next/link';

export default function CoholdsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Cohold management</h1>
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
        <p className="font-medium">Not available in this API</p>
        <p className="mt-2 text-amber-900/90">
          There is no <code className="rounded bg-white/60 px-1">admin/coholds</code> aggregate endpoint wired to this
          frontend. The operations dashboard shows &quot;total coholds&quot; as explicitly unsupported when the
          overview returns <code className="rounded bg-white/60 px-1">null</code> for that metric. Use{' '}
          <Link href="/admin/dashboard" className="font-semibold text-[#1a3a4a] underline">
            Dashboard
          </Link>{' '}
          and property listings for portfolio context.
        </p>
      </div>
    </div>
  );
}
