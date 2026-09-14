import { describe, expect, it, afterAll, beforeAll } from "vitest";
import { prisma, RUN, cleanUp, must } from "./helpers";
import {
  inviteAdminUser,
  acceptAdminInvite,
  changeAdminRole,
  setAdminActive,
  listAdminUsers,
  NEVER_EXPOSED_ADMIN_FIELDS,
  ADMIN_INVITE_TTL_HOURS,
  ADMIN_RESET_TTL_MINUTES,
  requestAdminPasswordReset,
  consumeAdminPasswordReset,
  resendAdminAccessLink,
} from "@/lib/admin-users";
import { SWEEP_INTERVAL_MINUTES } from "@/lib/customer-accounts";
import type { JWTPayload } from "@/lib/auth";

const email = (label: string) => `${label}.${RUN}@example.com`;
const PASSWORD = "A-Strong-Pass1!";

// The person doing the inviting. `recordAudit` only reads `sub` and `email`,
// but the whole payload is passed so the shape matches every other writer.
let owner: JWTPayload;

beforeAll(async () => {
  // ⚠️ A REAL owner row, not a stub. `wouldStrandTheBuilding` counts active
  // owners in the database, so a test that invented an actor without a row
  // would be testing a world where the guard cannot see the actor — and would
  // pass while the guard was broken.
  const row = await prisma.adminUser.create({
    data: {
      email: email("owner"),
      name: "Test Owner",
      role: "OWNER",
      passwordHash: "not-a-real-hash-but-not-null",
    },
  });
  owner = {
    sub: row.id,
    email: row.email,
    role: "OWNER",
    name: row.name,
  } as JWTPayload;
});

afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

describe("granting access is something an owner does", () => {
  it("creates an account with no password and queues the invitation", async () => {
    const address = email("invited");
    const result = await inviteAdminUser({
      email: address,
      name: "Invited Person",
      role: "ECOMMERCE_ADMIN",
      invitedBy: owner,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = must(
      await prisma.adminUser.findUnique({ where: { email: address } }),
      "the invited admin",
    );
    // ⚠️ Null is the whole design: invited, has not chosen a password yet.
    // There is no admin self-registration, so a row exists before its password.
    expect(row.passwordHash).toBeNull();
    expect(row.inviteToken).toBe(result.invite.token);
    expect(row.inviteEmailStatus).toBe("PENDING");
    expect(row.role).toBe("ECOMMERCE_ADMIN");
    // Frozen as a string so it still answers "who let this person in" after
    // that person is gone.
    expect(row.invitedByEmail).toBe(owner.email);
  });

  it("writes who granted what, because that is the question asked later", async () => {
    const address = email("audited");
    await inviteAdminUser({
      email: address,
      name: "Audited",
      role: "CONTENT_ADMIN",
      invitedBy: owner,
    });

    const entry = must(
      await prisma.auditLog.findFirst({
        where: { entityType: "admin_user", entityLabel: address },
        orderBy: { createdAt: "desc" },
      }),
      "the audit entry",
    );
    expect(entry.adminEmail).toBe(owner.email);
    expect(entry.action).toBe("create");
  });

  it("refuses a second account for the same address", async () => {
    const address = email("twice");
    expect(
      (
        await inviteAdminUser({
          email: address,
          name: "First",
          role: "ANALYTICS_VIEWER",
          invitedBy: owner,
        })
      ).ok,
    ).toBe(true);

    const second = await inviteAdminUser({
      email: address,
      name: "Second",
      role: "OWNER",
      invitedBy: owner,
    });
    expect(second.ok).toBe(false);
  });

  it("spends the invitation once and sets the password", async () => {
    const address = email("accepts");
    const invited = await inviteAdminUser({
      email: address,
      name: "Accepts",
      role: "ANALYTICS_VIEWER",
      invitedBy: owner,
    });
    if (!invited.ok) throw new Error("invite failed");

    expect((await acceptAdminInvite(invited.invite.token, PASSWORD)).ok).toBe(
      true,
    );

    const row = must(
      await prisma.adminUser.findUnique({ where: { email: address } }),
      "the accepted admin",
    );
    expect(row.passwordHash).not.toBeNull();
    expect(row.inviteToken).toBeNull();
    expect(row.mustChangePassword).toBe(false);

    const again = await acceptAdminInvite(invited.invite.token, PASSWORD);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe("unknown");
  });

  it("tells an expired invitation apart from an unknown one", async () => {
    const address = email("stale");
    const invited = await inviteAdminUser({
      email: address,
      name: "Stale",
      role: "ANALYTICS_VIEWER",
      invitedBy: owner,
    });
    if (!invited.ok) throw new Error("invite failed");

    await prisma.adminUser.update({
      where: { email: address },
      data: { inviteExpiresAt: new Date(Date.now() - 1000) },
    });

    const expired = await acceptAdminInvite(invited.invite.token, PASSWORD);
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.reason).toBe("expired");

    const unknown = await acceptAdminInvite("never-issued-this", PASSWORD);
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.reason).toBe("unknown");

    // A day, not an hour: an invitation arrives unannounced at somebody who was
    // not waiting for it. Asserted as a floor rather than the exact number.
    expect(ADMIN_INVITE_TTL_HOURS).toBeGreaterThanOrEqual(12);
  });

  it("stops a revoked invitation being claimed from the inbox", async () => {
    const address = email("revoked");
    const invited = await inviteAdminUser({
      email: address,
      name: "Revoked",
      role: "ECOMMERCE_ADMIN",
      invitedBy: owner,
    });
    if (!invited.ok) throw new Error("invite failed");

    // The OWNER changes their mind before the person opens the mail.
    await setAdminActive({
      targetId: invited.adminUserId,
      isActive: false,
      actor: owner,
    });

    const claimed = await acceptAdminInvite(invited.invite.token, PASSWORD);
    expect(claimed.ok).toBe(false);
  });
});

describe("the building cannot be locked from the inside", () => {
  // ⚠️ The guard this whole file exists for. OWNER is the only role that can
  // grant roles, so demoting or deactivating the last one means nobody can ever
  // grant anything again — and the only way back is somebody running SQL
  // against production by hand.
  //
  // ⚠️ This guard is GLOBAL by nature — it counts every active owner in the
  // database — so unlike everything else in this suite it cannot work on a
  // private copy. The database it runs against already has the owner the seed
  // creates, which means "the last owner" is never true here by accident.
  //
  // So the foreign owners are borrowed and put back, the same way
  // `captureCaseStock` / `restoreCaseStock` borrow the case-stock singletons.
  // The first version of this file skipped that step and all three assertions
  // failed — which was the guard being RIGHT and the test being wrong, and is
  // exactly the shape of a test that would otherwise have been "fixed" by
  // weakening the thing it was checking.
  let borrowed: string[] = [];

  beforeAll(async () => {
    const others = await prisma.adminUser.findMany({
      where: {
        role: "OWNER",
        isActive: true,
        passwordHash: { not: null },
        id: { not: owner.sub },
      },
      select: { id: true },
    });
    borrowed = others.map((o) => o.id);
    if (borrowed.length) {
      await prisma.adminUser.updateMany({
        where: { id: { in: borrowed } },
        data: { isActive: false },
      });
    }
  });

  afterAll(async () => {
    if (borrowed.length) {
      await prisma.adminUser.updateMany({
        where: { id: { in: borrowed } },
        data: { isActive: true, deactivatedAt: null },
      });
    }
  });

  it("refuses to demote the last owner", async () => {
    const result = await changeAdminRole({
      targetId: owner.sub,
      role: "ECOMMERCE_ADMIN",
      actor: owner,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("last-owner");

    const row = must(
      await prisma.adminUser.findUnique({ where: { id: owner.sub } }),
      "the owner",
    );
    expect(row.role).toBe("OWNER");
  });

  it("refuses to deactivate the last owner", async () => {
    const result = await setAdminActive({
      targetId: owner.sub,
      isActive: false,
      actor: owner,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("last-owner");
  });

  it("does not count an invited owner who cannot sign in yet", async () => {
    // ⚠️ The subtle one. A pending invitation looks like a second owner and is
    // not: they have no password, so they cannot sign in, so they cannot grant
    // anything. Treating it as cover is how the building gets locked with the
    // key still in the post.
    const invited = await inviteAdminUser({
      email: email("owner-pending"),
      name: "Not Yet",
      role: "OWNER",
      invitedBy: owner,
    });
    if (!invited.ok) throw new Error("invite failed");

    const result = await setAdminActive({
      targetId: owner.sub,
      isActive: false,
      actor: owner,
    });
    expect(result.ok).toBe(false);
  });

  it("lets the last owner step down once somebody else can actually let them back in", async () => {
    const address = email("second-owner");
    const invited = await inviteAdminUser({
      email: address,
      name: "Second Owner",
      role: "OWNER",
      invitedBy: owner,
    });
    if (!invited.ok) throw new Error("invite failed");
    // Accepting is what makes them real: it writes the password.
    expect((await acceptAdminInvite(invited.invite.token, PASSWORD)).ok).toBe(
      true,
    );

    const result = await changeAdminRole({
      targetId: owner.sub,
      role: "ANALYTICS_VIEWER",
      actor: owner,
    });
    expect(result.ok).toBe(true);

    // Put it back so the rest of the suite still has its owner.
    await prisma.adminUser.update({
      where: { id: owner.sub },
      data: { role: "OWNER" },
    });
  });
});

describe("what the people screen may publish", () => {
  it("never returns a secret, whatever columns AdminUser grows", async () => {
    // ⚠️ The same property `/api/customers` learned the hard way, asserted on
    // the table where it would be worse: `inviteToken` is not a fingerprint of
    // anything, it is a spendable claim on a STAFF account with a role on it.
    const address = email("listed");
    await inviteAdminUser({
      email: address,
      name: "Listed",
      role: "CONTENT_ADMIN",
      invitedBy: owner,
    });

    const rows = await listAdminUsers();
    const row = must(
      rows.find((r) => r.email === address),
      "the invited admin in the list",
    );

    for (const field of NEVER_EXPOSED_ADMIN_FIELDS) {
      expect(row).not.toHaveProperty(field);
    }

    // And the screen still gets what it is for, so this is a whitelist rather
    // than just an absence.
    expect(row.role).toBe("CONTENT_ADMIN");
    expect(row.hasAccepted).toBe(false);
    expect(row.invitedByEmail).toBe(owner.email);
  });
});

describe("a way back in for an admin who forgot their password", () => {
  // ⚠️ These exist because shipping invitations on 2026-09-13 left no recovery
  // at all: `/api/auth` had only `change-password` (requires being signed in)
  // and `inviteAdminUser` refuses an address that already exists, so an OWNER
  // could not re-send either. The only way back was SQL by hand.

  it("says nothing about who works here", async () => {
    // ⚠️ The property that matters most on a STAFF endpoint. Telling "no such
    // admin" apart from "wrong password" would let anybody with a browser
    // enumerate the staff list, which is the first step of every targeted
    // phish — and the login route already answers all its refusals
    // identically, so a difference here gives back exactly what that protects.
    //
    // Asserted at the level the route is documented to ignore: all three
    // non-cases return null, so there is nothing for a route to branch on.
    expect(await requestAdminPasswordReset(email("no-such-admin"))).toBeNull();

    const invited = await inviteAdminUser({
      email: email("never-accepted"),
      name: "Never Accepted",
      role: "ANALYTICS_VIEWER",
      invitedBy: owner,
    });
    if (!invited.ok) throw new Error("invite failed");
    // An invitation is the way into an account with no password. This is not.
    expect(
      await requestAdminPasswordReset(email("never-accepted")),
    ).toBeNull();

    const address = email("can-reset");
    const live = await inviteAdminUser({
      email: address,
      name: "Can Reset",
      role: "ECOMMERCE_ADMIN",
      invitedBy: owner,
    });
    if (!live.ok) throw new Error("invite failed");
    await acceptAdminInvite(live.invite.token, PASSWORD);
    expect(await requestAdminPasswordReset(address)).not.toBeNull();

    // And a deactivated account is not a way in either.
    await setAdminActive({
      targetId: live.adminUserId,
      isActive: false,
      actor: owner,
    });
    expect(await requestAdminPasswordReset(address)).toBeNull();
  });

  it("spends the link once and kills what came before", async () => {
    const address = email("resets");
    const invited = await inviteAdminUser({
      email: address,
      name: "Resets",
      role: "ECOMMERCE_ADMIN",
      invitedBy: owner,
    });
    if (!invited.ok) throw new Error("invite failed");
    await acceptAdminInvite(invited.invite.token, PASSWORD);

    const before = must(
      await prisma.adminUser.findUnique({ where: { email: address } }),
      "the admin before",
    );

    const reset = must(
      await requestAdminPasswordReset(address),
      "the reset link",
    );
    const NEW = "A-Different-One2!";
    expect((await consumeAdminPasswordReset(reset.token, NEW)).ok).toBe(true);

    const after = must(
      await prisma.adminUser.findUnique({ where: { email: address } }),
      "the admin after",
    );
    expect(after.passwordHash).not.toBe(before.passwordHash);
    expect(after.passwordResetToken).toBeNull();
    // Every session issued before this dies — the point, when the reason for
    // the reset is that somebody else had the old password.
    expect(after.passwordChangedAt.getTime()).toBeGreaterThan(
      before.passwordChangedAt.getTime(),
    );

    const again = await consumeAdminPasswordReset(reset.token, NEW);
    expect(again.ok).toBe(false);
  });

  it("refuses an expired link and tells it apart from an unknown one", async () => {
    const address = email("stale-reset");
    const invited = await inviteAdminUser({
      email: address,
      name: "Stale Reset",
      role: "ANALYTICS_VIEWER",
      invitedBy: owner,
    });
    if (!invited.ok) throw new Error("invite failed");
    await acceptAdminInvite(invited.invite.token, PASSWORD);

    const reset = must(
      await requestAdminPasswordReset(address),
      "the reset link",
    );
    await prisma.adminUser.update({
      where: { email: address },
      data: { passwordResetExpiresAt: new Date(Date.now() - 1000) },
    });

    const expired = await consumeAdminPasswordReset(reset.token, "A-New-One2!x");
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.reason).toBe("expired");

    const unknown = await consumeAdminPasswordReset("nope", "A-New-One2!x");
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.reason).toBe("unknown");

    // ⚠️ Shorter than the invitation because the account is live, longer than
    // the sweep because the sweep is the postman. Asserted as the relationship.
    expect(ADMIN_RESET_TTL_MINUTES).toBeLessThan(ADMIN_INVITE_TTL_HOURS * 60);
    expect(ADMIN_RESET_TTL_MINUTES).toBeGreaterThan(SWEEP_INTERVAL_MINUTES * 4);
  });

  it("sends the link the ROW calls for, not the one the caller asks for", async () => {
    // ⚠️ An account that never accepted gets a fresh INVITATION; one with a
    // password gets a RESET. If the screen could choose, it would be possible
    // to tell somebody who has had access for a month that they have just been
    // granted it — which is not a typo, it is telling them something happened
    // to their account that did not.
    const pending = await inviteAdminUser({
      email: email("resend-pending"),
      name: "Pending",
      role: "ANALYTICS_VIEWER",
      invitedBy: owner,
    });
    if (!pending.ok) throw new Error("invite failed");
    const asInvite = await resendAdminAccessLink({
      targetId: pending.adminUserId,
      actor: owner,
    });
    expect(asInvite.ok && asInvite.kind).toBe("invite");

    const settledAddress = email("resend-settled");
    const settled = await inviteAdminUser({
      email: settledAddress,
      name: "Settled",
      role: "ANALYTICS_VIEWER",
      invitedBy: owner,
    });
    if (!settled.ok) throw new Error("invite failed");
    await acceptAdminInvite(settled.invite.token, PASSWORD);

    const asReset = await resendAdminAccessLink({
      targetId: settled.adminUserId,
      actor: owner,
    });
    expect(asReset.ok && asReset.kind).toBe("reset");

    // A deactivated account is refused rather than quietly reactivated:
    // getting access back is a decision, made by the switch that took it away.
    await setAdminActive({
      targetId: settled.adminUserId,
      isActive: false,
      actor: owner,
    });
    const refused = await resendAdminAccessLink({
      targetId: settled.adminUserId,
      actor: owner,
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toBe("inactive");
  });
});
