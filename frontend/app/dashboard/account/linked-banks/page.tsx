'use client';

import Link from 'next/link';
import { useLinkedBanks, useRemoveLinkedBank } from '@/lib/hooks/use-linked-banks';
import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/EmptyState';

export default function LinkedBanksPage() {
  const { data: banks = [], isLoading } = useLinkedBanks();
  const removeBank = useRemoveLinkedBank();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<{ id: string } | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await removeBank.mutateAsync(id);
      setShowDeleteModal(null);
    } catch (e) {
      // show error
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-dashboard-bg pb-24">
      <div className="space-y-6 px-4 pt-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/account" className="p-2 rounded-lg hover:bg-dashboard-border/50 text-dashboard-heading" aria-label="Back">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-xl font-semibold text-dashboard-heading">Linked banks</h1>
        </div>
        <p className="text-sm text-dashboard-body">Manage your linked banks</p>

        {isLoading ? (
          <div className="rounded-2xl border border-dashboard-border bg-dashboard-card p-6 animate-pulse">
            <div className="h-20 bg-dashboard-border/50 rounded mb-3" />
            <div className="h-20 bg-dashboard-border/50 rounded" />
          </div>
        ) : (
          <div className="space-y-3">
            {banks.length === 0 && (
              <EmptyState
                title="You do not have any linked bank account."
                message="Click on the button below to add your first bank and withdraw funds into your account."
                icon={<Building2 className="h-7 w-7" />}
                cta={{ label: 'Add a bank', href: '/dashboard/account/linked-banks/add' }}
                className="p-8"
              />
            )}
            {banks.length > 0 &&
              banks.map((bank) => (
                <div key={bank.id} className="rounded-2xl border border-dashboard-border bg-dashboard-card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-cohold-icon-bg flex items-center justify-center text-dashboard-body">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-mono font-semibold text-dashboard-heading">{bank.accountNumber}</p>
                      <p className="text-xs text-dashboard-body">{bank.accountName} - {bank.bankName}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal({ id: bank.id })}
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              ))}
          </div>
        )}

        {banks.length > 0 && (
          <div className="flex gap-3">
            <Link href="/dashboard/account/linked-banks/add" className="flex-1 rounded-xl border border-cohold-blue py-3 text-center text-sm font-medium text-cohold-blue">
              Add a bank
            </Link>
            <button type="button" className="flex-1 rounded-xl bg-cohold-blue py-3 text-sm font-medium text-white">
              Save changes
            </button>
          </div>
        )}
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-dashboard-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-dashboard-heading mb-2">Delete bank</h2>
            <p className="text-sm text-dashboard-body mb-6">By deleting this linked bank, you will not be able to make withdrawals into the account. Are you sure you want to delete this linked bank?</p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => handleDelete(showDeleteModal.id)}
                disabled={deletingId === showDeleteModal.id}
                className="w-full rounded-xl bg-red-500/90 py-3 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deletingId === showDeleteModal.id ? 'Deleting...' : 'Yes, delete'}
              </button>
              <button type="button" onClick={() => setShowDeleteModal(null)} className="w-full rounded-xl border border-dashboard-border py-3 text-sm font-medium text-dashboard-heading">
                No, cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
