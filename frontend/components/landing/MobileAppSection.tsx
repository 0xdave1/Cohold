import type { ReactNode } from 'react';

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path strokeLinecap="round" d="M10 18h4" />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 20.5v-17l18.5 8.5L3 20.5zm2.5-13.8v11.6L16.2 12 5.5 6.7z" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

function StoreSoonButton({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative w-full sm:flex-1">
      <span className="absolute -right-1 -top-2 z-10 rounded bg-[#E8AB3E] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
        SOON
      </span>
      <button
        type="button"
        disabled
        className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl border border-[#1A1A1A]/12 bg-[#F0EFEC] px-4 py-4 text-left text-[#1A1A1A]/50 shadow-sm"
        aria-disabled="true"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center text-[#1A1A1A]/35">{icon}</span>
        <span className="text-sm leading-snug">{children}</span>
      </button>
    </div>
  );
}

export function MobileAppSection() {
  return (
    <section id="mobile-apps" className="bg-[#F7F4F0] px-4 py-20 md:px-6 md:py-24">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-[#E8AB3E]/25">
          <PhoneIcon className="h-9 w-9 text-[#B45309]" />
        </div>

        <h2 className="mt-8 text-2xl font-bold tracking-tight text-[#1A1A1A] sm:text-3xl">Mobile App Coming Soon</h2>

        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-[#1A1A1A]/60">
          We&apos;re building native iOS and Android apps so you can manage your investments on the go. Be the first to know
          when we launch.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:gap-4">
          <StoreSoonButton icon={<AppleIcon className="h-7 w-7" />}>
            Coming Soon on <span className="font-bold text-[#1A1A1A]/45">App Store</span>
          </StoreSoonButton>
          <StoreSoonButton icon={<PlayIcon className="h-6 w-6" />}>
            Coming Soon on <span className="font-bold text-[#1A1A1A]/45">Google Play</span>
          </StoreSoonButton>
        </div>

        <a
          href="mailto:support@cohold.com?subject=Notify%20me%20when%20the%20Cohold%20app%20launches"
          className="mt-10 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#1A1A1A]/15 bg-white px-6 py-3 text-sm font-semibold text-[#1A1A1A] shadow-sm transition-colors hover:border-[#00406C]/25 hover:bg-[#F7F4F0]"
        >
          <BellIcon className="h-5 w-5 text-[#1A1A1A]/70" />
          Notify Me When It Launches
        </a>
      </div>
    </section>
  );
}
