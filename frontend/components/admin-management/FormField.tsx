'use client';

import type { ReactNode } from 'react';

type FormFieldProps = {
  label: string;
  children: ReactNode;
  hint?: string;
};

export function FormField({ label, children, hint }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-[#374151]">{label}</label>
      {children}
      {hint ? <p className="text-[11px] text-[#9CA3AF]">{hint}</p> : null}
    </div>
  );
}
