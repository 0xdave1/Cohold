import { KycEmailStatus, TransactionEmailKind } from '../types/email.types';

function shell(title: string, body: string): string {
  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:#f8f9fa;border-radius:8px;padding:30px;">
        <h1 style="color:#1e40af;margin:0 0 20px 0;">${title}</h1>
        ${body}
      </div>
    </body>
  </html>`;
}

export function otpTemplate(otp: string, purpose: string): string {
  const title = purpose === 'transaction' ? 'Confirm Transaction' : 'Verify Your Account';
  return shell(
    title,
    `<p>Your verification code is:</p>
     <div style="background:#fff;border:2px dashed #1e40af;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
       <div style="font-size:32px;letter-spacing:8px;color:#1e40af;font-weight:700;">${otp}</div>
     </div>
     <p style="font-size:14px;color:#666;">This code expires in 10 minutes. Never share it.</p>`,
  );
}

export function welcomeTemplate(firstName?: string): string {
  return shell(
    `Welcome to Cohold${firstName ? `, ${firstName}` : ''}!`,
    `<p>Thank you for joining Cohold.</p>
     <p>Complete your KYC verification and start investing in fractional real estate.</p>`,
  );
}

export function passwordResetSuccessTemplate(): string {
  return shell(
    'Password Changed Successfully',
    `<p>Your password has been reset successfully.</p>
     <p>If this was not you, contact support immediately and secure your account.</p>`,
  );
}

export function kycTemplate(status: KycEmailStatus, reason?: string): string {
  if (status === 'submitted') {
    return shell('KYC Submitted', '<p>Your KYC documents were submitted and are under review.</p>');
  }
  if (status === 'approved') {
    return shell('KYC Approved', '<p>Your KYC verification has been approved.</p>');
  }
  return shell(
    'KYC Requires Attention',
    `<p>Your KYC verification was not approved.</p>${reason ? `<p>Reason: ${reason}</p>` : ''}`,
  );
}

export function transactionTemplate(
  kind: TransactionEmailKind,
  amount: string,
  currency: string,
  details?: Record<string, unknown>,
): string {
  const labels: Record<TransactionEmailKind, string> = {
    deposit: 'Wallet Deposit',
    withdrawal_request: 'Withdrawal Requested',
    withdrawal_success: 'Withdrawal Successful',
    withdrawal_failure: 'Withdrawal Failed',
    transfer_incoming: 'Money Received',
    transfer_outgoing: 'Transfer Sent',
    investment_success: 'Investment Successful',
    investment_sale: 'Investment Sale Completed',
    roi_payout: 'ROI Payout Received',
  };
  const title = labels[kind];
  const ref = typeof details?.reference === 'string' ? details.reference : 'N/A';
  return shell(
    title,
    `<p>${title} for <strong>${currency} ${amount}</strong>.</p>
     <p style="font-size:14px;color:#666;">Reference: ${ref}</p>`,
  );
}
