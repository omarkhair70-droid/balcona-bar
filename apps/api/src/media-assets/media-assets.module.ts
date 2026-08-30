import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StaffModule } from '../staff/staff.module';
import { MediaAssetsController } from './media-assets.controller';
import { MediaAssetsService } from './media-assets.service';

@Module({
  imports: [PrismaModule, StaffModule],
  controllers: [MediaAssetsController],
  providers: [MediaAssetsService],
})
export class MediaAssetsModule {}
