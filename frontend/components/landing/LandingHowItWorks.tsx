import { landingSteps } from './data';

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 py-16 sm:py-20 lg:py-24 bg-[#F7F4F0]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-[#1A1A1A] sm:text-4xl">How it works</h2>
          <p className="mt-4 text-lg text-[#1A1A1A]/65">Three calm steps from curiosity to conviction.</p>
        </div>
        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {landingSteps.map((s) => (
            <li key={s.id} className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00406C] text-lg font-bold text-white shadow-md">
                {s.step}
              </div>
              <h3 className="mt-5 text-xl font-semibold text-[#1A1A1A]">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#1A1A1A]/65">{s.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
