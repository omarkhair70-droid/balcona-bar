import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsOptions, Queue, QueueOptions } from 'bullmq';
import { JOB_QUEUE_NAMES, JobQueueName } from './jobs.constants';

@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly queues = new Map<JobQueueName, Queue>();

  constructor(private readonly configService: ConfigService) {}

  async onModuleDestroy() {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }

  async health() {
    const queueStatuses = await this.queuesStatus();
    const degraded = queueStatuses.some((queue) => queue.status === 'error');

    return {
      enabled: this.enabled(),
      redisStatus: degraded ? 'degraded' : 'reachable_or_idle',
      queues: queueStatuses,
    };
  }

  async queuesStatus() {
    return Promise.all(
      JOB_QUEUE_NAMES.map(async (name) => {
        if (!this.enabled()) {
          return {
            name,
            status: 'disabled',
            counts: null,
          };
        }

        try {
          const counts = await this.queueFor(name).getJobCounts(
            'waiting',
            'active',
            'completed',
            'failed',
            'delayed',
            'paused',
          );

          return {
            name,
            status: 'ok',
            counts,
          };
        } catch (error) {
          return {
            name,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }),
    );
  }

  async enqueue(
    queueName: JobQueueName,
    jobName: string,
    data: Record<string, unknown>,
    options: JobsOptions = {},
  ) {
    if (!this.enabled()) {
      return {
        enqueued: false,
        reason: 'jobs_disabled',
      };
    }

    try {
      const job = await this.queueFor(queueName).add(jobName, data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 1_000,
        removeOnFail: 1_000,
        ...options,
      });

      return {
        enqueued: true,
        queueName,
        jobName,
        jobId: job.id,
      };
    } catch (error) {
      return {
        enqueued: false,
        queueName,
        jobName,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private queueFor(name: JobQueueName) {
    const existing = this.queues.get(name);

    if (existing) {
      return existing;
    }

    const queue = new Queue(name, this.queueOptions());
    this.queues.set(name, queue);

    return queue;
  }

  private queueOptions(): QueueOptions {
    const redisUrl = this.configService.get<string | undefined>('redis.url');

    if (redisUrl) {
      return { connection: { url: redisUrl } };
    }

    return {
      connection: {
        host: this.configService.get<string>('redis.host', 'localhost'),
        port: this.configService.get<number>('redis.port', 6379),
        password: this.configService.get<string | undefined>('redis.password'),
        db: this.configService.get<number>('redis.db', 0),
        maxRetriesPerRequest: 1,
      },
    };
  }

  private enabled() {
    return this.configService.get<boolean>('jobs.enabled', true);
  }
}

