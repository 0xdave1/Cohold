import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Building2,
  Boxes,
  Wallet,
  Receipt,
  AlertTriangle,
  UserCog,
  MessageSquare,
  Banknote,
  Scale,
  Landmark,
  ScrollText,
  Coins,
  ClipboardList,
  Inbox,
} from 'lucide-react';
import {
  canManageAdmins,
  canManageProperties,
  canManageSupport,
  canViewFinanceNav,
  canViewKyc,
  canViewLedgerReconciliation,
  canViewOps,
  canViewUsers,
  canViewVirtualAccountOps,
  type AdminDbRole,
} from '@/lib/admin/permissions';

export type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  visible: (role: AdminDbRole | null) => boolean;
  /** Match nested routes (default true). */
  matchPrefix?: boolean;
};

export type AdminNavGroup = {
  id: string;
  title: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'overview',
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard, visible: () => true },
      {
        label: 'Launch readiness',
        href: '/admin/launch-readiness',
        icon: ClipboardList,
        visible: (r) => canViewOps(r),
      },
      { label: 'Activity log', href: '/admin/activity-log', icon: ScrollText, visible: () => true },
    ],
  },
  {
    id: 'users',
    title: 'Users & Compliance',
    items: [
      { label: 'User management', href: '/admin/users', icon: Users, visible: (r) => canViewUsers(r) },
      { label: 'Verifications', href: '/admin/verifications', icon: ShieldCheck, visible: (r) => canViewKyc(r) },
      { label: 'Support', href: '/admin/support', icon: MessageSquare, visible: (r) => canManageSupport(r) },
      { label: 'Disputes', href: '/admin/disputes', icon: AlertTriangle, visible: (r) => canViewUsers(r) },
    ],
  },
  {
    id: 'properties',
    title: 'Properties & Investments',
    items: [
      {
        label: 'Property/Listings',
        href: '/admin/property-listings',
        icon: Building2,
        visible: (r) => canManageProperties(r),
      },
      {
        label: 'Cohold management',
        href: '/admin/coholds',
        icon: Boxes,
        visible: (r) => canManageProperties(r),
      },
      {
        label: 'Distributions',
        href: '/admin/distributions',
        icon: Receipt,
        visible: (r) => canManageProperties(r),
      },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    items: [
      { label: 'Withdrawals', href: '/admin/withdrawals', icon: Banknote, visible: (r) => canViewFinanceNav(r) },
      {
        label: 'Virtual accounts',
        href: '/admin/virtual-accounts',
        icon: Landmark,
        visible: (r) => canViewVirtualAccountOps(r),
      },
      {
        label: 'Wallet transactions',
        href: '/admin/wallet-transactions',
        icon: Wallet,
        visible: (r) => canViewFinanceNav(r),
      },
      {
        label: 'Ledger reconciliation',
        href: '/admin/ledger-reconciliation',
        icon: Scale,
        visible: (r) => canViewLedgerReconciliation(r),
      },
      { label: 'Fee logs', href: '/admin/fees', icon: Coins, visible: (r) => canViewFinanceNav(r) },
    ],
  },
  {
    id: 'system',
    title: 'System',
    items: [
      {
        label: 'Ops / Outbox',
        href: '/admin/dashboard#ops-outbox',
        icon: Inbox,
        visible: (r) => canViewOps(r),
        matchPrefix: false,
      },
      {
        label: 'Admin management',
        href: '/admin/admin-management',
        icon: UserCog,
        visible: (r) => canManageAdmins(r),
      },
    ],
  },
];

export function visibleAdminNavGroups(role: AdminDbRole | null): AdminNavGroup[] {
  return ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.visible(role)),
  })).filter((group) => group.items.length > 0);
}

export function flattenVisibleNavItems(role: AdminDbRole | null): AdminNavItem[] {
  return visibleAdminNavGroups(role).flatMap((g) => g.items);
}

export function isAdminNavActive(pathname: string, href: string, matchPrefix = true): boolean {
  const base = href.split('#')[0];
  if (pathname === base) return true;
  if (!matchPrefix) return false;
  return pathname.startsWith(base + '/');
}

/** All nav item hrefs (without hash) for SUPER_ADMIN — used in tests. */
export function allAdminNavHrefs(): string[] {
  return ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href.split('#')[0]));
}
