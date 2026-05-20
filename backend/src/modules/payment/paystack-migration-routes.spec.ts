import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Paystack migration — no active Flutterwave routes', () => {
  it('payments controller registers Paystack initialize/verify only', () => {
    const src = readFileSync(join(process.cwd(), 'src/modules/payment/payments.controller.ts'), 'utf8');
    expect(src).toContain("@Post('initialize')");
    expect(src).toContain("@Get('verify/:reference')");
    expect(src).not.toMatch(/flutterwave/i);
  });

  it('webhook controller registers Paystack webhook only', () => {
    const src = readFileSync(join(process.cwd(), 'src/modules/webhook/webhook.controller.ts'), 'utf8');
    expect(src).toContain("@Post('paystack')");
    expect(src).not.toMatch(/flutterwave/i);
  });
});
