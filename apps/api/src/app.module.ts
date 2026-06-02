import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnvironment } from './config/env.validation';
import { AiWaiterModule } from './ai-waiter/ai-waiter.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditModule } from './audit/audit.module';
import { AutopilotModule } from './autopilot/autopilot.module';
import { BillRequestsModule } from './bill-requests/bill-requests.module';
import { BranchSettingsModule } from './branch-settings/branch-settings.module';
import { BranchesModule } from './branches/branches.module';
import { CartModule } from './cart/cart.module';
import { CompaniesModule } from './companies/companies.module';
import { ContentModule } from './content/content.module';
import { CustomerStatusModule } from './customer-status/customer-status.module';
import { ExperienceModule } from './experience/experience.module';
import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';
import { MediaAssetsModule } from './media-assets/media-assets.module';
import { MenuAdminModule } from './menu-admin/menu-admin.module';
import { MenuModule } from './menu/menu.module';
import { OrdersModule } from './orders/orders.module';
import { PresenceNotificationsModule } from './presence-notifications/presence-notifications.module';
import { PreparationTasksModule } from './preparation-tasks/preparation-tasks.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeEventsModule } from './realtime-events/realtime-events.module';
import { RedisModule } from './redis/redis.module';
import { SmartCashierModule } from './smart-cashier/smart-cashier.module';
import { StaffAuthModule } from './staff-auth/staff-auth.module';
import { StaffModule } from './staff/staff.module';
import { SystemModule } from './system/system.module';
import { TableSessionsModule } from './table-sessions/table-sessions.module';
import { TablesModule } from './tables/tables.module';
import { VenueZonesModule } from './venue-zones/venue-zones.module';
import { WaiterCallsModule } from './waiter-calls/waiter-calls.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      load: [configuration],
      validate: validateEnvironment,
    }),
    AiWaiterModule,
    AnalyticsModule,
    AuditModule,
    AutopilotModule,
    StaffAuthModule,
    PrismaModule,
    RedisModule,
    HealthModule,
    JobsModule,
    SystemModule,
    BillRequestsModule,
    BranchSettingsModule,
    CompaniesModule,
    BranchesModule,
    CartModule,
    ContentModule,
    CustomerStatusModule,
    ExperienceModule,
    MediaAssetsModule,
    OrdersModule,
    PresenceNotificationsModule,
    PreparationTasksModule,
    RealtimeEventsModule,
    SmartCashierModule,
    TablesModule,
    StaffModule,
    MenuAdminModule,
    MenuModule,
    TableSessionsModule,
    VenueZonesModule,
    WaiterCallsModule,
  ],
})
export class AppModule {}
