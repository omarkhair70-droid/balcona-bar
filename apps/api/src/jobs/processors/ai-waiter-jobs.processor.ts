import { Injectable } from '@nestjs/common';

@Injectable()
export class AiWaiterJobsProcessor {
  async summarizeSession(aiWaiterSessionId: string) {
    return {
      aiWaiterSessionId,
      status: 'processor_registered',
    };
  }
}

