import Link from 'next/link';
import { landingOpportunities } from './data';

const statusLabel: Record<string, string> = {
  open: 'Open',
  waitlist: 'Waitlist',
  closed: 'Closed',
};

export function LandingFeatured() {
  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-white border-b border-black/[0.06]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-[#1A1A1A] sm:text-4xl">Featured opportunities</h2>
            <p className="mt-3 text-[#1A1A1A]/65 max-w-xl">
              Preview cards for layout—swap this grid for CMS or listings API when ready.
            </p>
          </div>
          <Link
            href="/signup"
            className="shrink-0 inline-flex min-h-[44px] items-center text-sm font-semibold text-[#00406C] hover:underline"
          >
            View all in app →
          </Link>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {landingOpportunities.map((o) => (
            <article
              key={o.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-[#F7F4F0]/40 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className={`h-36 bg-gradient-to-br ${o.imageGradient} relative`}>
                <span className="absolute left-4 top-4 rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-[#1A1A1A]">
                  {o.category}
                </span>
                <span className="absolute right-4 top-4 rounded-full bg-black/30 backdrop-blur px-2.5 py-0.5 text-xs font-medium text-white">
                  {statusLabel[o.status]}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-lg font-semibold text-[#1A1A1A]">{o.title}</h3>
                <p className="mt-1 text-sm text-[#1A1A1A]/55">{o.location}</p>
                <p className="mt-4 text-sm text-[#1A1A1A]/70">{o.yieldLabel}</p>
                <p className="mt-1 text-sm font-semibold text-[#00406C]">{o.minEntryLabel}</p>
                <div className="mt-auto pt-5">
                  <Link
                    href="/signup"
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-[#00406C]/25 bg-white text-sm font-semibold text-[#00406C] hover:bg-[#00406C]/5"
                  >
                    See details in app
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
