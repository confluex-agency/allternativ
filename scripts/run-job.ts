/**
 * Runs one scheduled job from the command line.
 *
 *   npx tsx scripts/run-job.ts sweep
 *   npx tsx scripts/run-job.ts aggregate
 *   npx tsx scripts/run-job.ts cleanup
 *
 * ⚠️ This is the LOCAL front door. In production the same jobs run through
 * `POST /api/cron/<job>`, because Hostinger's cron has neither the dev
 * dependencies nor the app's environment. See `src/lib/jobs/types.ts`.
 *
 * The logic is shared, so what happens here is what happens there. This file
 * only decides how it is printed and what the exit code means.
 */
import "dotenv/config";
import { JOBS, JOB_NAMES, isJobName } from "../src/lib/jobs";

async function main() {
  const name = process.argv[2];

  if (!name || !isJobName(name)) {
    console.error(
      `Usage: npx tsx scripts/run-job.ts <${JOB_NAMES.join("|")}>`,
    );
    process.exit(2);
  }

  const result = await JOBS[name]();

  for (const [key, value] of Object.entries(result.summary)) {
    console.log(`${key}: ${value}`);
  }

  // Warnings go to stderr and set a non-zero exit, so that a wrapper which only
  // checks the status still notices. Every one of them means somebody has to do
  // something: a buyer never confirmed, a payment stuck, stock sold below zero.
  for (const warning of result.warnings) {
    console.error(`⚠️  ${warning}`);
  }
  if (result.warnings.length > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
