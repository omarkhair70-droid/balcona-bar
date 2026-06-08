import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

function createHttpHost({
  method = 'POST',
  path = '/platform/companies/bootstrap',
  url = '/platform/companies/bootstrap?token=secret-token',
  requestId = 'req-123',
}: {
  method?: string;
  path?: string;
  url?: string;
  requestId?: string;
} = {}) {
  const request = {
    method,
    path,
    url,
    header: jest.fn((name: string) =>
      name.toLowerCase() === 'x-request-id' ? requestId : undefined,
    ),
  };
  const response = {
    getHeader: jest.fn((name: string) =>
      name.toLowerCase() === 'x-request-id' ? requestId : undefined,
    ),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ArgumentsHost;

  return { host, request, response };
}

describe('GlobalExceptionFilter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('formats object-shaped BadRequest messages as readable text', () => {
    const filter = new GlobalExceptionFilter();
    const { host, response } = createHttpHost();

    filter.catch(
      new BadRequestException({
        error: 'Bad Request',
        message: {
          details: ['Company slug already exists'],
        },
      }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Company slug already exists',
          path: '/platform/companies/bootstrap',
          requestId: 'req-123',
        }),
      }),
    );
    expect(JSON.stringify(response.json.mock.calls[0][0])).not.toContain(
      '[object Object]',
    );
  });

  it('logs unexpected errors with sanitized diagnostics and safe responses', () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();
    const filter = new GlobalExceptionFilter();
    const { host, response } = createHttpHost();

    filter.catch(
      new Error(
        'Prisma failed for password=super-secret token=abc123 postgresql://user:pass@localhost/db',
      ),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Internal server error',
          path: '/platform/companies/bootstrap',
          requestId: 'req-123',
        }),
      }),
    );

    const loggedPayload = JSON.stringify(loggerSpy.mock.calls[0][0]);

    expect(loggedPayload).toContain('Unhandled API exception');
    expect(loggedPayload).toContain('password=[redacted]');
    expect(loggedPayload).toContain('token=[redacted]');
    expect(loggedPayload).toContain('postgresql://user:[redacted]@localhost/db');
    expect(loggedPayload).toContain('stackFirstLine');
    expect(loggedPayload).not.toContain('super-secret');
    expect(loggedPayload).not.toContain('abc123');
    expect(loggedPayload).not.toContain('secret-token');
  });

  it('logs a non-empty summary for unexpected errors with empty messages', () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();
    const filter = new GlobalExceptionFilter();
    const { host, response } = createHttpHost({
      method: 'POST',
      path: '/orders/order-1/cashier/accept',
      url: '/orders/order-1/cashier/accept',
      requestId: 'req-empty',
    });

    filter.catch(new Error(''), host);

    expect(response.status).toHaveBeenCalledWith(500);

    const loggedPayload = JSON.stringify(loggerSpy.mock.calls[0][0]);

    expect(loggedPayload).toContain('req-empty');
    expect(loggedPayload).toContain('/orders/order-1/cashier/accept');
    expect(loggedPayload).toContain('"name":"Error"');
    expect(loggedPayload).toContain('"message":"Error"');
    expect(loggedPayload).toContain('stackFirstLine');
  });
});
