import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StaffModule } from '../staff/staff.module';
import { ExperienceController } from './experience.controller';
import { ExperienceService } from './experience.service';

@Module({
  imports: [PrismaModule, StaffModule],
  controllers: [ExperienceController],
  providers: [ExperienceService],
})
export class ExperienceModule {}
