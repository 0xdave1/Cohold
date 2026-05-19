/** Figma admin design tokens (frontend-only). */
export const adminTheme = {
  primary: '#054870',
  primaryHover: '#003D5F',
  bg: '#F5F1EC',
  card: '#FFFFFF',
  border: '#DDD8D2',
  muted: '#6F6A64',
  text: '#171717',
  success: '#16A34A',
  danger: '#DC2626',
  sidebarActiveBg: '#F0EEEA',
} as const;

export const adminShellClass = {
  mainBg: 'min-h-screen bg-[#F5F1EC]',
  card: 'rounded-xl border border-[#DDD8D2] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
  pageTitle: 'text-xl font-semibold text-[#171717]',
  sectionTitle: 'text-sm font-semibold text-[#171717]',
  muted: 'text-[#6F6A64]',
} as const;
