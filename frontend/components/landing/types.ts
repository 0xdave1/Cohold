export interface LandingStat {
  id: string;
  label: string;
  /** Display value; replace with API when live */
  value: string;
  /** When true, UI may show illustrative disclaimer */
  isPlaceholder?: boolean;
}

export interface LandingFeature {
  id: string;
  title: string;
  description: string;
  icon: 'fractional' | 'home' | 'land' | 'wallet' | 'verified';
}

export interface LandingStep {
  id: string;
  title: string;
  description: string;
  step: number;
}

export interface LandingOpportunity {
  id: string;
  title: string;
  location: string;
  category: string;
  yieldLabel: string;
  minEntryLabel: string;
  status: 'open' | 'waitlist' | 'closed';
  imageGradient: string;
}

export interface LandingTestimonial {
  id: string;
  quote: string;
  name: string;
  role: string;
  initials: string;
}

export interface LandingFaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface AppStoreBadge {
  id: string;
  name: string;
  subtitle: string;
  comingSoon: true;
}
