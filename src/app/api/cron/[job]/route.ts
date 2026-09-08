import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { JOBS, JOB_NAMES, isJobName } from "@/lib/jobs";

// How the scheduled work actually runs on this hosting.
//
// ⚠️ Hostinger's cron CANNOT run `npx tsx scripts/…`, for two independent
// reasons: the deploy installs with `--omit=dev` so `tsx` is not there, and a
// cron shell never receives the Node app's environment — the variables are set
// in the hPanel and injected into the *app* process, so a script started from
// cron has no `DATABASE_URL` at all.
//
// So cron calls the app instead:
//
//   curl -fsS -X POST https://<domain>/api/cron/sweep \
//        -H "Authorization: Bearer $CRON_SECRET"
//
// The work then happens inside the running server, which already has every
// variable, needs no dev dependency, and cannot drift from what the app
// believes. The JSON that comes back is what Hostinger records as the cron's
// output, which is the only place a warning would otherwise be lost.
//
// POST only, on purpose: a GET is what a crawler, a link preview or a browser
// prefetch issues, and one of these jobs deletes rows.

export const dynamic = "force-dynamic";

/** Constant-time, and safe to call with a wrong-length or absent value. */
function secretMatches(supplied: string, expected: string): boolean {
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ job: string }> },
) {
  const secret = process.env.CRON_SECRET;

  // Fails CLOSED, like the login limiter and for the same reason: this endpoint
  // reprocesses payments and deletes rows. An unset secret is a misconfigured
  // deployment, not permission to run it unauthenticated.
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "CRON_SECRET is not set. Add it in the host's panel (field by " +
          "field — never through the API, which replaces the whole set).",
      },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!secretMatches(supplied, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { job } = await context.params;
  if (!isJobName(job)) {
    return NextResponse.json(
      { error: `Unknown job "${job}". Known: ${JOB_NAMES.join(", ")}` },
      { status: 404 },
    );
  }

  const startedAt = Date.now();
  try {
    const result = await JOBS[job]();
    // ⚠️ A job that warns answers 200, not an error status. The work DID run,
    // and a 5xx here would make a monitor retry a sweep that succeeded. The
    // warnings are the payload; `ok` says whether a person has to read them.
    return NextResponse.json({
      job,
      ok: result.warnings.length === 0,
      ms: Date.now() - startedAt,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[cron] ${job} failed:`, error);
    return NextResponse.json(
      { job, ok: false, ms: Date.now() - startedAt, error: message },
      { status: 500 },
    );
  }
}
