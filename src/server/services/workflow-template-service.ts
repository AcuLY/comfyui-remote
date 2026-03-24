/**
 * Workflow Template Service
 *
 * Discovers, loads, and resolves workflow templates from `config/workflows/`.
 * Each template is a JSON file that contains:
 *   - Metadata (id, name, description, version)
 *   - Variable declarations with defaults and node mappings
 *   - A ComfyUI API prompt graph with `{{variable}}` placeholders
 *
 * The service resolves variables from a ComfyPromptDraft at execution time,
 * producing a concrete prompt graph ready for submission to ComfyUI.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkflowTemplateVariable = {
  type: "string" | "number";
  default: string | number;
  description: string;
  nodeId: string;
  field: string;
};

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  version: string;
  builtIn: boolean;
  variables: Record<string, WorkflowTemplateVariable>;
  prompt: Record<string, unknown>;
};

export type WorkflowTemplateSummary = {
  id: string;
  name: string;
  description: string;
  version: string;
  builtIn: boolean;
  variableCount: number;
  nodeCount: number;
};

type JsonRecord = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKFLOWS_DIR = resolve(
  process.cwd(),
  "config",
  "workflows",
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseWorkflowTemplate(raw: unknown, filePath: string): WorkflowTemplate {
  if (!isJsonRecord(raw)) {
    throw new Error(`Workflow template at ${filePath} is not a valid JSON object`);
  }

  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const description = typeof raw.description === "string" ? raw.description : "";
  const version = typeof raw.version === "string" ? raw.version : "0.0.0";
  const builtIn = raw.builtIn === true;

  if (!id) {
    throw new Error(`Workflow template at ${filePath} is missing required "id" field`);
  }

  if (!name) {
    throw new Error(`Workflow template at ${filePath} is missing required "name" field`);
  }

  const variables = isJsonRecord(raw.variables) ? raw.variables : {};
  const prompt = isJsonRecord(raw.prompt) ? raw.prompt : {};

  if (Object.keys(prompt).length === 0) {
    throw new Error(`Workflow template "${id}" at ${filePath} has an empty prompt graph`);
  }

  const parsedVariables: Record<string, WorkflowTemplateVariable> = {};

  for (const [key, value] of Object.entries(variables)) {
    if (!isJsonRecord(value)) {
      continue;
    }

    const varType =
      value.type === "number" ? "number" : "string";
    const varDefault =
      varType === "number"
        ? (typeof value.default === "number" ? value.default : 0)
        : (typeof value.default === "string" ? value.default : "");

    parsedVariables[key] = {
      type: varType,
      default: varDefault,
      description: typeof value.description === "string" ? value.description : "",
      nodeId: typeof value.nodeId === "string" ? value.nodeId : "",
      field: typeof value.field === "string" ? value.field : "",
    };
  }

  return {
    id,
    name,
    description,
    version,
    builtIn,
    variables: parsedVariables,
    prompt,
  };
}

// ---------------------------------------------------------------------------
// Template resolution: substitute {{variable}} placeholders
// ---------------------------------------------------------------------------

function resolveTemplatePlaceholders(
  prompt: Record<string, unknown>,
  variableValues: Record<string, string | number>,
): Record<string, unknown> {
  const serialized = JSON.stringify(prompt);

  // Replace {{variable}} placeholders in the serialized JSON
  const resolved = serialized.replace(
    /"\{\{(\w+)\}\}"/g,
    (_match, variableName: string) => {
      const value = variableValues[variableName];

      if (value === undefined) {
        return '""';
      }

      if (typeof value === "number") {
        return String(value);
      }

      // Escape the string value for JSON
      return JSON.stringify(value);
    },
  );

  return JSON.parse(resolved) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Discover and load all workflow templates from `config/workflows/`.
 */
export async function listWorkflowTemplates(): Promise<WorkflowTemplate[]> {
  let files: string[];

  try {
    files = await readdir(WORKFLOWS_DIR);
  } catch {
    return [];
  }

  const jsonFiles = files
    .filter((file) => file.endsWith(".json"))
    .sort();

  const templates: WorkflowTemplate[] = [];

  for (const fileName of jsonFiles) {
    const filePath = join(WORKFLOWS_DIR, fileName);

    try {
      const content = await readFile(filePath, "utf-8");
      const raw: unknown = JSON.parse(content);
      templates.push(parseWorkflowTemplate(raw, filePath));
    } catch (error) {
      console.error(
        `[workflow-template-service] Failed to load ${fileName}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return templates;
}

/**
 * Load a single workflow template by id.
 */
export async function getWorkflowTemplate(
  templateId: string,
): Promise<WorkflowTemplate | null> {
  const templates = await listWorkflowTemplates();
  return templates.find((template) => template.id === templateId) ?? null;
}

/**
 * List workflow template summaries (without the full prompt graph).
 */
export async function listWorkflowTemplateSummaries(): Promise<WorkflowTemplateSummary[]> {
  const templates = await listWorkflowTemplates();

  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    version: template.version,
    builtIn: template.builtIn,
    variableCount: Object.keys(template.variables).length,
    nodeCount: Object.keys(template.prompt).length,
  }));
}

/**
 * Resolve a workflow template with concrete variable values.
 *
 * Returns a fully-resolved ComfyUI API prompt graph ready for submission.
 * Variables not provided in `overrides` will use their declared defaults.
 */
export function resolveWorkflowTemplate(
  template: WorkflowTemplate,
  overrides: Record<string, string | number> = {},
): Record<string, unknown> {
  // Build merged variable values: defaults + overrides
  const variableValues: Record<string, string | number> = {};

  for (const [key, variable] of Object.entries(template.variables)) {
    variableValues[key] = overrides[key] ?? variable.default;
  }

  return resolveTemplatePlaceholders(template.prompt, variableValues);
}
