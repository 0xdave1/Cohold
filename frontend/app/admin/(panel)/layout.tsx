import type { ReactNode } from 'react';
import { AdminSidebar } from '@/components/admin/Sidebar';
import { AdminTopbar } from '@/components/admin/Topbar';

export default function AdminPanelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#f8f5f0' }}>
      <AdminSidebar />
      <div className="flex flex-1 flex-col lg:ml-60">
        <AdminTopbar />
        <main className="flex-1 px-3 py-4 sm:px-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
