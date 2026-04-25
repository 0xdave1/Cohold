'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Lock,
  Wallet,
  Gift,
  Building2,
  Fingerprint,
  MessageCircle,
  FileText,
  ShieldCheck,
  LogOut,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMe } from '@/lib/hooks/use-onboarding';
import { useKycStatus } from '@/lib/hooks/use-kyc';
import { useAuthStore } from '@/stores/auth.store';
import { AccountSettingRow } from '@/components/account/AccountSettingRow';
import { LogoutModal } from '@/components/account/LogoutModal';
import { DeleteAccountModals } from '@/components/account/DeleteAccountModals';

function getInitials(firstName?: string | null, lastName?: string | null, email?: string): string {
  if (firstName && lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return 'U';
}

export default function AccountPage() {
  const { logout, logoutAll } = useAuth();
  const { data: me } = useMe();
  const { data: kycData } = useKycStatus();
  const { user } = useAuthStore();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const displayName = me?.firstName ?? user?.firstName ?? 'User';
  const initials = getInitials(me?.firstName, me?.lastName, user?.email ?? me?.email ?? '');
  const userEmail = me?.email ?? user?.email ?? '';
  const profileImage = me?.profilePhotoUrl ?? me?.profileImageUrl ?? null;

  const kycTag = kycData?.status === 'PENDING' ? 'Pending' : undefined;

  return (
    <div className="min-h-screen bg-dashboard-bg pb-20">
      <div className="space-y-6 px-4 pt-4">
        <h1 className="text-xl font-semibold text-dashboard-heading">Accounts</h1>

        {/* Profile block */}
        <div className="flex items-center gap-4 rounded-xl border border-dashboard-border bg-dashboard-card px-4 py-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cohold-icon-bg text-lg font-semibold text-dashboard-heading">
            {profileImage ? (
              <Image
                src={profileImage}
                alt={displayName}
                fill
                sizes="56px"
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-dashboard-heading">{displayName}</p>
            <Link
              href="/dashboard/account/edit"
              className="inline-flex items-center gap-1 text-sm text-cohold-blue hover:underline"
            >
              Edit profile
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Accounts */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-dashboard-body">Accounts</h2>
          <div className="space-y-2">
            <AccountSettingRow
              href="/dashboard/kyc"
              icon={<Lock className="h-5 w-5" />}
              label="Account verification"
              tag={kycTag}
            />
            <AccountSettingRow
              href="/dashboard/account/transactions"
              icon={<Wallet className="h-5 w-5" />}
              label="Transactions"
            />
            <AccountSettingRow
              href="/dashboard/account/referrals"
              icon={<Gift className="h-5 w-5" />}
              label="Referrals"
            />
            <AccountSettingRow
              href="/dashboard/account/linked-banks"
              icon={<Building2 className="h-5 w-5" />}
              label="Linked banks"
            />
          </div>
        </section>

        {/* Security */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-dashboard-body">Security</h2>
          <div className="space-y-2">
            <AccountSettingRow
              href="/dashboard/account/biometrics"
              icon={<Fingerprint className="h-5 w-5" />}
              label="Biometrics"
            />
            <AccountSettingRow
              href="/dashboard/account/password-reset"
              icon={<Lock className="h-5 w-5" />}
              label="Password reset"
            />
          </div>
        </section>

        {/* About Cohold */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-dashboard-body">About Cohold</h2>
          <div className="space-y-2">
            <AccountSettingRow
              href="/dashboard/account/contact"
              icon={<MessageCircle className="h-5 w-5" />}
              label="Contact us"
            />
            <AccountSettingRow
              href="/dashboard/account/terms"
              icon={<FileText className="h-5 w-5" />}
              label="Terms & Conditions"
            />
            <AccountSettingRow
              href="/dashboard/account/privacy"
              icon={<ShieldCheck className="h-5 w-5" />}
              label="Privacy policy"
            />
          </div>
        </section>

        {/* Actions */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-dashboard-body">Actions</h2>
          <div className="space-y-2">
            <AccountSettingRow
              icon={<LogOut className="h-5 w-5" />}
              label="Logout"
              onClick={() => setShowLogoutModal(true)}
            />
            <AccountSettingRow
              icon={<ShieldCheck className="h-5 w-5" />}
              label="Log out all devices"
              onClick={() => {
                logoutAll();
              }}
            />
            <AccountSettingRow
              icon={<Trash2 className="h-5 w-5" />}
              label="Delete account"
              destructive
              onClick={() => setShowDeleteModal(true)}
            />
          </div>
        </section>
      </div>

      {showLogoutModal && (
        <LogoutModal
          onClose={() => setShowLogoutModal(false)}
          onConfirm={() => {
            setShowLogoutModal(false);
            logout();
          }}
        />
      )}

      {showDeleteModal && (
        <DeleteAccountModals
          userEmail={userEmail}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
