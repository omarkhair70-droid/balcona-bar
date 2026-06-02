import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnvironment } from './config/env.validation';
import { BillRequestsModule } from './bill-requests/bill-requests.module';
import { BranchesModule } from './branches/branches.module';
import { CartModule } from './cart/cart.module';
import { CompaniesModule } from './companies/companies.module';
import { CustomerStatusModule } from './customer-status/customer-status.module';
import { HealthModule } from './health/health.module';
import { MenuModule } from './menu/menu.module';
import { OrdersModule } from './orders/orders.module';
import { PresenceNotificationsModule } from './presence-notifications/presence-notifications.module';
import { PreparationTasksModule } from './preparation-tasks/preparation-tasks.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeEventsModule } from './realtime-events/realtime-events.module';
import { RedisModule } from './redis/redis.module';
import { SmartCashierModule } from './smart-cashier/smart-cashier.module';
import { StaffModule } from './staff/staff.module';
import { SystemModule } from './system/system.module';
import { TableSessionsModule } from './table-sessions/table-sessions.module';
import { TablesModule } from './tables/tables.module';
import { WaiterCallsModule } from './waiter-calls/waiter-calls.module';

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
    BillRequestsModule,
    CompaniesModule,
    BranchesModule,
    CartModule,
    CustomerStatusModule,
    OrdersModule,
    PresenceNotificationsModule,
    PreparationTasksModule,
    RealtimeEventsModule,
    SmartCashierModule,
    TablesModule,
    StaffModule,
    MenuModule,
    TableSessionsModule,
    WaiterCallsModule,
  ],
})
export class AppModule {}
