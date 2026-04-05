import { VALUE_PROPS } from './content';
import { ValuePropIcon } from './ValuePropIcon';

export function ValuePropsSection() {
  return (
    <section id="features" className="scroll-mt-20 bg-[#F7F4F0] px-4 py-20 md:px-6 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#E8AB3E]">Why Cohold</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#1A1A1A] sm:text-4xl">
            Multiple Paths to Property Ownership
          </h2>
        </div>
        <ul className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {VALUE_PROPS.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-black/[0.06] bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E8AB3E]/20">
                <ValuePropIcon icon={p.icon} />
              </div>
              <h3 className="mt-5 text-lg font-bold text-[#1A1A1A]">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#1A1A1A]/65">{p.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
