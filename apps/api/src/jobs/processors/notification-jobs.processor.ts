import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationJobsProcessor {
  async deliver(notificationId: string) {
    return {
      notificationId,
      status: 'external_delivery_not_configured',
    };
  }
}

