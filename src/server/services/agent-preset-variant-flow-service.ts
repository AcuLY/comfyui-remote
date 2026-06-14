import { prisma } from "@/lib/prisma";
import { syncPresetVariants } from "@/server/services/agent-preset-variant-service";
import {
  buildSyncPresetVariantFlowVerification,
  parseSyncPresetVariantFlowInput,
  pickLatestProjectByExactTitle,
  type FlowDryRunForVerification,
  type FlowSectionForVerification,
  type FlowTargetPreset,
} from "@/server/services/agent-preset-variant-flow-core";

type ProjectLookup = {
  id: string;
  title: string;
  updatedAt: Date | string;
  createdAt?: Date | string;
};

type PresetRecord = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  createdAt: Date;
  category: {
    name: string;
    slug: string;
  };
};

type PresetCandidate = PresetRecord & {
  count: number;
  bindingKey: string;
  bindingSortOrder: number;
};

function isRoleCategory(category: { name: string; slug: string }) {
  const normalizedName = category.name.trim().toLocaleLowerCase();
  const normalizedSlug = category.slug.trim().toLocaleLowerCase();
  return normalizedName === "角色" || ["character", "characters", "role", "roles"].includes(normalizedSlug);
}

async function findProjectByTitle(title: string, expectedProjectId: string | null, errorPrefix: "SOURCE" | "TARGET"): Promise<ProjectLookup> {
  if (expectedProjectId) {
    const project = await prisma.project.findUnique({
      where: { id: expectedProjectId },
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
    where: { title },
    select: { id: true, title: true, updatedAt: true, createdAt: true },
  });
  return pickLatestProjectByExactTitle(projects, title);
}

async function findProjectRolePreset(projectId: string, errorPrefix: "SOURCE" | "TARGET") {
  const sections = await prisma.projectSection.findMany({
    where: { projectId, enabled: true },
    select: {
      presetBindingRows: {
        where: { presetId: { not: null } },
        select: {
          presetId: true,
          preset: {
            select: {
              id: true,
              name: true,
              slug: true,
              sortOrder: true,
              createdAt: true,
              category: { select: { name: true, slug: true } },
              isActive: true,
            },
          },
          bindingKey: true,
          sortOrder: true,
        },
      },
    },
  });

  const candidatesById = new Map<string, PresetCandidate>();
  for (const section of sections) {
    for (const binding of section.presetBindingRows) {
      const preset = binding.preset;
      if (!preset?.isActive) continue;
      if (!isRoleCategory(preset.category)) continue;

      const candidateKey = `${binding.bindingKey}\u0000${preset.id}`;
      const existing = candidatesById.get(candidateKey);
      if (existing) {
        existing.count += 1;
      } else {
        candidatesById.set(candidateKey, {
          id: preset.id,
          name: preset.name,
          slug: preset.slug,
          sortOrder: preset.sortOrder,
          createdAt: preset.createdAt,
          category: preset.category,
          count: 1,
          bindingKey: binding.bindingKey,
          bindingSortOrder: binding.sortOrder,
        });
      }
    }
  }

  const candidates = [...candidatesById.values()];
  if (candidates.length === 0) {
    throw new Error(`${errorPrefix}_ROLE_PRESET_NOT_INFERRED`);
  }

  const sortedCandidates = [...candidates].sort((left, right) => {
    const byCount = right.count - left.count;
    if (byCount !== 0) return byCount;
    const byBindingSortOrder = left.bindingSortOrder - right.bindingSortOrder;
    if (byBindingSortOrder !== 0) return byBindingSortOrder;
    const bySortOrder = left.sortOrder - right.sortOrder;
    if (bySortOrder !== 0) return bySortOrder;
    return left.createdAt.getTime() - right.createdAt.getTime();
  });

  const [picked, runnerUp] = sortedCandidates;
  if (
    runnerUp &&
    runnerUp.count === picked.count &&
    runnerUp.bindingSortOrder === picked.bindingSortOrder &&
    runnerUp.sortOrder === picked.sortOrder
  ) {
    throw new Error(`${errorPrefix}_ROLE_PRESET_AMBIGUOUS`);
  }

  return picked;
}

async function findPresetForVerification(presetId: string): Promise<FlowTargetPreset> {
  const preset = await prisma.preset.findFirst({
    where: {
      id: presetId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      variants: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  if (!preset) throw new Error("TARGET_PRESET_NOT_FOUND");
  return preset;
}

async function getSectionsForVerification(projectId: string): Promise<FlowSectionForVerification[]> {
  const sections = await prisma.projectSection.findMany({
    where: { projectId, enabled: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      sortOrder: true,
      manualLoraEntries: {
        select: {
          sectionBindingId: true,
          enabled: true,
        },
      },
      sectionPromptBlocks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          sectionBindingId: true,
          customLabel: true,
          sectionBinding: {
            select: {
              presetId: true,
              variantId: true,
              preset: { select: { name: true } },
              variant: { select: { name: true } },
            },
          },
          sortOrder: true,
        },
      },
    },
  });

  return sections.map((section) => ({
    id: section.id,
    name: section.name,
    sortOrder: section.sortOrder,
    manualLoraEntries: section.manualLoraEntries,
    promptBlocks: section.sectionPromptBlocks.map((block) => ({
      id: block.id,
      sourceId: block.sectionBinding?.presetId ?? null,
      variantId: block.sectionBinding?.variantId ?? null,
      bindingId: block.sectionBindingId,
        label: block.customLabel ??
          [
          block.sectionBinding?.preset?.name,
          block.sectionBinding?.variant?.name,
        ].filter(Boolean).join(" / "),
      sortOrder: block.sortOrder,
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
  const [sourceRolePreset, targetRolePreset] = await Promise.all([
    findProjectRolePreset(sourceProject.id, "SOURCE"),
    findProjectRolePreset(targetProject.id, "TARGET"),
  ]);

  const syncBody = {
    sourceProjectId: sourceProject.id,
    sourcePresetId: sourceRolePreset.id,
    sourcePresetName: sourceRolePreset.name,
    targetPresetId: targetRolePreset.id,
    targetPresetName: targetRolePreset.name,
    matchSectionsBy: input.matchSectionsBy,
    matchVariantsBy: input.matchVariantsBy,
  };
  const initialDryRun = await syncPresetVariants(targetProject.id, { ...syncBody, dryRun: true });
  const resolvedSyncBody = {
    ...syncBody,
    sourcePresetName: initialDryRun.sourcePreset.name,
    targetPresetName: initialDryRun.targetPreset.name,
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

  const apply = await syncPresetVariants(targetProject.id, { ...resolvedSyncBody, dryRun: false });
  const verificationDryRun = await syncPresetVariants(targetProject.id, { ...resolvedSyncBody, dryRun: true });
  const [targetPreset, sections] = await Promise.all([
    findPresetForVerification(targetRolePreset.id),
    getSectionsForVerification(targetProject.id),
  ]);
  const verification = buildSyncPresetVariantFlowVerification({
    targetPresetName: resolvedSyncBody.targetPresetName,
    verificationDryRun: toVerificationDryRun(verificationDryRun),
    sections,
    targetPreset,
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
