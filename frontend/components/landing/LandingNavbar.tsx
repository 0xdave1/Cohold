'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { LANDING_NAV_LINKS } from './content';
import logo from '../../logo.png';

export function LandingNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-black/[0.06] bg-[#F7F4F0]/95 backdrop-blur-md">
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6">
        <Link href="/landing" className="relative z-10 flex items-center gap-2.5 shrink-0" onClick={() => setOpen(false)}>
          <Image src={logo} alt="Cohold" width={36} height={36} className="h-9 w-9 rounded-lg object-contain" priority />
          <span className="text-lg font-semibold tracking-tight text-[#1A1A1A]">Cohold</span>
        </Link>

        <nav
          className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:flex items-center gap-8 text-sm font-medium text-[#1A1A1A]/85"
          aria-label="Primary"
        >
          {LANDING_NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="whitespace-nowrap hover:text-[#00406C] transition-colors">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="relative z-10 hidden md:flex items-center gap-3 shrink-0">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-semibold text-[#1A1A1A] hover:text-[#00406C] transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-[#E8AB3E] px-5 py-2.5 text-sm font-semibold text-[#1A1A1A] shadow-sm hover:bg-[#e0a338] transition-colors"
          >
            Create account
          </Link>
        </div>

        <button
          type="button"
          className="relative z-10 md:hidden inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white text-[#1A1A1A]"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {open ? (
        <div className="md:hidden border-t border-black/[0.06] bg-[#F7F4F0] px-4 py-4 space-y-1">
          {LANDING_NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="block rounded-xl px-3 py-3 text-base font-medium text-[#1A1A1A] hover:bg-white/80"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <div className="flex flex-col gap-2 pt-3">
            <Link
              href="/login"
              className="flex min-h-[44px] items-center justify-center rounded-full border border-[#1A1A1A]/15 px-4 text-sm font-semibold text-[#1A1A1A]"
              onClick={() => setOpen(false)}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="flex min-h-[44px] items-center justify-center rounded-full bg-[#E8AB3E] px-4 text-sm font-semibold text-[#1A1A1A]"
              onClick={() => setOpen(false)}
            >
              Create account
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
