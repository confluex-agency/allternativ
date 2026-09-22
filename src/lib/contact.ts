/**
 * The contact form: what it accepts, where it is written, how it leaves.
 *
 * ⚠️ The row is written BEFORE anything is sent, and that order is the whole
 * design. The visitor is told "received" only once the message exists in the
 * database, so a provider that is down at that moment delays the message rather
 * than losing it: the first attempt happens straight away, and the sweep
 * retries whatever is still PENDING, like the six other queued mails.
 *
 * The form that preceded this had no action at all. Pressing "Send" reloaded
 * the page with the message in the query string, and the visitor believed they
 * had asked something that nobody would ever read.
 */
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  buildContactNotification,
  sendEmail,
  outcomeForFailure,
  oneLine,
  EMAIL_MAX_ATTEMPTS,
} from "@/lib/email";
import {
  CONTACT_LIMITS,
  CONTACT_RETENTION_DAYS,
  CONTACT_TOPIC_KEYS,
} from "@/lib/contact-topics";

/**
 * What the route accepts. Everything a visitor sends is checked here, on the
 * server, whatever the form in the browser enforced: the form is a suggestion
 * and the request can be written by hand.
 *
 * - The name is flattened to one line, because it goes into a subject.
 * - The message keeps its line breaks and loses every other control character.
 * - The topic is one of four keys, so it cannot carry text of its own.
 * - `website` is the honeypot. It is hidden from people and filled by bots, and
 *   the route drops a message that has it without telling the sender.
 */
export const ContactSchema = z.object({
  name: z
    .string()
    .transform(oneLine)
    .pipe(z.string().min(1, "Please tell us your name").max(CONTACT_LIMITS.name)),
  email: z
    .string()
    .trim()
    .max(CONTACT_LIMITS.email)
    .email("That email address does not look right"),
  topic: z.enum(CONTACT_TOPIC_KEYS),
  message: z
    .string()
    .transform((m) =>
      m
        .replace(/\r\n?/g, "\n")
        .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
        .trim(),
    )
    .pipe(
      z
        .string()
        .min(1, "Please write a message")
        .max(CONTACT_LIMITS.message, "That message is too long"),
    ),
  website: z.string().max(200).optional(),
});

export type ContactInput = z.infer<typeof ContactSchema>;

/**
 * Store the message, then try to send it once.
 *
 * Returns once the row exists. Whether the first send worked does not change
 * what the visitor is told: the message is safe either way, and the sweep owns
 * every retry after this one.
 */
export async function submitContactMessage(
  input: Omit<ContactInput, "website">,
): Promise<{ id: string; sent: boolean }> {
  const row = await prisma.contactMessage.create({
    data: {
      name: input.name,
      email: input.email,
      topic: input.topic,
      message: input.message,
    },
  });

  const result = await deliverContactMessage(row);
  return { id: row.id, sent: result.kind === "sent" };
}

type ContactRow = {
  id: string;
  name: string;
  email: string;
  topic: (typeof CONTACT_TOPIC_KEYS)[number];
  message: string;
  createdAt: Date;
  emailAttempts: number;
};

type Delivery =
  | { kind: "sent" }
  | { kind: "retrying" }
  | { kind: "gaveUp" }
  | { kind: "blocked"; reason: string };

/**
 * One attempt, and the row updated to say how it went. Shared by the route and
 * the sweep so that both write the same states the same way.
 *
 * Returns `blocked` rather than writing anything when there is no provider at all, the
 * same distinction every other queue draws: that is a deployment gap, not a
 * failed message, and it must not burn the attempt counter.
 */
async function deliverContactMessage(
  row: ContactRow,
): Promise<Delivery> {
  try {
    await sendEmail(
      buildContactNotification({
        name: row.name,
        email: row.email,
        topic: row.topic,
        message: row.message,
        receivedAt: row.createdAt,
      }),
    );
    await prisma.contactMessage.update({
      where: { id: row.id },
      data: {
        emailStatus: "SENT",
        emailSentAt: new Date(),
        emailAttempts: { increment: 1 },
        emailLastError: null,
      },
    });
    return { kind: "sent" };
  } catch (error) {
    const outcome = outcomeForFailure(row.emailAttempts, error);
    if (outcome.kind === "keep") return { kind: "blocked", reason: outcome.reason };

    await prisma.contactMessage.update({
      where: { id: row.id },
      data: {
        emailStatus: outcome.kind === "giveUp" ? "FAILED" : "PENDING",
        emailAttempts: outcome.attempts,
        emailLastError: outcome.error,
      },
    });
    return { kind: outcome.kind === "giveUp" ? "gaveUp" : "retrying" };
  }
}

/**
 * The sweep's half: everything still PENDING, oldest first.
 *
 * A message given up on stays in the table as FAILED with its reason, and the
 * sweep says so every run, because it is a customer who wrote and was never
 * read. It can still be read here, in `contact_messages`, until it ages out.
 */
export async function drainContactMessages(): Promise<{
  sent: number;
  retrying: number;
  gaveUp: number;
  blocked: string | null;
}> {
  const queued = await prisma.contactMessage.findMany({
    where: {
      emailStatus: "PENDING",
      emailAttempts: { lt: EMAIL_MAX_ATTEMPTS },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  let sent = 0;
  let retrying = 0;
  let gaveUp = 0;
  let blocked: string | null = null;

  for (const row of queued) {
    const result = await deliverContactMessage(row);
    if (result.kind === "blocked") {
      blocked = result.reason;
      break;
    }
    if (result.kind === "sent") sent++;
    else if (result.kind === "gaveUp") gaveUp++;
    else retrying++;
  }

  return { sent, retrying, gaveUp, blocked };
}

/** Deletes messages past `CONTACT_RETENTION_DAYS`. Run by the weekly cleanup. */
export async function purgeOldContactMessages(): Promise<number> {
  const cutoff = new Date(
    Date.now() - CONTACT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const { count } = await prisma.contactMessage.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return count;
}
