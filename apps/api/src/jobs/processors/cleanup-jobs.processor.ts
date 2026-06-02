import { Injectable } from '@nestjs/common';
import { StaffAuthService } from '../../staff-auth/staff-auth.service';
import { TableSessionAccessService } from '../../table-sessions/table-session-access.service';

@Injectable()
export class CleanupJobsProcessor {
  constructor(
    private readonly staffAuthService: StaffAuthService,
    private readonly tableSessionAccessService: TableSessionAccessService,
  ) {}

  async cleanupExpiredSessions() {
    const [staffSessions, customerAccessTokens] = await Promise.all([
      this.staffAuthService.expireOldSessions(),
      this.tableSessionAccessService.expireOldAccessTokens(),
    ]);

    return {
      ...staffSessions,
      ...customerAccessTokens,
    };
  }
}

