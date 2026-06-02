import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomerStatusController } from './customer-status.controller';
import { CustomerStatusService } from './customer-status.service';

@Module({
  imports: [PrismaModule],
  controllers: [CustomerStatusController],
  providers: [CustomerStatusService],
})
export class CustomerStatusModule {}
