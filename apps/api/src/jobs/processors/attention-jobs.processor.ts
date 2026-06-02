import { Injectable } from '@nestjs/common';

@Injectable()
export class AttentionJobsProcessor {
  async recalculateTableAttention(tableSessionId: string) {
    return {
      tableSessionId,
      status: 'processor_registered',
    };
  }

  async rebuildBranchAttention(branchId: string) {
    return {
      branchId,
      status: 'processor_registered',
    };
  }
}

