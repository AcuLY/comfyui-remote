import { extractApiErrorMessage } from "./api-error-message";

export type PresetSectionReplacementFormRule = {
  fromPresetId: string;
  toPresetId: string;
  toVariantId?: string | null;
};

export type PresetSectionReplacementPayload = {
  dryRun: boolean;
  rules: Array<{
    fromPresetId: string;
    toPresetId: string;
    toVariantId?: string;
  }>;
};

function optionalTrimmed(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : undefined;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function buildPresetSectionReplacementPayload(input: {
  dryRun: boolean;
  rules: PresetSectionReplacementFormRule[];
}): PresetSectionReplacementPayload {
  const rules = input.rules.map((rule, index) => {
    const fromPresetId = optionalTrimmed(rule.fromPresetId);
    const toPresetId = optionalTrimmed(rule.toPresetId);
    const toVariantId = optionalTrimmed(rule.toVariantId);
    if (!fromPresetId) throw new Error(`rules[${index}].fromPresetId is required`);
    if (!toPresetId) throw new Error(`rules[${index}].toPresetId is required`);
    return {
      fromPresetId,
      toPresetId,
      ...(toVariantId ? { toVariantId } : {}),
    };
  });

  return {
    dryRun: input.dryRun,
    rules,
  };
}

export function summarizePresetSectionReplacementPlan(plan: unknown) {
  const record = plan && typeof plan === "object" ? plan as Record<string, unknown> : {};
  const rules = readArray(record.rules);
  let planned = typeof record.totalPlannedUpdateCount === "number" ? record.totalPlannedUpdateCount : 0;
  let noopRules = 0;
  let blockedRules = 0;
  let blockers = readArray(record.globalBlockers).length;

  if (typeof record.totalPlannedUpdateCount !== "number") {
    planned = 0;
  }

  for (const rule of rules) {
    if (!rule || typeof rule !== "object") continue;
    const ruleRecord = rule as Record<string, unknown>;
    if (ruleRecord.status === "noop") noopRules += 1;
    if (ruleRecord.status === "blocked") blockedRules += 1;
    blockers += readArray(ruleRecord.blockers).length;
    if (typeof record.totalPlannedUpdateCount !== "number") {
      planned += readArray(ruleRecord.updates).length;
    }
  }

  return {
    planned,
    noopRules,
    blockedRules,
    blockers,
  };
}

export function extractPresetSectionReplacementError(payload: unknown, fallback: string): string {
  return extractApiErrorMessage(payload, fallback);
}
