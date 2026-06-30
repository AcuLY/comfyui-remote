export type SyncPresetVariantFlowFormValues = {
  sourceProjectTitle: string;
  targetProjectTitle: string;
  expectedSourceProjectId?: string;
  expectedTargetProjectId?: string;
  sampleSectionNumbersText?: string;
  dryRun: boolean;
};

export type SyncPresetVariantFlowPayload = {
  sourceProjectTitle: string;
  targetProjectTitle: string;
  expectedSourceProjectId?: string;
  expectedTargetProjectId?: string;
  matchSectionsBy: "name";
  matchVariantsBy: "name";
  dryRun: boolean;
  sampleSectionNumbers?: number[];
};

export type SyncPresetVariantFlowPlanSummary = {
  switchCount: number;
  skipCount: number;
  otherCount: number;
  skipReasons: Record<string, number>;
};

export type SyncPresetVariantFlowVerificationToastInput = {
  passed?: boolean;
  plannedUpdateCount?: number;
  loraConfig?: {
    totalSections?: number;
    okCount?: number;
    missingCount?: number;
  };
};

export type SyncPresetVariantFlowApplyToast = {
  tone: "success" | "warning";
  message: string;
};

function optionalTrimmed(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : undefined;
}

export function parseSampleSectionNumbersInput(value: string | undefined): number[] | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;

  const tokens = trimmed.split(/[\s,，]+/).filter(Boolean);
  const numbers = tokens.map((token) => Number(token));
  if (numbers.some((number) => !Number.isInteger(number) || number < 1)) {
    throw new Error("sampleSectionNumbers must be positive integers");
  }
  return [...new Set(numbers)];
}

export function buildSyncPresetVariantFlowPayload(values: SyncPresetVariantFlowFormValues): SyncPresetVariantFlowPayload {
  const sourceProjectTitle = values.sourceProjectTitle.trim();
  const targetProjectTitle = values.targetProjectTitle.trim();
  if (!sourceProjectTitle) throw new Error("sourceProjectTitle is required");
  if (!targetProjectTitle) throw new Error("targetProjectTitle is required");

  const sampleSectionNumbers = parseSampleSectionNumbersInput(values.sampleSectionNumbersText);
  const payload: SyncPresetVariantFlowPayload = {
    sourceProjectTitle,
    targetProjectTitle,
    matchSectionsBy: "name",
    matchVariantsBy: "name",
    dryRun: values.dryRun,
  };

  const expectedSourceProjectId = optionalTrimmed(values.expectedSourceProjectId);
  const expectedTargetProjectId = optionalTrimmed(values.expectedTargetProjectId);
  if (expectedSourceProjectId) payload.expectedSourceProjectId = expectedSourceProjectId;
  if (expectedTargetProjectId) payload.expectedTargetProjectId = expectedTargetProjectId;
  if (sampleSectionNumbers?.length) payload.sampleSectionNumbers = sampleSectionNumbers;

  return payload;
}

export function summarizeSyncPresetVariantFlowPlan(plan: Array<Record<string, unknown>> | undefined): SyncPresetVariantFlowPlanSummary {
  const summary: SyncPresetVariantFlowPlanSummary = {
    switchCount: 0,
    skipCount: 0,
    otherCount: 0,
    skipReasons: {},
  };

  for (const item of plan ?? []) {
    if (item.action === "switch") {
      summary.switchCount += 1;
      continue;
    }
    if (item.action === "skip") {
      summary.skipCount += 1;
      const reason = typeof item.reason === "string" && item.reason.trim() ? item.reason : "Unknown reason";
      summary.skipReasons[reason] = (summary.skipReasons[reason] ?? 0) + 1;
      continue;
    }
    summary.otherCount += 1;
  }

  return summary;
}

export function extractSyncPresetVariantFlowError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  const error = record.error;
  if (!error || typeof error !== "object") return fallback;
  const message = (error as Record<string, unknown>).message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

export function formatSyncPresetVariantFlowApplyToast(
  verification: SyncPresetVariantFlowVerificationToastInput | null | undefined,
): SyncPresetVariantFlowApplyToast {
  if (verification?.passed === true) {
    return {
      tone: "success",
      message: "Apply 完成，复查 plannedUpdateCount = 0",
    };
  }

  const plannedUpdateCount = verification?.plannedUpdateCount ?? "?";
  const parts = [`plannedUpdateCount=${plannedUpdateCount}`];
  const missingCount = verification?.loraConfig?.missingCount;
  if (typeof missingCount === "number") {
    const totalSections = verification?.loraConfig?.totalSections;
    parts.push(
      typeof totalSections === "number"
        ? `LoRA 缺失 ${missingCount}/${totalSections}`
        : `LoRA 缺失 ${missingCount}`,
    );
  }

  return {
    tone: "warning",
    message: `Apply 完成但复查未通过：${parts.join("，")}`,
  };
}
