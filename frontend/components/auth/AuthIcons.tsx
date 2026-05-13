/**
 * Icons for auth/onboarding screens (Figma). Gold stroke on pale-gold badge.
 */

const badge =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cohold-accent-border bg-cohold-accent-soft text-cohold-accent';

export function EnvelopeIcon({ className }: { className?: string }) {
  return (
    <div className={`${badge} ${className ?? ''}`} aria-hidden>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function PersonIcon({ className }: { className?: string }) {
  return (
    <div className={`${badge} ${className ?? ''}`} aria-hidden>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/** Location pin — residential address step */
export function PinIcon({ className }: { className?: string }) {
  return (
    <div className={`${badge} ${className ?? ''}`} aria-hidden>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M12 21s-8-4.5-8-11a8 8 0 1116 0c0 6.5-8 11-8 11z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    </div>
  );
}

/** @deprecated Use PinIcon for address step */
export function HouseIcon({ className }: { className?: string }) {
  return (
    <div className={`${badge} ${className ?? ''}`} aria-hidden>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M4 10.5L12 5l8 5.5V20H4V10.5z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function PencilIcon({ className }: { className?: string }) {
  return (
    <div className={`${badge} ${className ?? ''}`} aria-hidden>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function LockIcon({ className }: { className?: string }) {
  return (
    <div className={`${badge} ${className ?? ''}`} aria-hidden>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M7 11V8a5 5 0 0110 0v3M6 11h12a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7a2 2 0 012-2z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function KeyIcon({ className }: { className?: string }) {
  return (
    <div className={`${badge} ${className ?? ''}`} aria-hidden>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
