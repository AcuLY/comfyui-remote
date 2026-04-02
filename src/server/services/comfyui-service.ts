import { Prisma } from "@/generated/prisma";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { resolveResolution } from "@/lib/aspect-ratio-utils";
import {
  parseLoraBindings,
  parseKSamplerParams,
  parseSectionLoraConfig,
  DEFAULT_KSAMPLER1,
  DEFAULT_KSAMPLER2,
} from "@/lib/lora-types";
import { buildFallbackPromptNodes } from "@/server/worker/fallback-prompt-builder";
import {
  buildWorkflowPrompt,
  type WorkflowBuildInput,
} from "@/server/services/workflow-prompt-builder";
import {
  getWorkflowTemplate,
  resolveWorkflowTemplate,
} from "@/server/services/workflow-template-service";
import { ComfyPromptDraft } from "@/server/worker/types";

// ComfyUI service logger
const log = createLogger({ module: "comfyui" });

type JsonRecord = Record<string, unknown>;

type ComfyPromptHistoryEntry = {
  outputs: JsonRecord | null;
  status: JsonRecord | null;
};

export type ComfyPromptOutputImage = {
  filename: string;
  subfolder: string;
  type: string;
};

export type ComfyPromptExecutionResult = {
  comfyPromptId: string;
  outputDir: string | null;
  outputImages: ComfyPromptOutputImage[];
  /** Execution metadata extracted from the submitted prompt (seeds, params) */
  executionMeta: Record<string, unknown> | null;
};

export class ComfyPromptExecutionError extends Error {
  readonly comfyPromptId: string | null;

  constructor(message: string, comfyPromptId: string | null) {
    super(message);
    this.name = "ComfyPromptExecutionError";
    this.comfyPromptId = comfyPromptId;
  }
}

type ValidatedComfyPromptDraft = {
  apiUrl: string;
  apiPrompt: JsonRecord;
  extraData: JsonRecord;
};

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function asJsonRecord(value: Prisma.JsonValue | null | undefined): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function normalizeApiUrl(apiUrl: string) {
  const normalizedApiUrl = apiUrl.trim().replace(/\/+$/, "");

  if (!normalizedApiUrl) {
    throw new Error("ComfyUI API URL is empty");
  }

  return normalizedApiUrl;
}

function formatUnknownValue(value: unknown) {
  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 497)}...` : value;
  }

  try {
    const serializedValue = JSON.stringify(value);
    return serializedValue.length > 500
      ? `${serializedValue.slice(0, 497)}...`
      : serializedValue;
  } catch {
    return String(value);
  }
}

function extractJsonRecordByKeys(
  source: JsonRecord | null,
  keys: string[],
) {
  if (!source) {
    return null;
  }

  for (const key of keys) {
    const candidate = asRecord(source[key]);

    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function extractHistoryEntry(
  payload: unknown,
  promptId: string,
): ComfyPromptHistoryEntry | null {
  const root = asRecord(payload);

  if (!root) {
    return null;
  }

  const directEntry = asRecord(root[promptId]);
  const historyEntry = directEntry ?? root;

  return {
    outputs: asRecord(historyEntry.outputs),
    status: asRecord(historyEntry.status),
  };
}

function extractHistoryMessages(entry: ComfyPromptHistoryEntry) {
  const messages = entry.status?.messages;
  return Array.isArray(messages) ? messages : [];
}

function extractHistoryFailureMessage(entry: ComfyPromptHistoryEntry) {
  for (const message of extractHistoryMessages(entry)) {
    if (!Array.isArray(message) || message.length === 0) {
      continue;
    }

    const eventName = typeof message[0] === "string" ? message[0] : null;
    const payload = asRecord(message[1]);

    if (eventName === "execution_error") {
      const exceptionType =
        typeof payload?.exception_type === "string" ? payload.exception_type : null;
      const exceptionMessage =
        typeof payload?.exception_message === "string" ? payload.exception_message : null;
      const nodeId =
        typeof payload?.node_id === "string" || typeof payload?.node_id === "number"
          ? String(payload.node_id)
          : null;

      const details = [exceptionType, exceptionMessage, nodeId ? `node ${nodeId}` : null].filter(
        (value): value is string => Boolean(value),
      );

      return details.length > 0
        ? `ComfyUI execution_error: ${details.join(" | ")}`
        : "ComfyUI execution_error";
    }

    if (eventName === "execution_interrupted") {
      return "ComfyUI execution was interrupted";
    }
  }

  const statusText =
    typeof entry.status?.status_str === "string"
      ? entry.status.status_str.trim().toLowerCase()
      : null;

  if (statusText === "error" || statusText === "failed") {
    return `ComfyUI reported prompt failure with status "${statusText}"`;
  }

  return null;
}

function isHistoryComplete(entry: ComfyPromptHistoryEntry) {
  if (entry.status?.completed === true) {
    return true;
  }

  return Boolean(entry.outputs && Object.keys(entry.outputs).length > 0);
}

/**
 * Extract execution metadata (seeds, KSampler params) from the submitted prompt.
 * KSampler nodes (3 = KS1, 427 = KS2) contain the actual seed values used.
 */
function extractExecutionMeta(apiPrompt: JsonRecord): Record<string, unknown> {
  const meta: Record<string, unknown> = {};

  // KSampler1 (node 3)
  const ks1 = asRecord(asRecord(apiPrompt["3"])?.inputs);
  if (ks1) {
    meta.ks1Seed = typeof ks1.seed === "number" ? ks1.seed : null;
    meta.ks1Steps = ks1.steps ?? null;
    meta.ks1Cfg = ks1.cfg ?? null;
    meta.ks1Sampler = ks1.sampler_name ?? null;
    meta.ks1Scheduler = ks1.scheduler ?? null;
    meta.ks1Denoise = ks1.denoise ?? null;
  }

  // KSampler2 (node 427) — only present when hires fix is active
  const ks2 = asRecord(asRecord(apiPrompt["427"])?.inputs);
  if (ks2) {
    meta.ks2Seed = typeof ks2.seed === "number" ? ks2.seed : null;
    meta.ks2Steps = ks2.steps ?? null;
    meta.ks2Cfg = ks2.cfg ?? null;
    meta.ks2Sampler = ks2.sampler_name ?? null;
    meta.ks2Scheduler = ks2.scheduler ?? null;
    meta.ks2Denoise = ks2.denoise ?? null;
  }

  return meta;
}

function extractOutputImages(entry: ComfyPromptHistoryEntry): ComfyPromptOutputImage[] {
  if (!entry.outputs) {
    return [];
  }

  const images: ComfyPromptOutputImage[] = [];
  const seenImages = new Set<string>();

  for (const nodeOutput of Object.values(entry.outputs)) {
    const output = asRecord(nodeOutput);
    const outputImages = Array.isArray(output?.images) ? output.images : [];

    for (const image of outputImages) {
      const imageRecord = asRecord(image);
      const filename =
        typeof imageRecord?.filename === "string" ? imageRecord.filename.trim() : "";

      if (!filename) {
        continue;
      }

      const subfolder =
        typeof imageRecord?.subfolder === "string" ? imageRecord.subfolder.trim() : "";
      const type =
        typeof imageRecord?.type === "string" && imageRecord.type.trim()
          ? imageRecord.type.trim()
          : "output";
      const imageKey = `${type}::${subfolder}::${filename}`;

      if (seenImages.has(imageKey)) {
        continue;
      }

      seenImages.add(imageKey);
      images.push({
        filename,
        subfolder,
        type,
      });
    }
  }

  return images;
}

function extractOutputDir(images: ComfyPromptOutputImage[]) {
  if (images.length === 0) {
    return null;
  }

  const subfolder = images[0]?.subfolder.replace(/\\/g, "/").replace(/^\/+/, "") ?? "";
  return subfolder || null;
}

async function sleep(ms: number) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchJson(
  url: string,
  init: RequestInit,
  context: string,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, env.comfyRequestTimeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...init.headers,
      },
    });
    const responseText = await response.text();
    let data: unknown = null;

    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        data = responseText;
      }
    }

    if (!response.ok) {
      throw new Error(
        `${context} failed with ${response.status}: ${formatUnknownValue(data ?? response.statusText)}`,
      );
    }

    if (responseText && typeof data === "string") {
      throw new Error(`${context} returned an invalid JSON response: ${formatUnknownValue(data)}`);
    }

    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${context} timed out after ${env.comfyRequestTimeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveApiPromptFromWorkflowTemplate(
  extraParams: JsonRecord | null,
  promptDraft: ComfyPromptDraft,
): Promise<JsonRecord | null> {
  const templateId =
    typeof extraParams?.workflowTemplateId === "string"
      ? extraParams.workflowTemplateId.trim()
      : null;

  if (!templateId) {
    return null;
  }

  const template = await getWorkflowTemplate(templateId);

  if (!template) {
    throw new Error(
      `Workflow template "${templateId}" not found in config/workflows/`,
    );
  }

  // Build variable overrides from the prompt draft
  const resolution = resolveResolution(
    promptDraft.parameters.aspectRatio,
    promptDraft.parameters.shortSidePx,
  );
  const seed =
    promptDraft.parameters.seedPolicy === "fixed"
      ? 42
      : Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

  const overrides: Record<string, string | number> = {
    positivePrompt: promptDraft.prompt.positive,
    negativePrompt:
      promptDraft.prompt.negative ?? "",
    width: resolution.width,
    height: resolution.height,
    batchSize: promptDraft.parameters.batchSize ?? 1,
    seed,
  };

  // Allow extraParams to override any template variable
  if (extraParams) {
    for (const key of Object.keys(template.variables)) {
      const overrideValue = extraParams[key];

      if (typeof overrideValue === "string" || typeof overrideValue === "number") {
        overrides[key] = overrideValue;
      }
    }
  }

  return resolveWorkflowTemplate(template, overrides);
}

// ---------------------------------------------------------------------------
// Priority 3: Standard workflow.api.json via workflow-prompt-builder (v0.3)
// ---------------------------------------------------------------------------

/** Cached workflow template (loaded once from docs/workflow.api.json) */
let cachedStandardWorkflow: JsonRecord | null = null;

async function loadStandardWorkflowTemplate(): Promise<JsonRecord> {
  if (cachedStandardWorkflow) {
    return cachedStandardWorkflow;
  }
  const fs = await import("fs/promises");
  const path = await import("path");
  const filePath = path.join(process.cwd(), "docs", "workflow.api.json");
  const raw = await fs.readFile(filePath, "utf-8");
  cachedStandardWorkflow = JSON.parse(raw) as JsonRecord;
  return cachedStandardWorkflow;
}

/**
 * Always use the standard workflow.api.json template as the default.
 * Previously gated on ksampler1/ksampler2 presence; now always true
 * so that all runs use the fully-mapped template with proper LoRA/KSampler support.
 * The fallback builder is kept as a last resort if the template file is missing.
 */
function shouldUseStandardWorkflow(_draft: ComfyPromptDraft): boolean {
  return true;
}

async function resolveStandardWorkflowPrompt(
  promptDraft: ComfyPromptDraft,
): Promise<JsonRecord | null> {
  if (!shouldUseStandardWorkflow(promptDraft)) {
    return null;
  }

  const template = await loadStandardWorkflowTemplate();
  // Deep-clone so each call gets a fresh copy
  const cloned = JSON.parse(JSON.stringify(template)) as JsonRecord;

  const { width, height } = resolveResolution(
    promptDraft.parameters.aspectRatio,
    promptDraft.parameters.shortSidePx,
  );
  // For the workflow template, width = short side, height = long side (portrait default)
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);

  const loraConfig = promptDraft.loraConfig
    ? parseSectionLoraConfig(promptDraft.loraConfig)
    : { lora1: [], lora2: [] };

  const ksampler1 = parseKSamplerParams(promptDraft.ksampler1, DEFAULT_KSAMPLER1);
  const ksampler2 = parseKSamplerParams(promptDraft.ksampler2, DEFAULT_KSAMPLER2);

  // Map LoraEntry[] to LoraBinding[] (strip id/source fields)
  const toBindings = (entries: Array<{ path: string; weight: number; enabled: boolean }>) =>
    entries.map((e) => ({ path: e.path, weight: e.weight, enabled: e.enabled }));

  const sectionSlug = promptDraft.metadata.sectionName?.replace(/\s+/g, "_") ?? "section";
  const sortOrder = promptDraft.metadata.sectionSortOrder ?? 0;

  const buildInput: WorkflowBuildInput = {
    workflowTemplate: cloned,
    positivePrompt: promptDraft.prompt.positive,
    negativePrompt:
      promptDraft.prompt.negative ?? "",
    shortSidePx: shortSide,
    longSidePx: longSide,
    batchSize: promptDraft.parameters.batchSize ?? 1,
    upscaleFactor: promptDraft.parameters.upscaleFactor ?? 2,
    lora1List: toBindings(loraConfig.lora1),
    lora2List: toBindings(loraConfig.lora2),
    ksampler1,
    ksampler2,
    outputPath: `${promptDraft.metadata.projectTitle}/${sortOrder}.${sectionSlug}`,
  };

  return buildWorkflowPrompt(buildInput);
}

async function validateComfyPromptDraft(
  apiUrl: string,
  promptDraft: ComfyPromptDraft,
): Promise<ValidatedComfyPromptDraft> {
  if (!promptDraft.workflowId.trim()) {
    throw new Error("Resolved workflow id is empty");
  }

  if (!promptDraft.prompt.positive.trim()) {
    throw new Error("Resolved positive prompt is empty");
  }

  const extraParams = asJsonRecord(promptDraft.extraParams);
  const customApiPrompt = extractJsonRecordByKeys(extraParams, [
    "comfyPrompt",
    "workflowApiPrompt",
    "apiPrompt",
  ]);

  // Priority: 1) explicit comfyPrompt in extraParams
  //           2) workflowTemplateId → resolve from config/workflows/
  //           3) standard workflow.api.json (v0.3, when ksampler1/2 present)
  //           4) built-in SDXL txt2img fallback
  let apiPrompt: JsonRecord;

  if (customApiPrompt && Object.keys(customApiPrompt).length > 0) {
    apiPrompt = customApiPrompt;
  } else {
    const templatePrompt = await resolveApiPromptFromWorkflowTemplate(
      extraParams,
      promptDraft,
    );
    if (templatePrompt) {
      apiPrompt = templatePrompt;
    } else {
      const standardPrompt = await resolveStandardWorkflowPrompt(promptDraft);
      apiPrompt = standardPrompt ?? buildFallbackPromptNodes(promptDraft);
    }
  }

  const extraData = {
    ...(extractJsonRecordByKeys(extraParams, ["comfyExtraData", "workflowExtraData"]) ?? {}),
    comfyuiRemote: {
      workflowId: promptDraft.workflowId,
      prompt: promptDraft.prompt,
      parameters: promptDraft.parameters,
      loraConfig: promptDraft.loraConfig,
      metadata: promptDraft.metadata,
    },
  };

  return {
    apiUrl: normalizeApiUrl(apiUrl),
    apiPrompt,
    extraData,
  };
}

async function submitComfyPrompt(
  validatedDraft: ValidatedComfyPromptDraft,
  promptDraft: ComfyPromptDraft,
) {
  const payload = await fetchJson(
    `${validatedDraft.apiUrl}/prompt`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: validatedDraft.apiPrompt,
        client_id: promptDraft.clientId,
        extra_data: validatedDraft.extraData,
      }),
    },
    "ComfyUI prompt submit",
  );
  const response = asRecord(payload);
  const promptId = typeof response?.prompt_id === "string" ? response.prompt_id : null;
  const nodeErrors = asRecord(response?.node_errors);

  if (nodeErrors && Object.keys(nodeErrors).length > 0) {
    throw new Error(
      `ComfyUI prompt submit returned node_errors: ${formatUnknownValue(nodeErrors)}`,
    );
  }

  if (!promptId) {
    throw new Error("ComfyUI prompt submit did not return prompt_id");
  }

  return promptId;
}

async function pollComfyPromptHistory(
  apiUrl: string,
  promptId: string,
): Promise<ComfyPromptHistoryEntry> {
  for (let attempt = 1; attempt <= env.comfyHistoryMaxAttempts; attempt += 1) {
    const payload = await fetchJson(
      `${apiUrl}/history/${encodeURIComponent(promptId)}`,
      {
        method: "GET",
      },
      `ComfyUI history poll for prompt ${promptId}`,
    );
    const historyEntry = extractHistoryEntry(payload, promptId);

    if (historyEntry) {
      const failureMessage = extractHistoryFailureMessage(historyEntry);

      if (failureMessage) {
        throw new Error(failureMessage);
      }

      if (isHistoryComplete(historyEntry)) {
        return historyEntry;
      }
    }

    if (attempt < env.comfyHistoryMaxAttempts) {
      await sleep(env.comfyHistoryPollIntervalMs);
    }
  }

  throw new Error(
    `Timed out waiting for ComfyUI history for prompt ${promptId} after ${env.comfyHistoryMaxAttempts} attempts`,
  );
}

export async function executeComfyPromptDraft(
  apiUrl: string,
  promptDraft: ComfyPromptDraft,
): Promise<ComfyPromptExecutionResult> {
  const timer = log.startTimer("comfy-prompt-execution", { workflowId: promptDraft.workflowId });

  const validatedDraft = await validateComfyPromptDraft(apiUrl, promptDraft);

  // Debug: write the resolved prompt to disk for inspection
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const debugPath = path.join(process.cwd(), "debug-submitted-prompt.json");
    await fs.writeFile(
      debugPath,
      JSON.stringify(validatedDraft.apiPrompt, null, 2),
      "utf-8",
    );
  } catch {
    // Best-effort — don't block execution
  }

  log.debug("Submitting prompt to ComfyUI", { apiUrl: validatedDraft.apiUrl });

  const comfyPromptId = await submitComfyPrompt(validatedDraft, promptDraft);

  log.debug("Prompt submitted, waiting for completion", { comfyPromptId });

  let historyEntry: ComfyPromptHistoryEntry;

  try {
    historyEntry = await pollComfyPromptHistory(validatedDraft.apiUrl, comfyPromptId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("ComfyUI prompt execution failed", error, { comfyPromptId });
    throw new ComfyPromptExecutionError(message, comfyPromptId);
  }

  const outputImages = extractOutputImages(historyEntry);
  const executionMeta = extractExecutionMeta(validatedDraft.apiPrompt);

  timer.done({ comfyPromptId, imageCount: outputImages.length });

  return {
    comfyPromptId,
    outputDir: extractOutputDir(outputImages),
    outputImages,
    executionMeta,
  };
}
