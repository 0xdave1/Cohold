import Image from 'next/image';
import CoholdLogoFile from '@/logo.png';

/**
 * Cohold logo for auth flows — pale blue rounded badge (Figma).
 */
export function CoholdLogo({ className }: { className?: string }) {
  return (
    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cohold-logo-soft ${className ?? ''}`}>
      <Image src={CoholdLogoFile} alt="Cohold" width={32} height={32} className="h-8 w-8 object-contain" />
    </div>
  );
}
