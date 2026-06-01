import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnvironment } from './config/env.validation';
import { BranchesModule } from './branches/branches.module';
import { CartModule } from './cart/cart.module';
import { CompaniesModule } from './companies/companies.module';
import { HealthModule } from './health/health.module';
import { MenuModule } from './menu/menu.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { StaffModule } from './staff/staff.module';
import { SystemModule } from './system/system.module';
import { TablesModule } from './tables/tables.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      load: [configuration],
      validate: validateEnvironment,
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    SystemModule,
    CompaniesModule,
    BranchesModule,
    CartModule,
    TablesModule,
    StaffModule,
    MenuModule,
  ],
})
export class AppModule {}
