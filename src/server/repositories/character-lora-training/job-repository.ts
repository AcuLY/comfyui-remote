import { Prisma } from "@/generated/prisma";
import { CharacterLoraJobStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

import { ciContains } from "./helpers";
import { serializeJobSummary, serializeTrainingTemplate } from "./serializers";
import {
  JOB_SUMMARY_SELECT,
  TRAINING_TEMPLATE_SELECT,
  type CharacterLoraTrainingJobCreateInput,
  type CharacterLoraTrainingJobUpdateInput,
  type CharacterLoraTrainingJobListFilters,
  type CharacterLoraTrainingTemplateUpsertInput,
} from "./types";

export async function listCharacterLoraTrainingJobs(filters: CharacterLoraTrainingJobListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));
  const q = filters.q?.trim();
  const statusFilter = filters.status ?? null;

  const where: Prisma.CharacterLoraTrainingJobWhereInput = {
    ...(statusFilter ? { status: statusFilter } : { status: { not: CharacterLoraJobStatus.archived } }),
    ...(q
      ? {
          OR: [
            { characterName: ciContains(q) },
            { triggerToken: ciContains(q) },
            { slug: ciContains(q) },
            { baseCheckpointName: ciContains(q) },
          ],
        }
      : {}),
  };

  const [total, jobs] = await Promise.all([
    db.characterLoraTrainingJob.count({ where }),
    db.characterLoraTrainingJob.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: JOB_SUMMARY_SELECT,
    }),
  ]);

  return {
    jobs: jobs.map(serializeJobSummary),
    page,
    pageSize,
    total,
  };
}

export async function getCharacterLoraTrainingJob(jobId: string) {
  const job = await db.characterLoraTrainingJob.findUnique({
    where: { id: jobId },
    select: JOB_SUMMARY_SELECT,
  });

  return job ? serializeJobSummary(job) : null;
}

export async function findCharacterLoraTrainingJobBySlug(slug: string) {
  return db.characterLoraTrainingJob.findUnique({
    where: { slug },
    select: { id: true },
  });
}

export async function findActiveCharacterLoraTrainingJobByTriggerToken(input: {
  triggerToken: string;
  excludeJobId?: string;
}) {
  return db.characterLoraTrainingJob.findFirst({
    where: {
      triggerToken: input.triggerToken,
      status: { notIn: [CharacterLoraJobStatus.archived, CharacterLoraJobStatus.cancelled] },
      ...(input.excludeJobId ? { id: { not: input.excludeJobId } } : {}),
    },
    select: {
      id: true,
      slug: true,
      characterName: true,
      triggerToken: true,
      status: true,
    },
  });
}

export async function createCharacterLoraTrainingJob(input: CharacterLoraTrainingJobCreateInput) {
  const job = await db.characterLoraTrainingJob.create({
    data: input as Prisma.CharacterLoraTrainingJobUncheckedCreateInput,
    select: JOB_SUMMARY_SELECT,
  });

  return serializeJobSummary(job);
}

export async function updateCharacterLoraTrainingJob(jobId: string, input: CharacterLoraTrainingJobUpdateInput) {
  const job = await db.characterLoraTrainingJob.update({
    where: { id: jobId },
    data: input as Prisma.CharacterLoraTrainingJobUncheckedUpdateInput,
    select: JOB_SUMMARY_SELECT,
  });

  return serializeJobSummary(job);
}

export async function archiveCharacterLoraTrainingJob(
  jobId: string,
  input: { phase?: string | null } = {},
) {
  const job = await db.characterLoraTrainingJob.update({
    where: { id: jobId },
    data: {
      status: CharacterLoraJobStatus.archived,
      phase: input.phase ?? "archived",
    },
    select: JOB_SUMMARY_SELECT,
  });

  return serializeJobSummary(job);
}

export async function upsertCharacterLoraTrainingTemplates(
  templates: CharacterLoraTrainingTemplateUpsertInput[],
) {
  const records = await db.$transaction(
    templates.map((template) =>
      db.characterLoraTrainingTemplate.upsert({
        where: { key: template.key },
        update: template,
        create: template,
        select: TRAINING_TEMPLATE_SELECT,
      }),
    ),
  );

  return records.map(serializeTrainingTemplate);
}

export async function getCharacterLoraTrainingTemplate(input: { id?: string; key?: string }) {
  const where = input.id
    ? { id: input.id }
    : input.key
      ? { key: input.key }
      : null;

  if (!where) {
    return null;
  }

  const template = await db.characterLoraTrainingTemplate.findUnique({
    where,
    select: TRAINING_TEMPLATE_SELECT,
  });

  return template ? serializeTrainingTemplate(template) : null;
}

export async function listActiveCharacterLoraTrainingTemplates() {
  const templates = await db.characterLoraTrainingTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    select: TRAINING_TEMPLATE_SELECT,
  });

  return templates.map(serializeTrainingTemplate);
}
