/**
 * MCP Server for ComfyUI Remote
 *
 * Exposes the Agent API as MCP Tools + Resources, enabling any MCP-compatible
 * client (Claude Desktop, Cursor, etc.) to manage ComfyUI workflows.
 *
 * Transport: Streamable HTTP (Web Standard) — served via Next.js API route.
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { ActorType } from "@/lib/db-enums";
import {
  listProjects,
  updateProject,
  updateProjectSection,
  enqueueProjectRuns,
  enqueueProjectSectionRun,
  mapProjectError,
} from "@/server/services/project-service";
import {
  keepRunImages,
  trashRunImages,
  getRunAgentContext,
} from "@/server/services/review-service";
import {
  getProjectAgentContext,
} from "@/server/repositories/project-repository";
import {
  listProjectRevisions,
  getProjectRevision,
} from "@/server/services/revision-service";
import {
  listWorkflowTemplateSummaries,
  getWorkflowTemplate,
} from "@/server/services/workflow-template-service";
import {
  addPromptBlock,
  editPromptBlock,
  removePromptBlock,
  setPromptBlockOrder,
  getPromptBlocks,
  mapPromptBlockError,
} from "@/server/services/prompt-block-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract a single string from a URI template variable (which may be string | string[]). */
function str(v: string | string[]): string {
  return Array.isArray(v) ? v[0] ?? "" : v;
}

// ---------------------------------------------------------------------------
// Server singleton
// ---------------------------------------------------------------------------

let _server: McpServer | null = null;

export function getMcpServer(): McpServer {
  if (_server) return _server;

  const server = new McpServer(
    {
      name: "comfyui-remote",
      version: "0.2.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
      instructions: [
        "ComfyUI Remote MCP Server — manage AI image generation projects.",
        "Use tools to list/update projects, trigger runs, review images, and manage prompt blocks.",
        "Use resources to read detailed context for projects, runs, workflows, revisions, and prompt blocks.",
        "Typical workflow: list_projects → get project context → update params → run → poll run context → review images.",
        "Prompt blocks: Each section's prompt is composed from ordered blocks (preset/custom).",
        "Use list_prompt_blocks + add/update/remove/reorder to manage blocks via MCP.",
      ].join("\n"),
    },
  );

  // -------------------------------------------------------------------------
  // Tools
  // -------------------------------------------------------------------------

  server.tool(
    "list_projects",
    "List all projects. Supports optional filtering by search text, status, and pending review status.",
    {
      search: z.string().optional().describe("Search by title or character name"),
      status: z.string().optional().describe("Filter by project status: draft, queued, running, partial_done, done, failed"),
      hasPending: z.string().optional().describe("Filter to projects with pending images: 'true' or 'false'"),
    },
    async ({ search, status, hasPending }) => {
      try {
        const data = await listProjects({ search, status, hasPending });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (error) {
        const mapped = mapProjectError(error);
        return { content: [{ type: "text", text: `Error: ${mapped.message}` }], isError: true };
      }
    },
  );

  server.tool(
    "update_project",
    "Update a project's parameters (aspectRatio, batchSize). Creates a revision snapshot before updating.",
    {
      projectId: z.string().describe("The project ID to update"),
      aspectRatio: z.string().nullable().optional().describe("Aspect ratio (e.g. '3:4', '1:1')"),
      batchSize: z.number().nullable().optional().describe("Number of images per run"),
    },
    async ({ projectId, ...patch }) => {
      try {
        const result = await updateProject(projectId, patch, ActorType.agent);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const mapped = mapProjectError(error);
        return { content: [{ type: "text", text: `Error: ${mapped.message}` }], isError: true };
      }
    },
  );

  server.tool(
    "update_project_section",
    "Update a specific section's parameters within a project.",
    {
      projectId: z.string().describe("The project ID"),
      sectionId: z.string().describe("The section ID within the project"),
      positivePrompt: z.string().nullable().optional().describe("Positive prompt override"),
      negativePrompt: z.string().nullable().optional().describe("Negative prompt override"),
      aspectRatio: z.string().nullable().optional().describe("Aspect ratio override"),
      batchSize: z.number().nullable().optional().describe("Batch size override"),
      seedPolicy1: z.string().nullable().optional().describe("Seed policy for KSampler1: 'random', 'fixed', or 'increment'"),
      seedPolicy2: z.string().nullable().optional().describe("Seed policy for KSampler2: 'random', 'fixed', or 'increment'"),
      ksampler1: z.record(z.string(), z.unknown()).nullable().optional().describe("KSampler1 params: { steps, cfg, sampler_name, scheduler, denoise }"),
      ksampler2: z.record(z.string(), z.unknown()).nullable().optional().describe("KSampler2 params: { steps, cfg, sampler_name, scheduler, denoise }"),
    },
    async ({ projectId, sectionId, ...patch }) => {
      try {
        const result = await updateProjectSection(projectId, sectionId, patch, ActorType.agent);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const mapped = mapProjectError(error);
        return { content: [{ type: "text", text: `Error: ${mapped.message}` }], isError: true };
      }
    },
  );

  server.tool(
    "run_all_sections",
    "Trigger all enabled sections in a project to run. Creates queued Run entries for the Worker to process.",
    {
      projectId: z.string().describe("The project ID to run all sections for"),
    },
    async ({ projectId }) => {
      try {
        const result = await enqueueProjectRuns(projectId, undefined, ActorType.agent);
        const context = await getProjectAgentContext(projectId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ result, context }, null, 2),
          }],
        };
      } catch (error) {
        const mapped = mapProjectError(error);
        return { content: [{ type: "text", text: `Error: ${mapped.message}` }], isError: true };
      }
    },
  );

  server.tool(
    "run_section",
    "Trigger a single section to run within a project.",
    {
      projectId: z.string().describe("The project ID"),
      sectionId: z.string().describe("The section ID to run"),
    },
    async ({ projectId, sectionId }) => {
      try {
        const result = await enqueueProjectSectionRun(projectId, sectionId, undefined, ActorType.agent);
        const context = await getProjectAgentContext(projectId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ result, context }, null, 2),
          }],
        };
      } catch (error) {
        const mapped = mapProjectError(error);
        return { content: [{ type: "text", text: `Error: ${mapped.message}` }], isError: true };
      }
    },
  );

  server.tool(
    "review_images",
    "Review images from a run — keep or trash them. Use with run context to decide which images to keep.",
    {
      runId: z.string().describe("The run ID whose images to review"),
      action: z.enum(["keep", "trash"]).describe("Review action: 'keep' or 'trash'"),
      imageIds: z.array(z.string()).describe("Array of image IDs to review"),
      reason: z.string().optional().describe("Optional reason (for trash only)"),
    },
    async ({ runId, action, imageIds, reason }) => {
      try {
        const result =
          action === "keep"
            ? await keepRunImages(runId, { imageIds }, ActorType.agent)
            : await trashRunImages(runId, { imageIds, reason }, ActorType.agent);
        const context = await getRunAgentContext(runId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ action, result, context }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // PromptBlock Tools (v0.2)
  // -------------------------------------------------------------------------

  server.tool(
    "list_prompt_blocks",
    "List all prompt blocks for a specific section within a project.",
    {
      sectionId: z.string().describe("The section ID to list blocks for"),
    },
    async ({ sectionId }) => {
      try {
        const blocks = await getPromptBlocks(sectionId);
        return { content: [{ type: "text", text: JSON.stringify(blocks, null, 2) }] };
      } catch (error) {
        const mapped = mapPromptBlockError(error);
        return { content: [{ type: "text", text: `Error: ${mapped.message}` }], isError: true };
      }
    },
  );

  server.tool(
    "add_prompt_block",
    "Add a new prompt block to a section. Use this to add custom prompt blocks or import from presets.",
    {
      sectionId: z.string().describe("The section ID to add the block to"),
      type: z.enum(["preset", "custom"]).describe("Block type"),
      label: z.string().describe("Display label for this block"),
      positive: z.string().describe("Positive prompt text"),
      negative: z.string().nullable().optional().describe("Negative prompt text (optional)"),
      sourceId: z.string().nullable().optional().describe("Source entity ID (e.g. Preset.id) if referencing a preset"),
    },
    async ({ sectionId, type, label, positive, negative, sourceId }) => {
      try {
        const block = await addPromptBlock(sectionId, { type, label, positive, negative, sourceId }, ActorType.agent);
        return { content: [{ type: "text", text: JSON.stringify(block, null, 2) }] };
      } catch (error) {
        const mapped = mapPromptBlockError(error);
        return { content: [{ type: "text", text: `Error: ${mapped.message}` }], isError: true };
      }
    },
  );

  server.tool(
    "update_prompt_block",
    "Update an existing prompt block's label, positive, or negative prompt content.",
    {
      blockId: z.string().describe("The block ID to update"),
      label: z.string().optional().describe("New display label"),
      positive: z.string().optional().describe("New positive prompt text"),
      negative: z.string().nullable().optional().describe("New negative prompt text (null to clear)"),
    },
    async ({ blockId, label, positive, negative }) => {
      try {
        const block = await editPromptBlock(blockId, { label, positive, negative }, ActorType.agent);
        return { content: [{ type: "text", text: JSON.stringify(block, null, 2) }] };
      } catch (error) {
        const mapped = mapPromptBlockError(error);
        return { content: [{ type: "text", text: `Error: ${mapped.message}` }], isError: true };
      }
    },
  );

  server.tool(
    "remove_prompt_block",
    "Delete a prompt block from a section.",
    {
      blockId: z.string().describe("The block ID to remove"),
    },
    async ({ blockId }) => {
      try {
        await removePromptBlock(blockId, ActorType.agent);
        return { content: [{ type: "text", text: JSON.stringify({ deleted: true, blockId }) }] };
      } catch (error) {
        const mapped = mapPromptBlockError(error);
        return { content: [{ type: "text", text: `Error: ${mapped.message}` }], isError: true };
      }
    },
  );

  server.tool(
    "reorder_prompt_blocks",
    "Reorder prompt blocks for a section. Provide the block IDs in the desired order.",
    {
      sectionId: z.string().describe("The section ID"),
      blockIds: z.array(z.string()).describe("Array of block IDs in the desired order"),
    },
    async ({ sectionId, blockIds }) => {
      try {
        const blocks = await setPromptBlockOrder(sectionId, blockIds, ActorType.agent);
        return { content: [{ type: "text", text: JSON.stringify(blocks, null, 2) }] };
      } catch (error) {
        const mapped = mapPromptBlockError(error);
        return { content: [{ type: "text", text: `Error: ${mapped.message}` }], isError: true };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Resources
  // -------------------------------------------------------------------------

  // Dynamic resource: Project context
  server.resource(
    "project-context",
    new ResourceTemplate("comfyui://projects/{projectId}/context", { list: undefined }),
    { description: "Full context for a specific project including sections, latest runs, and prompt overview" },
    async (uri, vars) => {
      const data = await getProjectAgentContext(str(vars.projectId));
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2),
        }],
      };
    },
  );

  // Dynamic resource: Run context
  server.resource(
    "run-context",
    new ResourceTemplate("comfyui://runs/{runId}/context", { list: undefined }),
    { description: "Full context for a run including all images and review status" },
    async (uri, vars) => {
      const data = await getRunAgentContext(str(vars.runId));
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2),
        }],
      };
    },
  );

  // Static resource: Workflow templates list
  server.resource(
    "workflow-templates",
    "comfyui://workflows",
    { description: "List of all available workflow templates" },
    async (uri) => {
      const data = await listWorkflowTemplateSummaries();
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2),
        }],
      };
    },
  );

  // Dynamic resource: Workflow template detail
  server.resource(
    "workflow-template",
    new ResourceTemplate("comfyui://workflows/{templateId}", { list: undefined }),
    { description: "Complete workflow template with variable definitions and node graph" },
    async (uri, vars) => {
      const data = await getWorkflowTemplate(str(vars.templateId));
      if (!data) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ error: "Workflow template not found" }),
          }],
        };
      }
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2),
        }],
      };
    },
  );

  // Dynamic resource: Project revisions
  server.resource(
    "project-revisions",
    new ResourceTemplate("comfyui://projects/{projectId}/revisions", { list: undefined }),
    { description: "Revision history for a project (newest first)" },
    async (uri, vars) => {
      const data = await listProjectRevisions(str(vars.projectId));
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2),
        }],
      };
    },
  );

  // Dynamic resource: Single revision snapshot
  server.resource(
    "project-revision",
    new ResourceTemplate("comfyui://projects/{projectId}/revisions/{revisionNumber}", { list: undefined }),
    { description: "Complete snapshot of a project at a specific revision number" },
    async (uri, vars) => {
      const data = await getProjectRevision(str(vars.projectId), parseInt(str(vars.revisionNumber), 10));
      if (!data) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ error: "Revision not found" }),
          }],
        };
      }
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2),
        }],
      };
    },
  );

  // Dynamic resource: Position prompt blocks
  server.resource(
    "section-blocks",
    new ResourceTemplate("comfyui://sections/{sectionId}/blocks", { list: undefined }),
    { description: "All prompt blocks for a specific section, ordered by sortOrder" },
    async (uri, vars) => {
      try {
        const data = await getPromptBlocks(str(vars.sectionId));
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(data, null, 2),
          }],
        };
      } catch (error) {
        const mapped = mapPromptBlockError(error);
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ error: mapped.message }),
          }],
        };
      }
    },
  );

  _server = server;
  return server;
}
