/**
 * Workflow Import Service
 *
 * Parses a ComfyUI API-format JSON prompt graph and converts it into
 * a workflow template compatible with `config/workflows/*.json`.
 *
 * The service uses heuristic pattern matching on well-known ComfyUI node
 * class_types to automatically identify and extract parameterizable fields
 * (prompts, dimensions, seeds, steps, cfg, etc.).
 */

import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type JsonRecord = Record<string, unknown>;

type ExtractedVariable = {
  key: string;
  type: "string" | "number";
  default: string | number;
  description: string;
  nodeId: string;
  field: string;
};

type ImportResult = {
  id: string;
  name: string;
  filePath: string;
  variableCount: number;
  nodeCount: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKFLOWS_DIR = resolve(process.cwd(), "config", "workflows");

/**
 * Well-known ComfyUI node class_types and the fields we should extract.
 *
 * Each entry maps a class_type to an array of field extraction rules.
 * The `variableKey` is a suggested variable name; duplicates are resolved
 * by appending the nodeId.
 */
const KNOWN_NODE_EXTRACTIONS: Record<
  string,
  Array<{
    field: string;
    variableKey: string;
    type: "string" | "number";
    description: string;
  }>
> = {
  // Text prompts
  CLIPTextEncode: [
    { field: "inputs.text", variableKey: "prompt", type: "string", description: "Prompt text" },
  ],

  // Latent image dimensions
  EmptyLatentImage: [
    { field: "inputs.width", variableKey: "width", type: "number", description: "Image width in pixels" },
    { field: "inputs.height", variableKey: "height", type: "number", description: "Image height in pixels" },
    { field: "inputs.batch_size", variableKey: "batchSize", type: "number", description: "Number of images to generate" },
  ],

  // Samplers
  KSampler: [
    { field: "inputs.seed", variableKey: "seed", type: "number", description: "Random seed" },
    { field: "inputs.steps", variableKey: "steps", type: "number", description: "Number of sampling steps" },
    { field: "inputs.cfg", variableKey: "cfg", type: "number", description: "CFG scale" },
    { field: "inputs.sampler_name", variableKey: "samplerName", type: "string", description: "Sampler name" },
    { field: "inputs.scheduler", variableKey: "scheduler", type: "string", description: "Scheduler" },
    { field: "inputs.denoise", variableKey: "denoise", type: "number", description: "Denoise strength" },
  ],
  KSamplerAdvanced: [
    { field: "inputs.noise_seed", variableKey: "seed", type: "number", description: "Random seed" },
    { field: "inputs.steps", variableKey: "steps", type: "number", description: "Number of sampling steps" },
    { field: "inputs.cfg", variableKey: "cfg", type: "number", description: "CFG scale" },
    { field: "inputs.sampler_name", variableKey: "samplerName", type: "string", description: "Sampler name" },
    { field: "inputs.scheduler", variableKey: "scheduler", type: "string", description: "Scheduler" },
  ],

  // Checkpoint loader
  CheckpointLoaderSimple: [
    { field: "inputs.ckpt_name", variableKey: "checkpoint", type: "string", description: "Checkpoint file name" },
  ],

  // LoRA loader
  LoraLoader: [
    { field: "inputs.lora_name", variableKey: "loraName", type: "string", description: "LoRA file name" },
    { field: "inputs.strength_model", variableKey: "loraStrengthModel", type: "number", description: "LoRA model strength" },
    { field: "inputs.strength_clip", variableKey: "loraStrengthClip", type: "number", description: "LoRA CLIP strength" },
  ],

  // VAE loader
  VAELoader: [
    { field: "inputs.vae_name", variableKey: "vaeName", type: "string", description: "VAE file name" },
  ],

  // Image scale
  LatentUpscale: [
    { field: "inputs.width", variableKey: "upscaleWidth", type: "number", description: "Upscale width" },
    { field: "inputs.height", variableKey: "upscaleHeight", type: "number", description: "Upscale height" },
  ],
  LatentUpscaleBy: [
    { field: "inputs.scale_by", variableKey: "upscaleBy", type: "number", description: "Upscale factor" },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getNestedValue(obj: JsonRecord, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (!isJsonRecord(current)) return undefined;
    current = (current as JsonRecord)[part];
  }

  return current;
}

function setNestedValue(obj: JsonRecord, path: string, value: unknown): void {
  const parts = path.split(".");
  let current: JsonRecord = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!isJsonRecord(current[part])) {
      current[part] = {};
    }
    current = current[part] as JsonRecord;
  }

  current[parts[parts.length - 1]] = value;
}

function sanitizeId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "imported-workflow";
}

// ---------------------------------------------------------------------------
// Core import logic
// ---------------------------------------------------------------------------

function extractVariables(promptGraph: JsonRecord): ExtractedVariable[] {
  const variables: ExtractedVariable[] = [];
  const usedKeys = new Set<string>();

  function uniqueKey(baseKey: string, nodeId: string): string {
    if (!usedKeys.has(baseKey)) {
      usedKeys.add(baseKey);
      return baseKey;
    }

    // Append node id for disambiguation
    const disambiguated = `${baseKey}_${nodeId}`;
    usedKeys.add(disambiguated);
    return disambiguated;
  }

  for (const [nodeId, nodeData] of Object.entries(promptGraph)) {
    if (!isJsonRecord(nodeData)) continue;

    const classType = typeof nodeData.class_type === "string" ? nodeData.class_type : null;
    if (!classType) continue;

    const rules = KNOWN_NODE_EXTRACTIONS[classType];
    if (!rules) continue;

    for (const rule of rules) {
      const currentValue = getNestedValue(nodeData as JsonRecord, rule.field);

      // Skip if the field doesn't exist or is a link (array reference to another node)
      if (currentValue === undefined || Array.isArray(currentValue)) {
        continue;
      }

      const key = uniqueKey(rule.variableKey, nodeId);
      const defaultValue =
        rule.type === "number"
          ? (typeof currentValue === "number" ? currentValue : 0)
          : (typeof currentValue === "string" ? currentValue : "");

      variables.push({
        key,
        type: rule.type,
        default: defaultValue,
        description: rule.description,
        nodeId,
        field: rule.field,
      });
    }
  }

  return variables;
}

function buildTemplatePrompt(
  promptGraph: JsonRecord,
  variables: ExtractedVariable[],
): JsonRecord {
  // Deep clone the prompt graph
  const template = JSON.parse(JSON.stringify(promptGraph)) as JsonRecord;

  // Replace extracted values with {{variable}} placeholders
  for (const variable of variables) {
    const nodeData = template[variable.nodeId];
    if (!isJsonRecord(nodeData)) continue;

    const placeholder = `{{${variable.key}}}`;
    setNestedValue(nodeData, variable.field, placeholder);
  }

  return template;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

type ImportWorkflowInput = {
  /** The raw ComfyUI API prompt JSON */
  promptJson: unknown;
  /** Human-readable name for the template */
  name: string;
  /** Optional description */
  description?: string;
  /** Optional explicit id (auto-generated from name if omitted) */
  id?: string;
};

/**
 * Parse a ComfyUI API-format prompt JSON and convert it into a workflow
 * template file saved to `config/workflows/`.
 */
export async function importWorkflow(input: ImportWorkflowInput): Promise<ImportResult> {
  if (!isJsonRecord(input.promptJson)) {
    throw new Error("IMPORT_INVALID_JSON: prompt JSON must be an object");
  }

  const promptGraph = input.promptJson;
  const nodeCount = Object.keys(promptGraph).length;

  if (nodeCount === 0) {
    throw new Error("IMPORT_EMPTY_GRAPH: prompt JSON has no nodes");
  }

  const name = (input.name ?? "").trim();
  if (!name) {
    throw new Error("IMPORT_NAME_REQUIRED: name is required");
  }

  const id = (input.id ?? "").trim() || sanitizeId(name);
  const description = (input.description ?? "").trim() || `Imported workflow: ${name}`;

  // Extract parameterizable variables
  const variables = extractVariables(promptGraph);

  // Build template prompt with {{variable}} placeholders
  const templatePrompt = buildTemplatePrompt(promptGraph, variables);

  // Build the template object
  const template = {
    id,
    name,
    description,
    version: "1.0.0",
    builtIn: false,
    variables: Object.fromEntries(
      variables.map((v) => [
        v.key,
        {
          type: v.type,
          default: v.default,
          description: v.description,
          nodeId: v.nodeId,
          field: v.field,
        },
      ]),
    ),
    prompt: templatePrompt,
  };

  // Write to file
  const fileName = `${id}.json`;
  const filePath = join(WORKFLOWS_DIR, fileName);
  await writeFile(filePath, JSON.stringify(template, null, 2) + "\n", "utf-8");

  return {
    id,
    name,
    filePath: `config/workflows/${fileName}`,
    variableCount: variables.length,
    nodeCount,
  };
}
