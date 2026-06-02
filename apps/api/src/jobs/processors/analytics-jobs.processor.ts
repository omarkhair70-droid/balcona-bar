import { Injectable } from '@nestjs/common';

@Injectable()
export class AnalyticsJobsProcessor {
  async generateSnapshot(scope: Record<string, unknown>) {
    return {
      scope,
      status: 'processor_registered',
    };
  }
}

