import { FAQ_ITEMS } from './content';

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 bg-[#F7F4F0] px-4 py-20 md:px-6 md:py-24">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-center text-3xl font-bold tracking-tight text-[#1A1A1A] sm:text-4xl">
          Frequently Asked Questions
        </h2>
        <div className="mt-12 divide-y divide-black/[0.08] rounded-xl border border-black/[0.08] bg-white shadow-sm">
          {FAQ_ITEMS.map((item) => (
            <details key={item.id} className="group px-5 open:bg-[#F7F4F0]/30">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-left text-base font-semibold text-[#1A1A1A] marker:content-none">
                {item.question}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F7F4F0] text-[#00406C] group-open:rotate-180 transition-transform">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </summary>
              <p className="border-t border-black/[0.06] pb-4 pt-3 text-sm leading-relaxed text-[#1A1A1A]/65">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
