import { HOW_IT_WORKS } from './content';

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-y border-black/[0.06] bg-white px-4 py-20 md:px-6 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[#1A1A1A] sm:text-4xl">How it works</h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-[#1A1A1A]/65">From signup to portfolio — four straightforward steps.</p>
        </div>
        <ol className="mt-16 grid grid-cols-1 gap-10 md:grid-cols-4 md:gap-0">
          {HOW_IT_WORKS.map((step) => (
            <li
              key={step.id}
              className="flex flex-col items-center border-[#E8AB3E]/25 text-center md:border-r md:px-4 md:last:border-r-0"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#E8AB3E] text-lg font-bold text-[#1A1A1A] shadow-md shadow-[#E8AB3E]/25">
                {step.step}
              </span>
              <h3 className="mt-5 text-lg font-bold text-[#1A1A1A]">{step.title}</h3>
              <p className="mt-2 max-w-[220px] text-sm leading-relaxed text-[#1A1A1A]/65">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
