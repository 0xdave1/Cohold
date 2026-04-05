import type {
  AppStoreBadge,
  LandingFaqItem,
  LandingFeature,
  LandingOpportunity,
  LandingStat,
  LandingStep,
  LandingTestimonial,
} from './types';

/** Swap with API/CMS when ready */
export const landingStats: LandingStat[] = [
  { id: 'investors', label: 'Investors (example)', value: '12,000+', isPlaceholder: true },
  { id: 'properties', label: 'Curated assets (example)', value: '180+', isPlaceholder: true },
  { id: 'countries', label: 'Markets we serve', value: '3', isPlaceholder: true },
  { id: 'portfolios', label: 'Portfolios tracked', value: '24k+', isPlaceholder: true },
];

export const landingFeatures: LandingFeature[] = [
  {
    id: 'fractional',
    title: 'Fractional ownership',
    description: 'Buy slices of vetted real estate alongside other investors—transparent pricing and clear ownership structure.',
    icon: 'fractional',
  },
  {
    id: 'home',
    title: 'Path to home ownership',
    description: 'Structured journeys toward owning a home, with guidance and tools built for long-term planning.',
    icon: 'home',
  },
  {
    id: 'land',
    title: 'Land & development',
    description: 'Access land-backed opportunities with documentation you can review before you commit.',
    icon: 'land',
  },
  {
    id: 'wallet',
    title: 'Secure wallet & portfolio',
    description: 'Multi-currency wallet, balances, and portfolio tracking in one place—built for clarity, not noise.',
    icon: 'wallet',
  },
  {
    id: 'verified',
    title: 'Verified listings',
    description: 'Properties go through diligence checkpoints so you know what you are looking at.',
    icon: 'verified',
  },
];

export const landingSteps: LandingStep[] = [
  {
    id: 'browse',
    step: 1,
    title: 'Browse',
    description: 'Explore fractional, land, and home-focused opportunities with clear terms.',
  },
  {
    id: 'fund',
    step: 2,
    title: 'Fund your wallet',
    description: 'Top up securely when you are ready—no obligation until you decide to invest.',
  },
  {
    id: 'invest',
    step: 3,
    title: 'Invest & track',
    description: 'Allocate capital, monitor performance, and stay informed as your portfolio evolves.',
  },
];

export const landingOpportunities: LandingOpportunity[] = [
  {
    id: '1',
    title: 'Lagos waterfront residences',
    location: 'Lagos, Nigeria',
    category: 'Fractional',
    yieldLabel: 'Target yield (example): 9–12% p.a.',
    minEntryLabel: 'From ₦50,000',
    status: 'open',
    imageGradient: 'from-[#00406C] to-[#0a5c8f]',
  },
  {
    id: '2',
    title: 'Abuja mixed-use corridor',
    location: 'Abuja, Nigeria',
    category: 'Land',
    yieldLabel: 'Long-term growth focus',
    minEntryLabel: 'From ₦100,000',
    status: 'waitlist',
    imageGradient: 'from-[#1a4a66] to-[#00406C]',
  },
  {
    id: '3',
    title: 'Accra urban renewal fund',
    location: 'Accra, Ghana',
    category: 'Portfolio',
    yieldLabel: 'Diversified exposure (example)',
    minEntryLabel: 'From $250',
    status: 'open',
    imageGradient: 'from-[#E8AB3E]/90 to-[#c98f2e]',
  },
];

export const landingTestimonials: LandingTestimonial[] = [
  {
    id: '1',
    quote:
      'I wanted exposure to property without managing tenants. Cohold made the process feel structured and understandable.',
    name: 'Amaka O.',
    role: 'Product designer, Lagos',
    initials: 'AO',
  },
  {
    id: '2',
    quote:
      'The wallet and portfolio view finally give me one place to see where my money is across opportunities.',
    name: 'James T.',
    role: 'Engineer, UK',
    initials: 'JT',
  },
  {
    id: '3',
    quote:
      'We are conservative investors—the emphasis on verification and clear docs mattered to us.',
    name: 'Chioma & Emeka',
    role: 'Small business owners',
    initials: 'CE',
  },
];

export const landingFaqs: LandingFaqItem[] = [
  {
    id: '1',
    question: 'What is collaborative fractional investing?',
    answer:
      'It means pooling capital with other investors to access real estate opportunities you might not take on alone, with ownership and terms spelled out upfront.',
  },
  {
    id: '2',
    question: 'Is my money safe?',
    answer:
      'Funds should only move through defined flows on the platform. All investments carry risk; read each opportunity’s materials and consult a professional if needed.',
  },
  {
    id: '3',
    question: 'Can I withdraw anytime?',
    answer:
      'Liquidity depends on the specific product. Some positions are longer-term; details are shown before you commit.',
  },
  {
    id: '4',
    question: 'Do you offer home ownership paths?',
    answer:
      'Yes—Cohold supports journeys toward home and land ownership alongside fractional listings. Availability varies by market.',
  },
  {
    id: '5',
    question: 'When will mobile apps launch?',
    answer:
      'Native iOS and Android apps are coming soon. Join via web today; we will notify waitlist subscribers when stores go live.',
  },
];

export const appStoreBadges: AppStoreBadge[] = [
  {
    id: 'ios',
    name: 'App Store',
    subtitle: 'iPhone & iPad',
    comingSoon: true,
  },
  {
    id: 'android',
    name: 'Google Play',
    subtitle: 'Android',
    comingSoon: true,
  },
];

export const landingNavLinks = [
  { href: '#offerings', label: 'Offerings' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#stories', label: 'Stories' },
  { href: '#faq', label: 'FAQ' },
] as const;
