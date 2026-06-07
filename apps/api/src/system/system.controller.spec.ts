import { SystemController } from './system.controller';

describe('SystemController', () => {
  it('returns safe runtime metadata without secrets', () => {
    const configValues: Record<string, string> = {
      'app.name': 'balcona-bar-api',
      'app.version': '0.1.0',
      'app.environment': 'staging',
      'app.nodeEnvironment': 'production',
      'app.prefix': 'api/v1',
    };
    const configService = {
      get: jest.fn((key: string) => configValues[key]),
    };
    const controller = new SystemController(configService as never);

    const result = controller.info();

    expect(result).toEqual({
      name: 'balcona-bar-api',
      version: '0.1.0',
      environment: 'staging',
      appEnvironment: 'staging',
      nodeEnvironment: 'production',
      apiPrefix: 'api/v1',
      timestamp: expect.any(String),
    });
    expect(JSON.stringify(result)).not.toContain('DATABASE_URL');
    expect(JSON.stringify(result)).not.toContain('REDIS_URL');
  });
});
