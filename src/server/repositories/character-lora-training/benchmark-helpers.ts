import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";

import { toInputJsonValue, readJsonRecord } from "./helpers";
import { serializeBenchmarkTemplate } from "./serializers";
import {
  BENCHMARK_TEMPLATE_SELECT,
  CHARACTER_LORA_BENCHMARK_TEMPLATE_NAME,
  CHARACTER_LORA_BENCHMARK_TEMPLATE_NAME_TERMS,
  CHARACTER_LORA_BENCHMARK_TEMPLATE_DESCRIPTION,
  CHARACTER_LORA_BENCHMARK_TEMPLATE_REQUIRED_SECTION_COUNT,
  CHARACTER_LORA_BENCHMARK_TEMPLATE_SECTIONS,
  type BenchmarkTemplateRecord,
} from "./types";

export function buildBenchmarkMatrixItems(checkpointMatrix: string[], weightMatrix: number[]) {
  return checkpointMatrix.flatMap((checkpointName, checkpointIndex) =>
    weightMatrix.map((weight, weightIndex) => ({
      checkpointName,
      checkpointIndex,
      weight: roundBenchmarkWeight(weight),
      weightIndex,
      matrixIndex: checkpointIndex * weightMatrix.length + weightIndex,
    })),
  );
}

export function buildBenchmarkSectionMetadata(input: {
  benchmarkRunId: string;
  baseSectionIndex: number;
  originalSectionName: string;
  originalSortOrder: number;
  matrixItem: ReturnType<typeof buildBenchmarkMatrixItems>[number];
}) {
  return {
    benchmarkRunId: input.benchmarkRunId,
    originalSectionName: input.originalSectionName,
    originalSortOrder: input.originalSortOrder,
    baseSectionIndex: input.baseSectionIndex,
    checkpointName: input.matrixItem.checkpointName,
    checkpointIndex: input.matrixItem.checkpointIndex,
    weight: input.matrixItem.weight,
    weightIndex: input.matrixItem.weightIndex,
    matrixIndex: input.matrixItem.matrixIndex,
  };
}

export function decorateBenchmarkPromptBlocks<T extends { label: string; positive: string; negative?: string | null; sortOrder?: number | null }>(
  blocks: T[],
  metadata: ReturnType<typeof buildBenchmarkSectionMetadata>,
) {
  const matrixLabel = [
    `section=${metadata.originalSectionName}`,
    `checkpoint=${shortCheckpointName(metadata.checkpointName)}`,
    `weight=${formatBenchmarkWeight(metadata.weight)}`,
  ].join(" | ");

  return blocks.map((block) => ({
    ...block,
    label: `${block.label} [${matrixLabel}]`,
  }));
}

export function buildBenchmarkExtraParams(
  value: unknown,
  metadata: ReturnType<typeof buildBenchmarkSectionMetadata>,
) {
  const base = readJsonRecord(value);
  return toInputJsonValue({
    ...base,
    characterLoraBenchmark: metadata,
  });
}

export function buildBenchmarkSectionLoraConfig(loraPath: string, weight: number) {
  return toInputJsonValue({
    lora1: [makeBenchmarkSectionLoraEntry(loraPath, weight, "lora1")],
    lora2: [makeBenchmarkSectionLoraEntry(loraPath, weight, "lora2")],
  });
}

function makeBenchmarkSectionLoraEntry(pathValue: string, weight: number, suffix: string) {
  return {
    id: `lora-${randomUUID()}`,
    path: pathValue,
    weight: roundBenchmarkWeight(weight),
    enabled: true,
    source: "preset",
    sourceLabel: "Character LoRA",
    sourceColor: "78 50% 55%",
    sourceName: "Character LoRA benchmark",
    bindingId: `bind-${suffix}-${randomUUID()}`,
  };
}

export function buildBenchmarkMatrixExpansionSummary(input: {
  checkpointMatrix: string[];
  weightMatrix: number[];
  sections: Array<{
    id: string;
    name: string | null;
    sortOrder: number;
    checkpointName: string | null;
    loraConfig: unknown;
    extraParams: unknown;
    promptBlocks: Array<{
      label: string | null;
      positive: string;
    }>;
  }>;
}) {
  const sections = input.sections.map((section) => {
    const metadata = readBenchmarkMetadata(section.extraParams);
    const checkpointName = metadata?.checkpointName ?? section.checkpointName ?? null;
    const weight = metadata?.weight ?? readLoraWeight(section.loraConfig);
    return {
      projectSectionId: section.id,
      sectionName: section.name,
      sortOrder: section.sortOrder,
      originalSectionName: metadata?.originalSectionName ?? section.name,
      baseSectionIndex: metadata?.baseSectionIndex ?? null,
      originalSortOrder: metadata?.originalSortOrder ?? null,
      checkpointName,
      checkpointIndex: metadata?.checkpointIndex ?? inferStringIndex(input.checkpointMatrix, checkpointName),
      weight,
      weightIndex: metadata?.weightIndex ?? inferNumberIndex(input.weightMatrix, weight),
      matrixIndex: metadata?.matrixIndex ?? null,
      promptBlockLabels: section.promptBlocks
        .map((block) => block.label)
        .filter((label): label is string => Boolean(label)),
    };
  });
  const baseKeys = new Set(
    sections.map((section) =>
      section.baseSectionIndex !== null
        ? `index:${section.baseSectionIndex}`
        : `name:${section.originalSectionName ?? section.sectionName ?? section.sortOrder}`,
    ),
  );
  const matrixSize = Math.max(1, input.checkpointMatrix.length * input.weightMatrix.length);
  const baseSectionCount = baseKeys.size > 0 ? baseKeys.size : Math.floor(sections.length / matrixSize);

  return {
    expectedSectionCount: baseSectionCount * input.checkpointMatrix.length * input.weightMatrix.length,
    actualSectionCount: sections.length,
    baseSectionCount,
    checkpointMatrix: input.checkpointMatrix,
    weightMatrix: input.weightMatrix,
    sections,
  };
}

export function readBenchmarkMetadata(value: unknown) {
  const metadata = readJsonRecord(readJsonRecord(value).characterLoraBenchmark);
  const originalSectionName = typeof metadata.originalSectionName === "string" ? metadata.originalSectionName : null;
  const checkpointName = typeof metadata.checkpointName === "string" ? metadata.checkpointName : null;
  const weight = typeof metadata.weight === "number" ? metadata.weight : null;
  if (!originalSectionName && !checkpointName && weight === null) {
    return null;
  }

  return {
    originalSectionName,
    originalSortOrder: typeof metadata.originalSortOrder === "number" ? metadata.originalSortOrder : null,
    baseSectionIndex: typeof metadata.baseSectionIndex === "number" ? metadata.baseSectionIndex : null,
    checkpointName,
    checkpointIndex: typeof metadata.checkpointIndex === "number" ? metadata.checkpointIndex : null,
    weight,
    weightIndex: typeof metadata.weightIndex === "number" ? metadata.weightIndex : null,
    matrixIndex: typeof metadata.matrixIndex === "number" ? metadata.matrixIndex : null,
  };
}

export function readLoraWeight(value: unknown) {
  const record = readJsonRecord(value);
  for (const key of ["lora1", "lora2"] as const) {
    const entries = record[key];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const weight = readJsonRecord(entry).weight;
      if (typeof weight === "number" && weight > 0) {
        return roundBenchmarkWeight(weight);
      }
    }
  }
  return null;
}

export function readStringArrayFromJson(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
    : [];
}

export function readNumberArrayFromJson(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === "number" && Number.isFinite(item) && item > 0)
      .map(roundBenchmarkWeight)
    : [];
}

export function inferStringIndex(values: string[], value: string | null) {
  if (!value) return null;
  const index = values.indexOf(value);
  return index >= 0 ? index : null;
}

export function inferNumberIndex(values: number[], value: number | null) {
  if (value === null) return null;
  const index = values.findIndex((candidate) => roundBenchmarkWeight(candidate) === roundBenchmarkWeight(value));
  return index >= 0 ? index : null;
}

export function shortCheckpointName(checkpointName: string) {
  return checkpointName.split(/[\\/]/).pop() ?? checkpointName;
}

export function formatBenchmarkWeight(value: number) {
  return String(roundBenchmarkWeight(value));
}

export function roundBenchmarkWeight(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function normalizeTemplatePromptBlocks(
  value: unknown,
  fallback: { label: string; positive: string; negative?: string | null },
) {
  if (!Array.isArray(value) || value.length === 0) {
    return [{ ...fallback, sortOrder: 0 }];
  }

  const blocks = value
    .map((block, index) => {
      if (!block || typeof block !== "object" || Array.isArray(block)) {
        return null;
      }
      const record = block as Record<string, unknown>;
      const positive = typeof record.positive === "string" ? record.positive : "";
      return {
        label: typeof record.label === "string" && record.label.trim() ? record.label : `Block ${index + 1}`,
        positive,
        negative: typeof record.negative === "string" ? record.negative : null,
        sortOrder: typeof record.sortOrder === "number" ? record.sortOrder : index,
      };
    })
    .filter((block): block is { label: string; positive: string; negative: string | null; sortOrder: number } =>
      Boolean(block && (block.positive.trim() || block.negative?.trim())),
    );

  return blocks.length > 0 ? blocks : [{ ...fallback, sortOrder: 0 }];
}

export function buildBenchmarkTemplateStatus(template: ReturnType<typeof serializeBenchmarkTemplate> | null) {
  return {
    status: template ? "found" as const : "missing" as const,
    found: Boolean(template),
    template,
    requiredTemplateNames: [...CHARACTER_LORA_BENCHMARK_TEMPLATE_NAME_TERMS],
    requiredSectionCount: CHARACTER_LORA_BENCHMARK_TEMPLATE_REQUIRED_SECTION_COUNT,
  };
}

export async function findPreferredCharacterLoraBenchmarkTemplate(
  client: Pick<Prisma.TransactionClient, "projectTemplate"> = db,
) {
  const templates = await client.projectTemplate.findMany({
    where: buildCharacterLoraBenchmarkTemplateWhere(),
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: BENCHMARK_TEMPLATE_SELECT,
  });

  return templates.find((template) => (
    template._count.sections >= CHARACTER_LORA_BENCHMARK_TEMPLATE_REQUIRED_SECTION_COUNT
  )) ?? templates[0] ?? null;
}

export function buildCharacterLoraBenchmarkTemplateWhere(): Prisma.ProjectTemplateWhereInput {
  return {
    OR: CHARACTER_LORA_BENCHMARK_TEMPLATE_NAME_TERMS.map((term) => ({ name: { contains: term } })),
  };
}

export function buildCharacterLoraBenchmarkTemplateSections(checkpointName: string | null) {
  return CHARACTER_LORA_BENCHMARK_TEMPLATE_SECTIONS.map((section, index) => ({
    sortOrder: index,
    name: section.name,
    notes: "Standard Character LoRA benchmark/promotion evidence section.",
    aspectRatio: "2:3",
    shortSidePx: 768,
    batchSize: 1,
    seedPolicy1: "random",
    seedPolicy2: "reuse",
    ksampler1: toInputJsonValue({
      steps: 24,
      cfg: 6.5,
      samplerName: "euler",
      scheduler: "normal",
    }),
    ksampler2: toInputJsonValue({
      steps: 12,
      cfg: 6,
      samplerName: "euler",
      scheduler: "normal",
    }),
    upscaleFactor: 1,
    checkpointName,
    extraParams: toInputJsonValue({
      characterLoraBenchmarkTemplate: {
        standardVariant: true,
        variantSlug: section.slug,
        variantName: section.name,
        sortOrder: index,
      },
    }),
    promptBlocks: toInputJsonValue([{
      label: `Benchmark ${section.name}`,
      positive: [
        "character LoRA trigger token",
        "target character",
        section.promptSuffix,
        "clear face",
        "benchmark test",
      ].join(", "),
      negative: "low quality, bad anatomy, text, watermark",
      sortOrder: 0,
    }]),
  }));
}

export function normalizeOptionalTemplateCheckpointName(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
