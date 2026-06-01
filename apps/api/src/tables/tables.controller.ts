import { Controller, Get, Param } from '@nestjs/common';
import { QrTokenParamDto } from './dto/qr-token-param.dto';
import { TablesService } from './tables.service';

@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get('resolve/:qrToken')
  resolveQrToken(@Param() params: QrTokenParamDto) {
    return this.tablesService.resolveQrToken(params.qrToken);
  }
}
