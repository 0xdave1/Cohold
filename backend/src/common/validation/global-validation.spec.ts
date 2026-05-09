import { ValidationPipe } from '@nestjs/common';
import { LoginDto } from '../../modules/auth/dto/login.dto';
import { InitializePaymentDto } from '../../modules/payment/dto/initialize-payment.dto';
import { ListWithdrawalsQueryDto } from '../../modules/withdrawal/dto/list-withdrawals.query.dto';

describe('Global ValidationPipe security posture', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    forbidUnknownValues: true,
    validationError: { target: false, value: false },
  });

  it('rejects extra fields on auth login DTO', async () => {
    await expect(
      pipe.transform(
        { email: 'user@example.com', password: 'password123', role: 'admin' },
        { type: 'body', metatype: LoginDto } as any,
      ),
    ).rejects.toThrow();
  });

  it('rejects invalid payment amount', async () => {
    await expect(
      pipe.transform(
        { amount: 10 },
        { type: 'body', metatype: InitializePaymentDto } as any,
      ),
    ).rejects.toThrow();
  });

  it('rejects non-whitelisted query fields', async () => {
    await expect(
      pipe.transform(
        { status: 'NOT_A_STATUS', page: '1', limit: '20' },
        { type: 'query', metatype: ListWithdrawalsQueryDto } as any,
      ),
    ).rejects.toThrow();
  });
});

