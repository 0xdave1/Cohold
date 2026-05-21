import { ValidationPipe } from '@nestjs/common';
import { InitializePaymentDto } from './initialize-payment.dto';

describe('InitializePaymentDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    forbidUnknownValues: true,
    validationError: { target: false, value: false },
  });

  async function validate(body: Record<string, unknown>) {
    return pipe.transform(body, { type: 'body', metatype: InitializePaymentDto } as never);
  }

  it.each(['1500', '1500.5', '1500.50'])('accepts amountNaira %s', async (amountNaira) => {
    const out = (await validate({ amountNaira })) as InitializePaymentDto;
    expect(out.amountNaira).toBe(amountNaira);
  });

  it.each(['1500.555', '1,500.50', 'abc', '-100', '0', ''])(
    'rejects amountNaira %s',
    async (amountNaira) => {
      await expect(validate({ amountNaira })).rejects.toThrow();
    },
  );

  it('rejects extra currency field', async () => {
    await expect(validate({ amountNaira: '1500', currency: 'NGN' })).rejects.toThrow();
  });

  it('rejects legacy amount field', async () => {
    await expect(validate({ amount: 1500 })).rejects.toThrow();
  });
});
