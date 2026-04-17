/**
 * Shared class names for auth/onboarding to match Figma.
 */
export const auth = {
  pageTitle: 'text-sm font-medium uppercase tracking-wide text-auth-body',
  card: 'rounded-auth-radius-lg bg-auth-card p-6 sm:p-8 shadow-[var(--auth-shadow-card)]',
  heading: 'text-[22px] font-bold leading-tight text-auth-heading',
  body: 'text-[15px] leading-relaxed text-auth-body',
  label: 'text-sm font-medium text-auth-heading',
  input:
    'w-full rounded-[10px] border border-[hsl(var(--auth-input-border))] bg-white px-3 py-2.5 text-[15px] text-auth-heading placeholder:text-auth-body outline-none focus:border-cohold-blue focus:ring-1 focus:ring-cohold-blue',
  inputWithIcon: 'pr-10',
  error: 'text-xs text-red-600',
  errorBox: 'rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600',
  btnPrimary:
    'w-full rounded-xl bg-cohold-blue py-3 text-[15px] font-semibold text-white shadow-[var(--auth-shadow)] hover:bg-[hsl(var(--cohold-blue-hover))] disabled:cursor-not-allowed disabled:opacity-60',
  link: 'font-semibold text-cohold-link underline hover:no-underline',
  footerText: 'text-center text-sm text-auth-body',
} as const;
