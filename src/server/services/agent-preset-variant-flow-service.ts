import { prisma } from "@/lib/prisma";
import { buildGenerationProjectWhere } from "@/server/repositories/generation-resource-boundary";
import { resolveSectionConfigsById } from "@/server/repositories/project-repository/helpers";
import { buildRoleCategoryWhere, syncPresetVariants } from "@/server/services/agent-preset-variant-service";
import {
  buildRoleSyncPresetVariantFlowVerification,
  parseSyncPresetVariantFlowInput,
  pickLatestProjectByExactTitle,
  type FlowDryRunForVerification,
  type FlowSectionForVerification,
} from "@/server/services/agent-preset-variant-flow-core";

type ProjectLookup = {
  id: string;
  title: string;
  updatedAt: Date | string;
  createdAt?: Date | string;
};

const PROJECT_SECTION_QUERY_BATCH_SIZE = 250;

async function findProjectByTitle(title: string, expectedProjectId: string | null, errorPrefix: "SOURCE" | "TARGET"): Promise<ProjectLookup> {
  if (expectedProjectId) {
    const project = await prisma.project.findFirst({
      where: buildGenerationProjectWhere({ id: expectedProjectId }),
      select: { id: true, title: true, updatedAt: true, createdAt: true },
    });
    if (!project) {
      throw new Error(`${errorPrefix}_PROJECT_NOT_FOUND`);
    }
    if (project.title.trim() !== title.trim()) {
      throw new Error(`${errorPrefix}_PROJECT_TITLE_MISMATCH`);
    }
    return project;
  }

  const projects = await prisma.project.findMany({
    where: buildGenerationProjectWhere({ title }),
    select: { id: true, title: true, updatedAt: true, createdAt: true },
  });
  return pickLatestProjectByExactTitle(projects, title);
}

async function getSectionsForVerification(projectId: string): Promise<FlowSectionForVerification[]> {
  const sections = [];
  for (let skip = 0; ; skip += PROJECT_SECTION_QUERY_BATCH_SIZE) {
    const page = await prisma.projectSection.findMany({
      where: {
        projectId,
        enabled: true,
        project: buildGenerationProjectWhere({ id: projectId }),
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      skip,
      take: PROJECT_SECTION_QUERY_BATCH_SIZE,
      select: {
        id: true,
        name: true,
        sortOrder: true,
        presetBindingRows: {
          where: {
            presetId: { not: null },
            category: buildRoleCategoryWhere(),
          },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            bindingKey: true,
            presetId: true,
            variantId: true,
            sortOrder: true,
            category: { select: { name: true, slug: true } },
            preset: { select: { name: true } },
            variant: { select: { name: true } },
          },
        },
      },
    });
    sections.push(...page);
    if (page.length < PROJECT_SECTION_QUERY_BATCH_SIZE) break;
  }

  const resolvedConfigsBySectionId = await resolveSectionConfigsById(sections.map((section) => section.id));

  return sections.map((section) => ({
    id: section.id,
    name: section.name,
    sortOrder: section.sortOrder,
    manualLoraEntries: [],
    loraEntries: [
      ...(resolvedConfigsBySectionId.get(section.id)?.loraConfig.lora1 ?? []),
      ...(resolvedConfigsBySectionId.get(section.id)?.loraConfig.lora2 ?? []),
    ].map((entry) => ({
      bindingId: entry.bindingId,
      enabled: entry.enabled,
    })),
    promptBlocks: section.presetBindingRows.map((binding) => ({
      id: binding.id,
      sourceId: binding.presetId,
      variantId: binding.variantId,
      bindingId: binding.bindingKey,
      categoryName: binding.category?.name ?? null,
      categorySlug: binding.category?.slug ?? null,
      presetName: binding.preset?.name ?? null,
      variantName: binding.variant?.name ?? null,
      label: [
        binding.preset?.name,
        binding.variant?.name,
      ].filter(Boolean).join(" / "),
      sortOrder: binding.sortOrder,
    })),
  }));
}

function toVerificationDryRun(result: Awaited<ReturnType<typeof syncPresetVariants>>): FlowDryRunForVerification {
  return {
    plannedUpdateCount: result.plannedUpdateCount,
    plan: result.plan,
  };
}

export async function syncPresetVariantFlow(body: unknown) {
  const input = parseSyncPresetVariantFlowInput(body);
  const [sourceProject, targetProject] = await Promise.all([
    findProjectByTitle(input.sourceProjectTitle, input.expectedSourceProjectId, "SOURCE"),
    findProjectByTitle(input.targetProjectTitle, input.expectedTargetProjectId, "TARGET"),
  ]);

  const syncBody = {
    sourceProjectId: sourceProject.id,
    matchSectionsBy: input.matchSectionsBy,
    matchVariantsBy: input.matchVariantsBy,
  };
  const initialDryRun = await syncPresetVariants(targetProject.id, { ...syncBody, dryRun: true });
  const resolvedSyncBody = {
    ...syncBody,
    sourcePresetName: initialDryRun.sourcePreset?.name ?? null,
    targetPresetName: initialDryRun.targetPreset?.name ?? null,
  };

  if (input.dryRun) {
    return {
      dryRun: true,
      sourceProject: { id: sourceProject.id, title: sourceProject.title, updatedAt: sourceProject.updatedAt },
      targetProject: { id: targetProject.id, title: targetProject.title, updatedAt: targetProject.updatedAt },
      sourcePresetName: resolvedSyncBody.sourcePresetName,
      targetPresetName: resolvedSyncBody.targetPresetName,
      initialDryRun,
    };
  }

  const apply = await syncPresetVariants(targetProject.id, { ...syncBody, dryRun: false });
  const verificationDryRun = await syncPresetVariants(targetProject.id, { ...syncBody, dryRun: true });
  const sections = await getSectionsForVerification(targetProject.id);
  const verification = buildRoleSyncPresetVariantFlowVerification({
    verificationDryRun: toVerificationDryRun(verificationDryRun),
    sections,
    sampleSectionNumbers: input.sampleSectionNumbers,
  });

  return {
    dryRun: false,
    sourceProject: { id: sourceProject.id, title: sourceProject.title, updatedAt: sourceProject.updatedAt },
    targetProject: { id: targetProject.id, title: targetProject.title, updatedAt: targetProject.updatedAt },
    sourcePresetName: resolvedSyncBody.sourcePresetName,
    targetPresetName: resolvedSyncBody.targetPresetName,
    initialDryRun,
    apply,
    verificationDryRun,
    verification,
  };
}
