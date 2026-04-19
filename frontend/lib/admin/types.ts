/** Admin row / detail — UI roles align with backend mapping (see admin-management constants). */
export interface AdminUser {
  id: string;
  adminId?: string;
  fullName?: string | null;
  email: string;
  role:
    | 'DATA_UPLOADER'
    | 'APPROVER'
    | 'SUPER_ADMIN'
    | 'FINANCE_ADMIN'
    | 'OPERATION_ADMIN'
    | 'COMPLIANCE_ADMIN';
  status?: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  lastLoginAt?: string | null;
  lastLoggedInAt?: string | null;
  phoneNumber?: string | null;
  createdAt: string;
}

export interface AdminFilters {
  search?: string;
  role?: 'SUPER_ADMIN' | 'FINANCE_ADMIN' | 'OPERATION_ADMIN' | 'COMPLIANCE_ADMIN';
  status?: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  period?: 'today' | '7d' | '30d' | '180d';
}

export interface DashboardOverview {
  totalUsers: number;
  totalVerifiedUsers: number;
  totalUnverifiedUsers: number;
  totalCoholds: number;
  totalInvestments: { NGN: string; USD: string; GBP: string; EUR: string };
  walletBalances: { NGN: string; USD: string; GBP: string; EUR: string };
  activeListings: number;
  fractionalListings: number;
  landListings: number;
  ownAHomeListings: number;
  coholdRevenue: string;
  pendingKyc: number;
  openDisputes: number;
}

export interface PlatformUser {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  phoneCountryCode: string | null;
  nationality: string | null;
  kycStatus: string;
  isFrozen: boolean;
  onboardingCompletedAt: string | null;
  accountNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserDetail extends PlatformUser {
  houseNumber: string | null;
  streetName: string | null;
  city: string | null;
  state: string | null;
  bvn: string | null;
  wallets: { id: string; currency: string; balance: string }[];
  investments: { id: string; propertyId: string; amount: string; currency: string; shares: string; status: string }[];
  linkedBanks: { id: string; accountNumber: string; bankName: string; accountName: string; currency: string }[];
  totalInvested: string;
  walletBalance: string;
  totalReferrals: number;
}

export interface UserTransaction {
  id: string;
  reference: string;
  externalReference: string | null;
  type: string;
  status: string;
  amount: string;
  currency: string;
  direction: string;
  metadata: Record<string, any> | null;
  walletId: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KycVerification {
  id: string;
  userId: string;
  user: { email: string; firstName: string | null; lastName: string | null };
  governmentIdType: string | null;
  governmentIdNumber: string | null;
  status: string;
  createdAt: string;
}

export interface PropertyListing {
  id: string;
  title: string;
  description: string;
  location: string;
  status: string;
  totalValue: string;
  sharePrice: string;
  currency: string;
  minInvestment: string;
  currentRaised: string;
  sharesTotal: string;
  sharesSold: string;
  listingType: string;
  investorCount: number;
  createdAt: string;
}

export interface PropertyDetail extends PropertyListing {
  documents: { id: string; type: string; s3Key: string; url: string | null; createdAt: string }[];
  images: { id: string; url: string | null; position: number; createdAt: string; storageKey?: string | null }[];
  totalInvestors: number;
  yieldPercentage: string;
  features: string[];
  terms: string;
}

export interface PropertyInvestor {
  id: string;
  userName: string;
  email: string;
  amount: string;
  currency: string;
  shares: string;
  ownershipPercent: string;
  createdAt: string;
}

export interface WalletTransaction {
  id: string;
  reference: string;
  type: string;
  status: string;
  amount: string;
  currency: string;
  direction: string;
  userId: string | null;
  user?: { email: string; firstName: string | null; lastName: string | null };
  createdAt: string;
}

export interface Dispute {
  id: string;
  userId: string;
  user: { email: string; firstName: string | null; lastName: string | null };
  propertyId: string | null;
  property?: { title: string } | null;
  issue: string;
  status: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    meta: { page: number; limit: number; total: number };
  };
}
