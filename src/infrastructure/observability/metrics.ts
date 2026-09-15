import { getEnv } from '../../config/env';
import type { EnvConfig } from '../../config/env';
import { createLogger } from '../../config/logger';
import type { Logger } from '../../config/logger';

export interface MetricEntry {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: Date;
}

export interface MetricsCollector {
  increment(name: string, tags?: Record<string, string>): void;
  gauge(name: string, value: number, tags?: Record<string, string>): void;
  timing(name: string, value: number, tags?: Record<string, string>): void;
  getMetrics(): MetricEntry[];
  reset(): void;
}

export function createMetricsCollector(logger: Logger, config: EnvConfig): MetricsCollector {
  const metrics: MetricEntry[] = [];
  return {
    increment(name: string, tags?: Record<string, string>) {
      metrics.push({ name, value: 1, tags, timestamp: new Date() });
    },
    gauge(name: string, value: number, tags?: Record<string, string>) {
      metrics.push({ name, value, tags, timestamp: new Date() });
    },
    timing(name: string, value: number, tags?: Record<string, string>) {
      metrics.push({ name, value, tags, timestamp: new Date() });
    },
    getMetrics() {
      return [...metrics];
    },
    reset() {
      metrics.length = 0;
    },
  };
}

export function initializeObservability(config: EnvConfig, logger: Logger) {
  return {
    metrics: createMetricsCollector(logger, config),
    logger,
    trace: async (_name: string, fn: () => Promise<void>) => {
      await fn();
    },
  };
}
