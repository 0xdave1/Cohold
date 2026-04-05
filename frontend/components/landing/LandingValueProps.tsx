import { landingFeatures } from './data';
import { FeatureIcon } from './FeatureIcon';

export function LandingValueProps() {
  return (
    <section id="offerings" className="scroll-mt-20 border-b border-black/[0.06] bg-white py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-[#1A1A1A] sm:text-4xl">What you can do on Cohold</h2>
          <p className="mt-4 text-lg text-[#1A1A1A]/65 leading-relaxed">
            One platform for exposure to property-backed opportunities—with the wallet and portfolio tools to match.
          </p>
        </div>
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {landingFeatures.map((f) => (
            <li
              key={f.id}
              className="group rounded-2xl border border-black/[0.06] bg-[#F7F4F0]/50 p-6 transition-shadow hover:shadow-lg hover:shadow-[#00406C]/5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white border border-black/[0.06] shadow-sm">
                <FeatureIcon icon={f.icon} />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-[#1A1A1A]">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#1A1A1A]/65">{f.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
