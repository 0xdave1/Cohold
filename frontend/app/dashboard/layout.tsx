import type { ReactNode } from 'react';
// import Image from "next/image";
import { RedirectIfNotOnboarded } from '@/components/dashboard/RedirectIfNotOnboarded';
import { DashboardBottomNav } from '@/components/dashboard/DashboardBottomNav';
// import CoholdLogoFile from "@/logo.png";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <RedirectIfNotOnboarded>
      <div className="min-h-screen flex flex-col bg-dashboard-bg text-dashboard-heading">
        
       {/* <header className="sticky top-0 z-30 flex items-center justify-between border-b border-dashboard-border bg-dashboard-card/95 backdrop-blur px-4 py-3 md:px-6">
          
          <h1 className="text-sm font-semibold text-dashboard-heading flex items-center gap-2">
            <Image 
              src={CoholdLogoFile} 
              alt="Cohold Logo" 
              width={28} 
              height={28} 
            />
          </h1>

          <div className="text-xs text-dashboard-body"></div>

        </header> */}

        <main className="flex-1 pb-20 md:pb-6">
          <div className="p-4 md:p-6 max-w-2xl mx-auto">{children}</div>
        </main>

        <DashboardBottomNav />

      </div>
    </RedirectIfNotOnboarded>
  );
}