import { Prisma } from "@/generated/prisma";
import { env } from "@/lib/env";
import { ComfyPromptDraft } from "@/server/worker/types";

type JsonRecord = Record<string, unknown>;

type ComfyPromptHistoryEntry = {
  outputs: JsonRecord | null;
  status: JsonRecord | null;
};

export type ComfyPromptExecutionResult = {
  comfyPromptId: string;
  outputDir: string | null;
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

function extractOutputDir(entry: ComfyPromptHistoryEntry) {
  const imageBaseDir = env.imageBaseDir.trim();

  if (!imageBaseDir || !entry.outputs) {
    return null;
  }

  for (const nodeOutput of Object.values(entry.outputs)) {
    const output = asRecord(nodeOutput);
    const images = Array.isArray(output?.images) ? output.images : [];

    for (const image of images) {
      const imageRecord = asRecord(image);
      const subfolder =
        typeof imageRecord?.subfolder === "string" ? imageRecord.subfolder.trim() : "";
      const normalizedBaseDir = imageBaseDir.replace(/\\/g, "/").replace(/\/+$/, "");
      const normalizedSubfolder = subfolder.replace(/\\/g, "/").replace(/^\/+/, "");

      return normalizedSubfolder
        ? `${normalizedBaseDir}/${normalizedSubfolder}`
        : normalizedBaseDir;
    }
  }

  return null;
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

function validateComfyPromptDraft(
  apiUrl: string,
  promptDraft: ComfyPromptDraft,
): ValidatedComfyPromptDraft {
  if (!promptDraft.workflowId.trim()) {
    throw new Error("Resolved workflow id is empty");
  }

  if (!promptDraft.prompt.positive.trim()) {
    throw new Error("Resolved positive prompt is empty");
  }

  const extraParams = asJsonRecord(promptDraft.extraParams);
  const apiPrompt = extractJsonRecordByKeys(extraParams, [
    "comfyPrompt",
    "workflowApiPrompt",
    "apiPrompt",
  ]);

  if (!apiPrompt || Object.keys(apiPrompt).length === 0) {
    throw new Error(
      "Resolved draft is missing a ComfyUI prompt graph in extraParams.comfyPrompt, workflowApiPrompt, or apiPrompt",
    );
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
  const validatedDraft = validateComfyPromptDraft(apiUrl, promptDraft);
  const comfyPromptId = await submitComfyPrompt(validatedDraft, promptDraft);

  let historyEntry: ComfyPromptHistoryEntry;

  try {
    historyEntry = await pollComfyPromptHistory(validatedDraft.apiUrl, comfyPromptId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ComfyPromptExecutionError(message, comfyPromptId);
  }

  return {
    comfyPromptId,
    outputDir: extractOutputDir(historyEntry),
  };
}
