import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  artifactToDataUrl,
  createManagerClient,
  envValue,
  getJobArtifactRoot,
  parseWorkerCli,
  readArtifactBuffer,
  readStringOption,
  sleep,
  summarizeUnknown,
  toErrorMessage,
  writeBufferArtifact,
  writeJsonArtifact,
} from "./worker-common";

import type {
  CharacterLoraImageGenerationOutput,
  CharacterLoraImageGenerationRequest,
  CharacterLoraImageGenerationTaskPayload,
} from "../../src/server/character-lora-training/contracts";

type ImageProvider = "mock-local" | "openai-codex";

type CodexAuthSourceShape = {
  source:
    | "env:CHARACTER_LORA_CODEX_BEARER_TOKEN"
    | "env:CODEX_OAUTH_TOKEN"
    | "file:CHARACTER_LORA_CODEX_AUTH_FILE"
    | "none";
  hasBearerToken: boolean;
  hasRefreshToken: boolean;
};

type ProviderResult = {
  output: CharacterLoraImageGenerationOutput;
};

const HELP = `
Character LoRA image provider worker

Usage:
  cmd /c npx tsx scripts/character-lora-training/image-worker.ts --help
  cmd /c npx tsx scripts/character-lora-training/image-worker.ts --once
  cmd /c npx tsx scripts/character-lora-training/image-worker.ts --poll --provider openai-codex --worker-owner image-worker-01

Options:
  --once                 Lease at most one image_generation task and exit.
  --poll                 Keep polling. This is the default when --once is absent.
  --interval-ms <ms>     Poll interval. Default: 5000.
  --lease-seconds <sec>  Lease/heartbeat extension. Default: 300.
  --worker-owner <name>  Lease owner. Default: character-lora-image-worker.
  --provider <name>      Override task provider with mock-local or openai-codex.
                         Default: task request provider; Manager default is openai-codex.
  --self-test            Run local parser checks without leasing tasks.

Manager auth:
  CHARACTER_LORA_MANAGER_URL defaults to http://127.0.0.1:3000.
  x-api-token is read from AUTH_TOKEN, CHARACTER_LORA_MANAGER_TOKEN, or .env.

openai-codex auth:
  Bearer token is read from CHARACTER_LORA_CODEX_BEARER_TOKEN, CODEX_OAUTH_TOKEN,
  or CHARACTER_LORA_CODEX_AUTH_FILE. Tokens are never printed or written.
`.trim();

const PLACEHOLDER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "base64",
);

main().catch((error) => {
  console.error("[character-lora image-worker] failed");
  console.error(summarizeUnknown(error));
  process.exitCode = 1;
});

async function main() {
  const cli = parseWorkerCli(process.argv.slice(2), {
    workerOwner: "character-lora-image-worker",
  });
  const providerOverride = parseProviderOverride(readStringOption(cli.values, "--provider"));

  if (cli.help) {
    console.log(HELP);
    return;
  }
  if (cli.values.has("--self-test")) {
    runParserSelfTest();
    console.log("[character-lora image-worker] self-test passed");
    return;
  }
  const client = await createManagerClient();
  console.log("[character-lora image-worker] starting", {
    managerUrl: client.baseUrl,
    managerAuth: client.authSource,
    provider: providerOverride ?? "task-request",
    workerOwner: cli.workerOwner,
    mode: cli.once ? "once" : "poll",
  });

  do {
    const task = await client.leaseTask({
      workerType: "image_generation",
      leaseOwner: cli.workerOwner,
      leaseDurationSeconds: cli.leaseDurationSeconds,
    });

    if (!task) {
      if (cli.once) {
        console.log("[character-lora image-worker] no task available");
        return;
      }
      await sleep(cli.pollIntervalMs);
      continue;
    }

    if (task.payload.taskType !== "image_generation") {
      await client.failTask(task.id, {
        leaseOwner: cli.workerOwner,
        errorSummary: `Unsupported payload taskType: ${task.payload.taskType}`,
      });
      continue;
    }

    const provider = resolveTaskProvider(task.payload.request.provider, providerOverride);
    await client.heartbeatTask(task.id, {
      leaseOwner: cli.workerOwner,
      leaseDurationSeconds: cli.leaseDurationSeconds,
      progressJson: {
        status: "leased",
        provider,
        requestProvider: task.payload.request.provider,
        providerOverride: providerOverride ?? null,
      },
    });

    await runTask({
      client,
      taskId: task.id,
      leaseOwner: cli.workerOwner,
      providerOverride,
      payload: task.payload,
    });
  } while (cli.poll);
}

async function runTask(input: {
  client: Awaited<ReturnType<typeof createManagerClient>>;
  taskId: string;
  leaseOwner: string;
  providerOverride: ImageProvider | null;
  payload: CharacterLoraImageGenerationTaskPayload;
}) {
  const startedAt = Date.now();
  const request = input.payload.request;
  const provider = resolveTaskProvider(request.provider, input.providerOverride);

  try {
    const jobRoot = await getJobArtifactRoot(input.client, input.payload.jobId);
    const result =
      provider === "mock-local"
        ? await runMockLocalProvider(jobRoot, request, startedAt, input.client.authSource)
        : await runOpenAiCodexProvider(jobRoot, request, startedAt, input.client.authSource);

    await input.client.completeTask(input.taskId, {
      leaseOwner: input.leaseOwner,
      output: result.output,
    });
    console.log("[character-lora image-worker] completed task", {
      taskId: input.taskId,
      jobId: input.payload.jobId,
      generationRunId: input.payload.generationRunId,
      provider,
      imageCount: result.output.images.length,
    });
  } catch (error) {
    const providerError = toProviderError(error);
    await input.client.failTask(input.taskId, {
      leaseOwner: input.leaseOwner,
      errorSummary: providerError.backendError,
      providerError,
    });
    console.error("[character-lora image-worker] failed task", {
      taskId: input.taskId,
      jobId: input.payload.jobId,
      error: providerError,
    });
  }
}

function parseProviderOverride(value: string | undefined): ImageProvider | null {
  if (value === undefined) return null;
  if (value === "mock-local" || value === "openai-codex") return value;
  throw new Error(`Unsupported provider: ${value}`);
}

function resolveTaskProvider(
  requestProvider: CharacterLoraImageGenerationRequest["provider"],
  providerOverride: ImageProvider | null,
): ImageProvider {
  return providerOverride ?? requestProvider;
}

async function runMockLocalProvider(
  jobRoot: string,
  request: CharacterLoraImageGenerationRequest,
  startedAt: number,
  managerAuth: { source: string; hasToken: boolean },
): Promise<ProviderResult> {
  const imagePath = `${request.outputDir}/candidate-001.png`;
  const metadataPath = `${request.outputDir}/candidate-001.metadata.json`;
  const requestRedactedPath = `${request.outputDir}/provider-request.redacted.json`;
  const responseSummaryPath = `${request.outputDir}/response-summary.json`;

  const image = await writeBufferArtifact(jobRoot, imagePath, PLACEHOLDER_PNG);
  await writeJsonArtifact(jobRoot, metadataPath, {
    provider: "mock-local",
    generatedAt: new Date().toISOString(),
    request: {
      jobId: request.jobId,
      generationRunId: request.generationRunId,
      outputDir: request.outputDir,
    },
  });
  await writeJsonArtifact(jobRoot, requestRedactedPath, {
    provider: "mock-local",
    hostModel: request.hostModel,
    imageModel: request.imageModel,
    hostInstruction: request.hostInstruction,
    visualPrompt: request.visualPrompt,
    renderedPrompt: request.renderedPrompt ?? null,
    negativePrompt: request.negativePrompt ?? null,
    toolParams: request.toolParams,
    inputImages: request.inputImages,
    auth: {
      manager: managerAuth,
      provider: { source: "none", hasBearerToken: false, hasRefreshToken: false },
    },
  });
  await writeJsonArtifact(jobRoot, responseSummaryPath, {
    provider: "mock-local",
    completedAt: new Date().toISOString(),
    output: {
      images: [{ relativePath: image.relativePath, sha256: image.sha256 }],
    },
  });

  return {
    output: {
      images: [
        {
          relativePath: image.relativePath,
          sha256: image.sha256,
          width: 1,
          height: 1,
          metadataPath,
        },
      ],
      requestRedactedPath,
      responseSummaryPath,
      elapsedMs: Date.now() - startedAt,
    },
  };
}

async function runOpenAiCodexProvider(
  jobRoot: string,
  request: CharacterLoraImageGenerationRequest,
  startedAt: number,
  managerAuth: { source: string; hasToken: boolean },
): Promise<ProviderResult> {
  const codexAuth = await resolveCodexAuth();
  if (!codexAuth.token) {
    throw new ProviderHttpError("Missing Codex bearer token", undefined, false);
  }

  const requestRedactedPath = `${request.outputDir}/provider-request.redacted.json`;
  const responseSummaryPath = `${request.outputDir}/response-summary.json`;
  const responseBody = await buildCodexResponsesBody(jobRoot, request);
  const redactedBody = redactCodexBody(responseBody);
  await writeJsonArtifact(jobRoot, requestRedactedPath, {
    provider: "openai-codex",
    endpoint: getCodexBaseUrl(),
    request: redactedBody,
    auth: {
      manager: managerAuth,
      provider: codexAuth.shape,
    },
    createdAt: new Date().toISOString(),
  });

  const headers: Record<string, string> = {
    authorization: `Bearer ${codexAuth.token}`,
    "content-type": "application/json",
    accept: "text/event-stream",
    "user-agent": "comfyui-manager-character-lora-worker",
    originator: "comfyui-manager-character-lora-worker",
  };
  const accountId = envValue("CHARACTER_LORA_CODEX_ACCOUNT_ID");
  if (accountId) {
    headers["ChatGPT-Account-ID"] = accountId;
  }

  const response = await fetch(getCodexBaseUrl(), {
    method: "POST",
    headers,
    body: JSON.stringify(responseBody),
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new ProviderHttpError(extractBackendError(responseText), response.status, isRetryableStatus(response.status));
  }

  const extracted = extractImageResult(responseText);
  if (!extracted.base64Png) {
    throw new ProviderHttpError("Codex response did not include image_generation result", response.status, false);
  }

  const imagePath = `${request.outputDir}/candidate-001.png`;
  const metadataPath = `${request.outputDir}/candidate-001.metadata.json`;
  const imageBytes = Buffer.from(extracted.base64Png, "base64");
  const image = await writeBufferArtifact(jobRoot, imagePath, imageBytes);
  await writeJsonArtifact(jobRoot, metadataPath, {
    provider: "openai-codex",
    hostModel: request.hostModel,
    imageModel: request.imageModel,
    generatedAt: new Date().toISOString(),
  });
  await writeJsonArtifact(jobRoot, responseSummaryPath, {
    provider: "openai-codex",
    httpStatus: response.status,
    contentType: response.headers.get("content-type"),
    imageResultFound: true,
    eventCount: extracted.eventCount,
    output: {
      relativePath: image.relativePath,
      sha256: image.sha256,
      byteSize: image.byteSize,
    },
  });

  return {
    output: {
      images: [
        {
          relativePath: image.relativePath,
          sha256: image.sha256,
          metadataPath,
        },
      ],
      requestRedactedPath,
      responseSummaryPath,
      elapsedMs: Date.now() - startedAt,
    },
  };
}

async function buildCodexResponsesBody(jobRoot: string, request: CharacterLoraImageGenerationRequest) {
  const inputImages = await Promise.all(
    request.inputImages.map(async (inputImage) => ({
      type: "input_image",
      image_url: artifactToDataUrl(inputImage.relativePath, await readArtifactBuffer(jobRoot, inputImage.relativePath)),
    })),
  );
  const text = request.renderedPrompt ?? request.visualPrompt;

  return {
    model: envValue("CHARACTER_LORA_CODEX_HOST_MODEL") ?? request.hostModel,
    store: false,
    instructions: request.hostInstruction,
    input: [
      {
        type: "message",
        role: "user",
        content: [
          ...inputImages,
          {
            type: "input_text",
            text,
          },
        ],
      },
    ],
    tools: [
      {
        type: "image_generation",
        model: "gpt-image-2",
        size: request.toolParams.size,
        quality: request.toolParams.quality,
        output_format: request.toolParams.outputFormat,
        background: request.toolParams.background,
        ...(request.toolParams.partialImages ? { partial_images: request.toolParams.partialImages } : {}),
      },
    ],
    tool_choice: {
      type: "allowed_tools",
      mode: "required",
      tools: [{ type: "image_generation" }],
    },
    stream: true,
  };
}

async function resolveCodexAuth(): Promise<{
  token: string | null;
  shape: CodexAuthSourceShape;
}> {
  const envBearer = envValue("CHARACTER_LORA_CODEX_BEARER_TOKEN");
  if (envBearer) {
    return {
      token: envBearer,
      shape: {
        source: "env:CHARACTER_LORA_CODEX_BEARER_TOKEN",
        hasBearerToken: true,
        hasRefreshToken: false,
      },
    };
  }

  const oauthToken = envValue("CODEX_OAUTH_TOKEN");
  if (oauthToken) {
    return {
      token: oauthToken,
      shape: {
        source: "env:CODEX_OAUTH_TOKEN",
        hasBearerToken: true,
        hasRefreshToken: false,
      },
    };
  }

  const authFile = envValue("CHARACTER_LORA_CODEX_AUTH_FILE");
  if (authFile) {
    const fileText = await readFile(path.resolve(authFile), "utf8");
    const fileJson = JSON.parse(fileText) as Record<string, unknown>;
    const token = readTokenFromAuthJson(fileJson);
    return {
      token,
      shape: {
        source: "file:CHARACTER_LORA_CODEX_AUTH_FILE",
        hasBearerToken: Boolean(token),
        hasRefreshToken: typeof fileJson.refresh_token === "string" || typeof fileJson.refreshToken === "string",
      },
    };
  }

  return {
    token: null,
    shape: {
      source: "none",
      hasBearerToken: false,
      hasRefreshToken: false,
    },
  };
}

function readTokenFromAuthJson(fileJson: Record<string, unknown>) {
  const token =
    fileJson.access_token ??
    fileJson.accessToken ??
    fileJson.bearer_token ??
    fileJson.bearerToken ??
    fileJson.token;
  return typeof token === "string" && token.trim() ? token.trim() : null;
}

function getCodexBaseUrl() {
  return envValue("CHARACTER_LORA_CODEX_BASE_URL") ?? "https://chatgpt.com/backend-api/codex/responses";
}

function redactCodexBody(body: Awaited<ReturnType<typeof buildCodexResponsesBody>>) {
  return {
    ...body,
    input: body.input.map((item) => ({
      ...item,
      content: item.content.map((contentItem) =>
        contentItem.type === "input_image"
          ? { ...contentItem, image_url: "data:image/png;base64,[redacted]" }
          : contentItem,
      ),
    })),
  };
}

function extractImageResult(text: string) {
  const events = parseSseEvents(text);
  const jsonPayloads = events.length > 0 ? events : parseJsonPayloads(text);
  const finalPayloads = jsonPayloads.filter((payload) => !isPartialImagePayload(payload));
  const base64Png =
    finalPayloads.map(findImageBase64).find((value): value is string => Boolean(value)) ??
    jsonPayloads.map(findImageBase64).find((value): value is string => Boolean(value));
  return {
    base64Png,
    eventCount: jsonPayloads.length,
  };
}

function parseSseEvents(text: string) {
  if (!/^\s*(event:|data:)/m.test(text)) return [];
  const events: unknown[] = [];

  for (const block of text.split(/\r?\n\r?\n/)) {
    const dataLines = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .filter((line) => line && line !== "[DONE]");
    if (dataLines.length === 0) continue;

    const joined = dataLines.join("\n");
    try {
      events.push(JSON.parse(joined));
    } catch {
      // Some partial SSE records are not JSON. Ignore them and keep scanning.
    }
  }

  return events;
}

function parseJsonPayloads(text: string) {
  try {
    return [JSON.parse(text)];
  } catch {
    return [];
  }
}

function findImageBase64(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImageBase64(item);
      if (found) return found;
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const key of ["result", "b64_json", "image_base64", "base64_png"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && looksLikeBase64Png(candidate)) {
      return stripDataUrlPrefix(candidate);
    }
  }
  for (const nested of Object.values(record)) {
    const found = findImageBase64(nested);
    if (found) return found;
  }
  return null;
}

function isPartialImagePayload(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;

  if (Array.isArray(value)) {
    return value.some(isPartialImagePayload);
  }

  const record = value as Record<string, unknown>;
  if (typeof record.type === "string" && record.type.includes("partial_image")) return true;
  if (typeof record.partial_image_b64 === "string" || typeof record.partialImageB64 === "string") return true;

  return false;
}

function looksLikeBase64Png(value: string) {
  const stripped = stripDataUrlPrefix(value).replace(/\s/g, "");
  return stripped.startsWith("iVBOR") && /^[a-z0-9+/=]+$/i.test(stripped);
}

function stripDataUrlPrefix(value: string) {
  return value.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "").replace(/\s/g, "");
}

function extractBackendError(responseText: string) {
  try {
    const parsed = JSON.parse(responseText) as Record<string, unknown>;
    const error = parsed.error;
    if (typeof error === "string") return error;
    if (error && typeof error === "object" && "message" in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
    if (typeof parsed.message === "string") return parsed.message;
  } catch {
    // Fall through to preview.
  }
  return responseText.slice(0, 500) || "Codex provider request failed";
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function runParserSelfTest() {
  if (parseProviderOverride(undefined) !== null) {
    throw new Error("Provider override should be optional");
  }
  if (parseProviderOverride("mock-local") !== "mock-local") {
    throw new Error("Provider override should accept mock-local");
  }
  if (resolveTaskProvider("openai-codex", null) !== "openai-codex") {
    throw new Error("Worker should use request provider when no CLI override is set");
  }
  if (resolveTaskProvider("openai-codex", "mock-local") !== "mock-local") {
    throw new Error("Worker should honor explicit CLI provider override");
  }

  const partialBase64 = "iVBORpartial";
  const finalBase64 = "iVBORfinal";
  const sse = [
    "event: response.image_generation_call.partial_image",
    `data: ${JSON.stringify({ type: "response.image_generation_call.partial_image", partial_image_b64: partialBase64 })}`,
    "",
    "event: response.output_item.done",
    `data: ${JSON.stringify({ type: "response.output_item.done", item: { type: "image_generation_call", result: finalBase64 } })}`,
    "",
  ].join("\n");
  const sseResult = extractImageResult(sse);
  if (sseResult.base64Png !== finalBase64 || sseResult.eventCount !== 2) {
    throw new Error("SSE parser should prefer final image_generation result over partial images");
  }

  const jsonResult = extractImageResult(JSON.stringify({ result: finalBase64 }));
  if (jsonResult.base64Png !== finalBase64 || jsonResult.eventCount !== 1) {
    throw new Error("JSON parser should extract image_generation result");
  }
}

class ProviderHttpError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number | undefined,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderHttpError";
  }
}

function toProviderError(error: unknown) {
  if (error instanceof ProviderHttpError) {
    return {
      httpStatus: error.httpStatus,
      backendError: error.message,
      retryable: error.retryable,
    };
  }

  return {
    backendError: toErrorMessage(error),
    retryable: false,
  };
}
