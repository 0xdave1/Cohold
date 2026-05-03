'use client';

import { useEffect, useState } from 'react';
import { DashboardCard } from '@/components/admin/DashboardCard';
import { adminApi } from '@/lib/admin/api';
import { formatDecimalMoneyForDisplay } from '@/lib/money/format-display';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-NG').format(n);
}

function fmtMoney(amount: string | number, currency: string): string {
  const s = typeof amount === 'number' ? String(amount) : amount;
  return formatDecimalMoneyForDisplay(s, currency);
}

interface Overview {
  totalUsers: number;
  totalVerifiedUsers: number;
  totalUnverifiedUsers: number;
  totalCoholds: number;
  totalInvestments: Record<string, string>;
  walletBalances: Record<string, string>;
  activeListings: number;
  fractionalListings: number;
  landListings: number;
  ownAHomeListings: number;
  coholdRevenue: string;
  pendingKyc: number;
  openDisputes: number;
}

const FALLBACK: Overview = {
  totalUsers: 0, totalVerifiedUsers: 0, totalUnverifiedUsers: 0, totalCoholds: 0,
  totalInvestments: { NGN: '0', USD: '0', GBP: '0', EUR: '0' },
  walletBalances: { NGN: '0', USD: '0', GBP: '0', EUR: '0' },
  activeListings: 0, fractionalListings: 0, landListings: 0, ownAHomeListings: 0,
  coholdRevenue: '0', pendingKyc: 0, openDisputes: 0,
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<Overview>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.dashboard()
      .then((d: any) => {
        setData({
          totalUsers: d.usersCount ?? d.totalUsers ?? 0,
          totalVerifiedUsers: d.totalVerifiedUsers ?? 0,
          totalUnverifiedUsers: d.totalUnverifiedUsers ?? 0,
          totalCoholds: d.totalCoholds ?? 0,
          totalInvestments: d.totalInvestments ?? { NGN: d.totalAum ?? '0', USD: '0', GBP: '0', EUR: '0' },
          walletBalances: d.walletBalances ?? { NGN: '0', USD: '0', GBP: '0', EUR: '0' },
          activeListings: d.activeListings ?? d.properties?.length ?? 0,
          fractionalListings: d.fractionalListings ?? 0,
          landListings: d.landListings ?? 0,
          ownAHomeListings: d.ownAHomeListings ?? 0,
          coholdRevenue: d.coholdRevenue ?? '0',
          pendingKyc: d.pendingKyc ?? 0,
          openDisputes: d.openDisputes ?? 0,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-gray-200 bg-white" />
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    { title: 'Total users', value: fmt(data.totalUsers) },
    { title: 'Total verified users', value: fmt(data.totalVerifiedUsers) },
    { title: 'Total unverified users', value: fmt(data.totalUnverifiedUsers) },
    { title: 'Total coholds', value: fmt(data.totalCoholds) },
    { title: 'Total investments (NGN)', value: fmtMoney(data.totalInvestments.NGN, 'NGN') },
    { title: 'Total investments (USD)', value: fmtMoney(data.totalInvestments.USD, 'USD') },
    { title: 'Total investments (GBP)', value: fmtMoney(data.totalInvestments.GBP, 'GBP') },
    { title: 'Total investments (EUR)', value: fmtMoney(data.totalInvestments.EUR, 'EUR') },
    { title: 'Total wallet balance (NGN)', value: fmtMoney(data.walletBalances.NGN, 'NGN') },
    { title: 'Total wallet balance (USD)', value: fmtMoney(data.walletBalances.USD, 'USD') },
    { title: 'Total wallet balance (GBP)', value: fmtMoney(data.walletBalances.GBP, 'GBP') },
    { title: 'Total wallet balance (EUR)', value: fmtMoney(data.walletBalances.EUR, 'EUR') },
    { title: 'Active listings', value: fmt(data.activeListings) },
    { title: 'Active listings (Fractional)', value: fmt(data.fractionalListings) },
    { title: 'Active listings (Land)', value: fmt(data.landListings) },
    { title: 'Active listings (Own a home)', value: fmt(data.ownAHomeListings) },
  ];

  const bottomCards = [
    { title: 'Cohold revenue generated', value: fmtMoney(data.coholdRevenue, 'NGN') },
    { title: 'Pending KYC', value: fmt(data.pendingKyc) },
    { title: 'Open disputes', value: fmt(data.openDisputes) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <select className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700">
          <option>This month</option>
          <option>This week</option>
          <option>Today</option>
          <option>This year</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <DashboardCard key={c.title} title={c.title} value={c.value} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {bottomCards.map((c) => (
          <DashboardCard key={c.title} title={c.title} value={c.value} />
        ))}
      </div>
    </div>
  );
}
