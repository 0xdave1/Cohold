import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contact Cohold support.',
};

export default function PublicContactPage() {
  return (
    <main className="min-h-dvh bg-[#F7F4F0] px-4 py-12 text-[#1A1A1A] md:px-6">
      <div className="mx-auto max-w-xl text-center">
        <Link href="/landing" className="inline-block text-sm font-semibold text-[#00406C] hover:underline">
          ← Back to Cohold
        </Link>
        <h1 className="mt-8 text-3xl font-bold text-[#00406C]">Contact us</h1>
        <p className="mt-4 text-[#1A1A1A]/70">
          For support, partnerships, or press — reach our team by email. We aim to respond within one business day.
        </p>
        <a
          href="mailto:support@cohold.com"
          className="mt-8 inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#00406C] px-8 text-sm font-semibold text-white hover:bg-[#003558] transition-colors"
        >
          support@cohold.com
        </a>
      </div>
    </main>
  );
}
