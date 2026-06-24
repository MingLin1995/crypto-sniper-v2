import { Injectable, OnModuleInit } from '@nestjs/common';
import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: Registry;

  // HTTP Metrics
  public httpRequestsTotal!: Counter<string>;
  public httpRequestDurationSeconds!: Histogram<string>;

  // Redis Metrics
  public redisCacheHitsTotal!: Counter<string>;
  public redisCacheMissesTotal!: Counter<string>;

  // BullMQ Metrics
  private queueActiveJobs!: Gauge<string>;
  private queueWaitingJobs!: Gauge<string>;
  private queueDelayedJobs!: Gauge<string>;
  private queueFailedJobs!: Gauge<string>;

  constructor(
    @InjectQueue('price-check') private readonly priceCheckQueue: Queue,
    @InjectQueue('notification') private readonly notificationQueue: Queue,
  ) {
    this.registry = new Registry();
  }

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry });

    // HTTP Metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDurationSeconds = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    // Redis Metrics
    this.redisCacheHitsTotal = new Counter({
      name: 'redis_cache_hits_total',
      help: 'Total number of Redis cache hits',
      registers: [this.registry],
    });

    this.redisCacheMissesTotal = new Counter({
      name: 'redis_cache_misses_total',
      help: 'Total number of Redis cache misses',
      registers: [this.registry],
    });

    // BullMQ Metrics
    this.queueActiveJobs = new Gauge({
      name: 'bullmq_queue_active_jobs',
      help: 'Number of active jobs in the queue',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.queueWaitingJobs = new Gauge({
      name: 'bullmq_queue_waiting_jobs',
      help: 'Number of waiting jobs in the queue',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.queueDelayedJobs = new Gauge({
      name: 'bullmq_queue_delayed_jobs',
      help: 'Number of delayed jobs in the queue',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.queueFailedJobs = new Gauge({
      name: 'bullmq_queue_failed_jobs',
      help: 'Number of failed jobs in the queue',
      labelNames: ['queue'],
      registers: [this.registry],
    });
  }

  getRegistry(): Registry {
    return this.registry;
  }

  async collectQueueMetrics(): Promise<void> {
    try {
      const pcCounts = await this.priceCheckQueue.getJobCounts('active', 'waiting', 'delayed', 'failed');
      this.queueActiveJobs.set({ queue: 'price-check' }, pcCounts.active);
      this.queueWaitingJobs.set({ queue: 'price-check' }, pcCounts.waiting);
      this.queueDelayedJobs.set({ queue: 'price-check' }, pcCounts.delayed);
      this.queueFailedJobs.set({ queue: 'price-check' }, pcCounts.failed);

      const notifCounts = await this.notificationQueue.getJobCounts('active', 'waiting', 'delayed', 'failed');
      this.queueActiveJobs.set({ queue: 'notification' }, notifCounts.active);
      this.queueWaitingJobs.set({ queue: 'notification' }, notifCounts.waiting);
      this.queueDelayedJobs.set({ queue: 'notification' }, notifCounts.delayed);
      this.queueFailedJobs.set({ queue: 'notification' }, notifCounts.failed);
    } catch (error) {
      // Ignore or log error
    }
  }

  async getMetrics(): Promise<string> {
    await this.collectQueueMetrics();
    return this.registry.metrics();
  }
}
