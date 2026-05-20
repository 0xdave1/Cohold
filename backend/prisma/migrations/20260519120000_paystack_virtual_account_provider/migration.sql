-- Add Paystack as active virtual account provider (keep FLUTTERWAVE for historical rows).
ALTER TYPE "VirtualAccountProvider" ADD VALUE 'PAYSTACK';
