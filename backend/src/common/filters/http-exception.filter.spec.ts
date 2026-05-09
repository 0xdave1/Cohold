import { HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function makeHost(reqOverrides?: Record<string, unknown>) {
  const statusFn = jest.fn().mockReturnThis();
  const jsonFn = jest.fn();
  return {
    switchToHttp: () => ({
      getResponse: () => ({ status: statusFn, json: jsonFn }),
      getRequest: () =>
        ({
          url: '/api/v1/test',
          correlationId: 'corr-1',
          ...reqOverrides,
        }) as any,
    }),
    statusFn,
    jsonFn,
  };
}

describe('HttpExceptionFilter', () => {
  it('returns generic 500 message in production without stack trace', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const filter = new HttpExceptionFilter();
    const host = makeHost();
    filter.catch(new Error('secret token abc123'), host as any);
    expect(host.statusFn).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const payload = host.jsonFn.mock.calls[0][0];
    expect(payload.error.message).toBe('Internal server error');
    expect(JSON.stringify(payload)).not.toContain('stack');
    process.env.NODE_ENV = prev;
  });

  it('maps prisma known request error safely', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const filter = new HttpExceptionFilter();
    const host = makeHost();
    const prismaLike = {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
      message: 'Unique constraint failed on token',
    };
    filter.catch(prismaLike as any, host as any);
    expect(host.statusFn).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    const payload = host.jsonFn.mock.calls[0][0];
    expect(payload.error.code).toBe('UNIQUE_CONFLICT');
    expect(JSON.stringify(payload)).not.toContain('token');
    process.env.NODE_ENV = prev;
  });
});

