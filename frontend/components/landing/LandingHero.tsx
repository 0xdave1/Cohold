import { ArrowRight, FileText, Shield, TrendingUp } from 'lucide-react';
import Link from 'next/link';

const TRUST_ITEMS = [
  { icon: Shield, label: 'Verified properties' },
  { icon: FileText, label: 'Documentation in one place' },
  { icon: TrendingUp, label: 'No guaranteed returns' },
] as const;

export function LandingHero() {
  return (
    <section className="relative overflow-hidden bg-[#FAF9F6]">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#E8AB3E]/[0.06] via-transparent to-transparent" />

      <div className="relative mx-auto max-w-3xl px-4 pb-16 pt-12 text-center md:pb-24 md:pt-20">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#E8AB3E]/35 bg-[#E8AB3E]/12 px-4 py-1.5 text-sm font-medium text-[#B45309] mb-8">
          <TrendingUp className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          <span>Collaborative Real Estate Investing</span>
        </div>

        <h1 className="text-4xl font-bold leading-tight tracking-tight text-[#1A1A1A] md:text-5xl lg:text-6xl lg:leading-[1.08]">
          <span className="block">Own Premium Real Estate,</span>
          <span className="mt-1 block">
            <span className="text-[#E8AB3E]">Together</span>
            <span className="text-[#1A1A1A]">.</span>
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#1A1A1A]/65 md:text-xl">
          Invest in verified properties from ₦1M. Build wealth through fractional ownership, land acquisition, and structured
          home ownership — all from one platform.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-full bg-[#00406C] px-8 text-base font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
          >
            Start Investing
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
          </Link>
          <a
            href="#features"
            className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-full border border-[#1A1A1A]/15 bg-white px-8 text-base font-semibold text-[#1A1A1A] shadow-sm transition-colors hover:bg-[#1A1A1A]/[0.02]"
          >
            Explore Opportunities
          </a>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-[#1A1A1A]/60 md:gap-x-10">
          {TRUST_ITEMS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0 text-[#00406C]" strokeWidth={1.75} aria-hidden />
              <span className="text-left font-medium text-[#1A1A1A]/70">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
