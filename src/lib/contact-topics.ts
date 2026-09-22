// The subjects the contact form offers, and the only subjects it can send.
//
// ⚠️ This file imports nothing, on purpose. The form is a client component, and
// importing the list from `contact.ts` would pull Prisma into the browser
// bundle and kill the production build with `Can't resolve 'fs'` — the lesson
// `order-status.ts` and `roles.ts` already carry.
//
// It is also the security control, not just the menu: the route's zod enum is
// built from these keys, and the email's subject line is built from these
// labels. So the subject of a message arriving at the support mailbox is never
// text a visitor typed.

export const CONTACT_TOPICS = {
  GENERAL: "General enquiry",
  CUSTOM: "Special order",
  PRESS: "Press / collaboration",
  STOCKIST: "Distribution / stockist",
} as const;

export type ContactTopicKey = keyof typeof CONTACT_TOPICS;

export const CONTACT_TOPIC_KEYS = Object.keys(CONTACT_TOPICS) as [
  ContactTopicKey,
  ...ContactTopicKey[],
];

/**
 * How long a message stays in `contact_messages`. Read by the weekly cleanup,
 * the privacy page and the line under the form, so none of them can promise a
 * period the others do not keep.
 */
export const CONTACT_RETENTION_DAYS = 365;

/** Field limits, shared by the form's `maxLength` and the server's schema. */
export const CONTACT_LIMITS = {
  name: 120,
  email: 254,
  message: 5000,
} as const;
