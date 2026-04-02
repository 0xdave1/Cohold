'use client';

type SupportPresenceToggleProps = {
  isOnline: boolean;
  loading?: boolean;
  onToggle: (next: boolean) => void;
};

export function SupportPresenceToggle({ isOnline, loading = false, onToggle }: SupportPresenceToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!isOnline)}
      disabled={loading}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
        isOnline
          ? 'border-[#16A34A]/30 bg-[#ECFDF3] text-[#027A48]'
          : 'border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]'
      } disabled:opacity-50`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-[#16A34A]' : 'bg-[#9CA3AF]'}`} />
      {isOnline ? 'Online' : 'Offline'}
    </button>
  );
}

