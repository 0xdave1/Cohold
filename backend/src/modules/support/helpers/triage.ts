import { SupportCategory } from '@prisma/client';

export type TriageSnapshot = {
  category: SupportCategory;
  isDispute: boolean;
  greeting: string;
  nextPrompt: string;
};

const OFFLINE_PROMPT =
  "Our support team is currently offline. Please drop your message with useful details like your transaction reference, property, amount, and screenshot if available. Customer care will respond as soon as an agent is active.";

export function triageGreeting(category: SupportCategory, agentOnline: boolean): TriageSnapshot {
  const isDispute = category === SupportCategory.DISPUTE;

  const greeting = 'Hi! I’m Cohold Support. I can help route your request to the right team.';

  const categoryLine: Record<SupportCategory, string> = {
    GENERAL_SUPPORT: 'General support',
    PAYMENT_ISSUE: 'Payment issue',
    WITHDRAWAL_ISSUE: 'Withdrawal issue',
    INVESTMENT_ISSUE: 'Investment issue',
    WALLET_ISSUE: 'Wallet issue',
    KYC_ISSUE: 'KYC issue',
    PROPERTY_ISSUE: 'Property issue',
    DISPUTE: 'Dispute',
  };

  const nextPrompt = agentOnline
    ? `Thanks — I’ve tagged this as “${categoryLine[category]}”. A support agent can join shortly.`
    : OFFLINE_PROMPT;

  return { category, isDispute, greeting, nextPrompt };
}

