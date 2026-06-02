import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VenueZonesController } from './venue-zones.controller';
import { VenueZonesService } from './venue-zones.service';

@Module({
  imports: [PrismaModule],
  controllers: [VenueZonesController],
  providers: [VenueZonesService],
})
export class VenueZonesModule {}
