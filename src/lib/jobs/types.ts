// What a scheduled job hands back.
//
// The three jobs used to be three standalone scripts that talked to a terminal:
// they made their own Prisma client, printed as they went, and shouted on
// stderr. That works when a person is watching, and on this hosting nobody is.
//
// ⚠️ **Hostinger's cron cannot run them as scripts.** Two reasons, and either
// one alone is enough:
//
//   1. `npx tsx` needs the dev dependencies, and the deploy installs with
//      `--omit=dev`.
//   2. A cron shell does not get the Node app's environment. The variables
//      live in the hPanel and are injected into the *app* process, so a script
//      started from cron has no `DATABASE_URL` at all.
//
// So the job is the unit, not the script. The logic lives here, the app calls
// it over an authenticated route — inside the running process, which already
// has every variable — and `scripts/*.ts` stay as thin CLI wrappers for local
// use. One implementation, two front doors.
//
// `warnings` is the part that matters. These jobs are the only thing that ever
// notices a stuck payment, a negative stock figure or a queue that is not
// draining, and a warning that only ever reached a terminal nobody reads is the
// same as no warning. They come back in the HTTP response, which Hostinger
// captures as the cron's output.
export type JobResult = {
  /** Counted facts. Safe to log, safe to ignore. */
  summary: Record<string, number | string | null>;
  /** Things a person has to act on. Empty is the good case. */
  warnings: string[];
};

export type JobName = "sweep" | "aggregate" | "cleanup";
