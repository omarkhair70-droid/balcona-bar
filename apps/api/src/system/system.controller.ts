import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('system')
export class SystemController {
  constructor(private readonly configService: ConfigService) {}

  @Get('info')
  info() {
    return {
      name: this.configService.get<string>('app.name'),
      version: this.configService.get<string>('app.version'),
      environment: this.configService.get<string>('app.environment'),
      apiPrefix: this.configService.get<string>('app.prefix'),
      timestamp: new Date().toISOString(),
    };
  }
}
