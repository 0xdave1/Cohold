import Image from "next/image";
import CoholdLogoFile from "@/logo.png";


/**
 * Cohold logo for auth flows using the real uploaded logo.
 * Keeps the rounded background and sizing from the original design.
 */
export function CoholdLogo({ className }: { className?: string }) {
  return (
    <div
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-cohold-icon-bg ${className ?? ''}`}
      aria-hidden
    >
      <Image
        src={CoholdLogoFile}   // <-- replace with your actual file name (logo.png, logo.svg, etc.)
        alt="Cohold logo"
        width={28}        // adjust if your logo needs different sizing
        height={28}
        className="object-contain"
      />
    </div>
  );
}
