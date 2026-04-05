import type { Metadata } from 'next';
import { FaqSection } from '@/components/landing/FaqSection';
import { HowItWorksSection } from '@/components/landing/HowItWorksSection';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { MobileAppSection } from '@/components/landing/MobileAppSection';
import { ValuePropsSection } from '@/components/landing/ValuePropsSection';

export const metadata: Metadata = {
  title: 'Invest in real estate, together',
  description:
    'Cohold — collaborative fractional real estate, land, and ownership-aligned investing with secure wallets and portfolio tools.',
  openGraph: {
    title: 'Cohold — Collaborative real estate investing',
    description:
      'Fractional property, land, and home ownership paths — multi-currency wallets and verified listings.',
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-[#F7F4F0] text-[#1A1A1A]">
      <LandingNavbar />
      <main>
        <LandingHero />
        <ValuePropsSection />
        <HowItWorksSection />
        <FaqSection />
        <MobileAppSection />
      </main>
      <LandingFooter />
    </div>
  );
}
