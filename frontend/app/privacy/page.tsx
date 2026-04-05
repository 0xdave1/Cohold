import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'Cohold privacy policy — how we handle your data.',
};

export default function PublicPrivacyPage() {
  return (
    <main className="min-h-dvh bg-[#F7F4F0] px-4 py-12 text-[#1A1A1A] md:px-6">
      <div className="mx-auto max-w-2xl">
        <Link href="/landing" className="text-sm font-semibold text-[#00406C] hover:underline">
          ← Back to Cohold
        </Link>
        <h1 className="mt-8 text-3xl font-bold text-[#00406C]">Privacy policy</h1>
        <div className="mt-8 space-y-4 rounded-2xl border border-black/[0.08] bg-white p-6 text-sm leading-relaxed text-[#1A1A1A]/80 shadow-sm">
          <p>We respect your privacy and are committed to protecting your personal data.</p>
          <h2 className="text-base font-semibold text-[#1A1A1A] pt-2">Information we collect</h2>
          <p>
            We collect information you provide when you register, complete KYC, make investments, or contact support. This
            may include name, email, phone, address, and identity documents.
          </p>
          <h2 className="text-base font-semibold text-[#1A1A1A] pt-2">How we use it</h2>
          <p>
            We use your data to operate the platform, verify your identity, process transactions, and communicate with you.
            We do not sell your personal information.
          </p>
          <h2 className="text-base font-semibold text-[#1A1A1A] pt-2">Security</h2>
          <p>We use industry-standard measures to protect your data. Access is restricted to authorised personnel only.</p>
          <p className="pt-4 text-[#1A1A1A]/55">
            Questions?{' '}
            <a href="mailto:privacy@cohold.com" className="font-medium text-[#00406C] hover:underline">
              privacy@cohold.com
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
