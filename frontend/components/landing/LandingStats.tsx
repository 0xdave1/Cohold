import { landingStats } from './data';

export function LandingStats() {
  return (
    <section className="border-y border-black/[0.06] bg-[#00406C] py-14 sm:py-16 text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-medium uppercase tracking-wider text-white/70">
          Platform snapshot — illustrative examples
        </p>
        <div className="mt-10 grid grid-cols-2 gap-8 lg:grid-cols-4">
          {landingStats.map((s) => (
            <div key={s.id} className="text-center lg:text-left">
              <p className="text-3xl sm:text-4xl font-bold tracking-tight text-[#E8AB3E]">{s.value}</p>
              <p className="mt-2 text-sm font-medium text-white/85">{s.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-white/55 max-w-2xl mx-auto leading-relaxed">
          Figures above are placeholders for layout. Replace with live metrics from your data pipeline when available.
        </p>
      </div>
    </section>
  );
}
