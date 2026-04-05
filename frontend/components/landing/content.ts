/**
 * Landing page content — swap via CMS/API later. No fabricated traction metrics.
 */

export interface NavLink {
  href: string;
  label: string;
}

export const LANDING_NAV_LINKS: NavLink[] = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#faq', label: 'FAQ' },
];

export type ValuePropIconKey = 'fractional' | 'home' | 'land' | 'wallet' | 'verified' | 'chart';

export interface ValueProp {
  id: string;
  title: string;
  description: string;
  icon: ValuePropIconKey;
}

export const VALUE_PROPS: ValueProp[] = [
  {
    id: 'fractional',
    title: 'Fractional Ownership',
    description: 'Invest alongside others in vetted property opportunities — without buying the whole asset yourself.',
    icon: 'fractional',
  },
  {
    id: 'home',
    title: 'Own a Home',
    description: 'Explore ownership-aligned paths designed to stay transparent as you move through each step.',
    icon: 'home',
  },
  {
    id: 'land',
    title: 'Land Investment',
    description: 'Review land-backed listings with documentation and context before you commit.',
    icon: 'land',
  },
  {
    id: 'wallet',
    title: 'Multi-Currency Wallet',
    description: 'Hold and move supported currencies with a clear view of balances and activity.',
    icon: 'wallet',
  },
  {
    id: 'verified',
    title: 'Verified Properties',
    description: 'Listings go through review before publication — you see substance, not hype.',
    icon: 'verified',
  },
  {
    id: 'portfolio',
    title: 'Portfolio Tracking',
    description: 'Keep positions and updates organised in one place as your activity grows.',
    icon: 'chart',
  },
];

export interface HowStep {
  id: string;
  step: string;
  title: string;
  description: string;
}

export const HOW_IT_WORKS: HowStep[] = [
  {
    id: 'account',
    step: '1',
    title: 'Create Account',
    description: 'Sign up and complete verification to see what is available in your region.',
  },
  {
    id: 'fund',
    step: '2',
    title: 'Fund Wallet',
    description: 'Add funds when you are ready. You choose if and when to invest.',
  },
  {
    id: 'invest',
    step: '3',
    title: 'Invest & Own',
    description: 'Review listings, documents, and risks — then allocate on your own terms.',
  },
  {
    id: 'track',
    step: '4',
    title: 'Track & Stay Informed',
    description: 'Follow updates, statements, and communications for your positions in one dashboard.',
  },
];

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'f1',
    question: 'What is Cohold?',
    answer:
      'Cohold is a platform for collaborative real estate investing — fractional property, land, and ownership-aligned opportunities, with wallets and tools to stay organised.',
  },
  {
    id: 'f2',
    question: 'Who can use Cohold?',
    answer:
      'Availability depends on your region, verification status, and the rules of each product. Create an account to see what applies to you.',
  },
  {
    id: 'f3',
    question: 'How are listings reviewed?',
    answer:
      'We review documentation and context before a listing goes live. Always read the full materials and risk disclosures in the product.',
  },
  {
    id: 'f4',
    question: 'Are returns guaranteed?',
    answer:
      'No. Investing involves risk, including loss of capital. Nothing on this page is an offer or a promise of performance.',
  },
  {
    id: 'f5',
    question: 'When will mobile apps be available?',
    answer:
      'Native iOS and Android apps are in development. You can use Cohold on the web today; join the notify list to hear when apps launch.',
  },
];
