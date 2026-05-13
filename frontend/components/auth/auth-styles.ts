/**
 * Shared class names for auth/onboarding to match Figma.
 */
export const auth = {
  pageTitle: 'sr-only',
  card: 'rounded-xl border border-cohold-border/40 bg-white p-5 shadow-[var(--auth-shadow-card)] sm:p-6',
  heading: 'text-xl font-bold leading-tight tracking-tight text-cohold-text sm:text-[22px]',
  body: 'text-[15px] leading-relaxed text-cohold-muted',
  label: 'text-sm font-medium text-cohold-text',
  input:
    'w-full rounded-xl border border-cohold-border bg-white px-3 py-2.5 text-[15px] text-cohold-text placeholder:text-cohold-muted/80 outline-none transition-[box-shadow,border-color] focus:border-cohold-primary focus:ring-1 focus:ring-cohold-primary',
  inputWithIcon: 'pr-10',
  otpCell:
    'h-12 w-10 rounded-xl border border-cohold-border bg-white text-center text-lg font-semibold text-cohold-text tabular-nums outline-none focus:border-cohold-primary focus:ring-1 focus:ring-cohold-primary sm:h-12 sm:w-11',
  error: 'text-xs text-red-600',
  errorBox: 'rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600',
  btnPrimary:
    'w-full rounded-xl bg-cohold-primary py-3 text-[15px] font-semibold text-white shadow-[var(--auth-shadow)] transition-colors hover:bg-cohold-primary-hover disabled:cursor-not-allowed disabled:opacity-60',
  link: 'font-semibold text-cohold-primary underline underline-offset-2 hover:text-cohold-primary-hover hover:no-underline',
  footerText: 'text-center text-sm text-cohold-muted',
} as const;
