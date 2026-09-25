// The Security workflow's audit step: fail on a NEW high or critical advisory
// in production dependencies, not on the ones already judged and accepted.
//
//   npm audit --omit=dev --json | node scripts/audit-gate.mjs
//
// `npm audit --audit-level=high` could not tell the two apart, so it failed on
// every push to main for weeks, for the same accepted residuals, until the red
// mark meant nothing and a real new one would have gone unnoticed.
//
// Accepted advisories live in `.github/audit-accepted.json`, each with its
// reason, and CLAUDE.md ("Accepted residuals") holds the argument. An entry
// that no longer appears is reported, so the list shrinks when a fix lands.

import { readFileSync } from "node:fs";

const accepted = JSON.parse(
  readFileSync(new URL("../.github/audit-accepted.json", import.meta.url), "utf8"),
).accepted;

let input = "";
for await (const chunk of process.stdin) input += chunk;
const report = JSON.parse(input);

const found = new Map();
for (const [pkg, vuln] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of vuln.via) {
    if (typeof via !== "object") continue;
    if (!["high", "critical"].includes(via.severity)) continue;
    const id = via.url.split("/").pop();
    found.set(id, { pkg, severity: via.severity, title: via.title, url: via.url });
  }
}

const fresh = [...found].filter(([id]) => !(id in accepted));
const gone = Object.keys(accepted).filter((id) => !found.has(id));

for (const [id, a] of [...found].filter(([id]) => id in accepted)) {
  console.log(`accepted  ${id}  ${a.pkg}: ${accepted[id].reason}`);
}
for (const id of gone) {
  console.log(`resolved  ${id}  ${accepted[id].package}: no longer reported, remove it from the list`);
}

if (fresh.length > 0) {
  console.error(`\n${fresh.length} new high/critical advisory(ies) in production dependencies:`);
  for (const [id, a] of fresh) {
    console.error(`  ${a.severity.toUpperCase()}  ${id}  ${a.pkg}: ${a.title}\n      ${a.url}`);
  }
  console.error(
    "\nFix with a targeted bump or an `overrides` entry (never `npm audit fix`), or,\n" +
      "if it is unreachable, add it to .github/audit-accepted.json with the reason.",
  );
  process.exit(1);
}
console.log(`\nNo new high/critical advisories (${found.size} accepted).`);
