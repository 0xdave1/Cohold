import type { ReactNode } from 'react';
import { AdminSidebar } from '@/components/admin/Sidebar';
import { AdminTopbar } from '@/components/admin/Topbar';
import { AdminAuthGate } from '@/components/admin/AdminAuthGate';

export default function AdminPanelLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthGate>
      <div className="min-h-screen bg-[#F5F1EC]">
        <AdminSidebar />
        <div className="flex min-h-screen flex-1 flex-col lg:ml-[240px]">
          <AdminTopbar />
          <main className="flex-1 px-4 py-5 lg:px-6 lg:py-6">{children}</main>
        </div>
      </div>
    </AdminAuthGate>
  );
}
