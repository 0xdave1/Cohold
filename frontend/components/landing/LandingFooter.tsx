import Image from 'next/image';
import Link from 'next/link';
import logo from '../../logo.png';

const FOOTER_COLUMNS = {
  product: [
    { href: '/landing#features', label: 'Features' },
    { href: '/landing#how-it-works', label: 'How it works' },
    { href: '/signup', label: 'Create account' },
  ],
  company: [
    { href: '/landing', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ],
  support: [
    { href: '/contact', label: 'Help center' },
    { href: '/privacy', label: 'Privacy policy' },
    { href: 'mailto:support@cohold.com', label: 'support@cohold.com' },
  ],
} as const;

const SOCIAL = [
  { href: 'https://twitter.com/coholdhq', label: 'X', icon: 'X' },
  { href: 'https://linkedin.com', label: 'LinkedIn', icon: 'in' },
] as const;

export function LandingFooter() {
  return (
    <footer className="bg-[#00406C] text-white">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div>
            <Link href="/landing" className="inline-flex items-center gap-2.5">
              <Image
                src={logo}
                alt="Cohold logo"
                width={40}
                height={40}
                className="h-10 w-10 rounded-lg object-contain"
              />
              <span className="text-xl font-bold">Cohold</span>
            </Link>

            <p className="mt-4 text-sm leading-relaxed text-white/75">
              Collaborative fractional real estate, land, and home ownership — built for investors who expect clarity and
              control.
            </p>

            <div className="mt-5 text-sm leading-relaxed text-white/75">
              <p className="font-semibold text-white">COHOLD LIMITED</p>
              <p className="mt-1">
                Registered Business Address: 14, 211 Road, Efab City Estate, Lifecamp, Gwarimpa, FCT, Nigeria.
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">Product</h3>
            <ul className="mt-4 space-y-3">
              {FOOTER_COLUMNS.product.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-white/85 transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">Company</h3>
            <ul className="mt-4 space-y-3">
              {FOOTER_COLUMNS.company.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-white/85 transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">Legal / Support</h3>
            <ul className="mt-4 space-y-3">
              {FOOTER_COLUMNS.support.map((l) => (
                <li key={l.label}>
                  {l.href.startsWith('mailto:') ? (
                    <a href={l.href} className="text-sm text-[#E8AB3E] hover:underline">
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className="text-sm text-white/85 transition-colors hover:text-white">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t border-white/15 pt-8 sm:flex-row">
          <div className="flex gap-3">
            {SOCIAL.map((s) => (
              <a
                key={s.href}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-sm font-semibold text-white/90 transition-colors hover:border-[#E8AB3E]/60 hover:text-[#E8AB3E]"
                aria-label={s.label}
              >
                {s.icon}
              </a>
            ))}
          </div>

          <p className="text-center text-xs text-white/45 sm:text-right">
            © {new Date().getFullYear()} Cohold. All rights reserved.
          </p>
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-white/40 sm:text-left">
          Cohold does not provide investment, tax, or legal advice. Opportunities involve risk, including loss of capital.
          Eligibility varies by jurisdiction. Past performance is not a reliable indicator of future results.
        </p>
      </div>
    </footer>
  );
} 
