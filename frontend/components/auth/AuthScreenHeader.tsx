import Link from 'next/link';

type AuthScreenHeaderProps = {
  backHref: string;
  backLabel?: string;
};

export function AuthScreenHeader({ backHref, backLabel = 'Back' }: AuthScreenHeaderProps) {
  return (
    <div className="-mt-1 mb-1 flex items-center">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm font-medium text-cohold-text hover:text-cohold-primary"
        aria-label={backLabel}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </Link>
    </div>
  );
}
