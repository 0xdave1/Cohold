import type { ReactNode } from 'react';
import { AdminSidebar } from '@/components/admin/Sidebar';
import { AdminTopbar } from '@/components/admin/Topbar';

export default function AdminPanelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#f8f5f0' }}>
      <AdminSidebar />
      <div className="ml-60 flex flex-1 flex-col">
        <AdminTopbar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
