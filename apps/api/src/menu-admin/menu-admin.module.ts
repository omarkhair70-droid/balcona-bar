import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MenuAdminController } from './menu-admin.controller';
import { MenuAdminService } from './menu-admin.service';

@Module({
  imports: [PrismaModule],
  controllers: [MenuAdminController],
  providers: [MenuAdminService],
})
export class MenuAdminModule {}
