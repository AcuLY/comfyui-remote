// Legacy entry point from backend branch — re-exports from prisma.ts
// New code should import { prisma } from "@/lib/prisma" directly.
import { prisma } from "@/lib/prisma";

export const db = prisma;
