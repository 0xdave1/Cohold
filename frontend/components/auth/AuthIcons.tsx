/**
 * Icons for auth/onboarding screens (Figma). Same rounded square container as logo.
 */

const iconWrapperClass = 'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-cohold-icon-bg';

export function EnvelopeIcon({ className }: { className?: string }) {
  return (
    <div className={`${iconWrapperClass} ${className ?? ''}`} aria-hidden>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-auth-heading">
        <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function PersonIcon({ className }: { className?: string }) {
  return (
    <div className={`${iconWrapperClass} ${className ?? ''}`} aria-hidden>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-auth-heading">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function HouseIcon({ className }: { className?: string }) {
  return (
    <div className={`${iconWrapperClass} ${className ?? ''}`} aria-hidden>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-auth-heading">
        <path d="M4 10.5L12 5l8 5.5V20H4V10.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function PencilIcon({ className }: { className?: string }) {
  return (
    <div className={`${iconWrapperClass} ${className ?? ''}`} aria-hidden>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-auth-heading">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
