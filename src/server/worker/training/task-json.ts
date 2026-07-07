import { Prisma } from "@/generated/prisma";

export function normalizeWorkerTaskJson(value: unknown): Prisma.InputJsonValue {
  if (value === null || typeof value === "undefined") return {};
  if (typeof value === "object") return value as Prisma.InputJsonValue;
  return { value } as Prisma.InputJsonValue;
}
