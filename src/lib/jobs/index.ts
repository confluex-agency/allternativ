import { sweepOrders } from "@/lib/jobs/sweep-orders";
import { aggregateAnalytics } from "@/lib/jobs/aggregate-analytics";
import { cleanupOldEvents } from "@/lib/jobs/cleanup-events";
import type { JobName, JobResult } from "@/lib/jobs/types";

/**
 * The scheduled work, by name.
 *
 * The name is what the cron URL and the CLI both address, so it is written once
 * here rather than repeated in a route and a script. Adding a job means adding
 * a line; `JobName` then makes the route and the CLI fail to compile until they
 * agree with it.
 */
export const JOBS: Record<JobName, () => Promise<JobResult>> = {
  sweep: sweepOrders,
  aggregate: aggregateAnalytics,
  cleanup: cleanupOldEvents,
};

export const JOB_NAMES = Object.keys(JOBS) as JobName[];

export function isJobName(value: string): value is JobName {
  return value in JOBS;
}

export type { JobName, JobResult };
