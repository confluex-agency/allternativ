import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  // MySQL/MariaDB on the Hostinger plan. The adapter takes the same
  // mysql://user:pass@host:3306/db URL the panel gives you.
  const adapter = new PrismaMariaDb(env.DATABASE_URL);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
