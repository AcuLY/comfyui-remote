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
  listJobs,
  updateJob,
  updateJobPosition,
  enqueueJobRuns,
  enqueueJobPositionRun,
  mapJobError,
} from "@/server/services/job-service";
import {
  keepRunImages,
  trashRunImages,
  getRunAgentContext,
} from "@/server/services/review-service";
import {
  getJobAgentContext,
} from "@/server/repositories/job-repository";
import {
  listJobRevisions,
  getJobRevision,
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
        "ComfyUI Remote MCP Server — manage AI image generation jobs.",
        "Use tools to list/update jobs, trigger runs, review images, and manage prompt blocks.",
        "Use resources to read detailed context for jobs, runs, workflows, revisions, and prompt blocks.",
        "Typical workflow: list_jobs → get job context → update params → run → poll run context → review images.",
        "Prompt blocks (v0.2): Each position's prompt is composed from ordered blocks (character/scene/style/position/custom).",
        "Use list_prompt_blocks + add/update/remove/reorder to manage blocks via MCP.",
      ].join("\n"),
    },
  );

  // -------------------------------------------------------------------------
  // Tools
  // -------------------------------------------------------------------------

  server.tool(
    "list_jobs",
    "List all jobs. Supports optional filtering by search text, status, and pending review status.",
    {
      search: z.string().optional().describe("Search by title or character name"),
      status: z.string().optional().describe("Filter by job status: draft, queued, running, partial_done, done, failed"),
      hasPending: z.string().optional().describe("Filter to jobs with pending images: 'true' or 'false'"),
    },
    async ({ search, status, hasPending }) => {
      try {
        const data = await listJobs({ search, status, hasPending });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (error) {
        const mapped = mapJobError(error);
        return { content: [{ type: "text", text: `Error: ${mapped.message}` }], isError: true };
      }
    },
  );

  server.tool(
    "update_job",
    "Update a job's parameters (character prompt, scene/style prompt, LoRA path, aspectRatio, batchSize). Creates a revision snapshot before updating.",
    {
      jobId: z.string().describe("The job ID to update"),
      characterPrompt: z.string().optional().describe("Character prompt text"),
      scenePrompt: z.string().nullable().optional().describe("Scene prompt text"),
      stylePrompt: z.string().nullable().optional().describe("Style prompt text"),
      characterLoraPath: z.string().optional().describe("LoRA file path"),
      aspectRatio: z.string().nullable().optional().describe("Aspect ratio (e.g. '3:4', '1:1')"),
      batchSize: z.number().nullable().optional().describe("Number of images per run"),
    },
    async ({ jobId, ...patch }) => {
      try {
        const result = await updateJob(jobId, patch, ActorType.agent);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const mapped = mapJobError(error);
        return { content: [{ type: "text", text: `Error: ${mapped.message}` }], isError: true };
      }
    },
  );

  server.tool(
    "update_job_position",
    "Update a specific position's parameters within a job.",
    {
      jobId: z.string().describe("The job ID"),
      jobPositionId: z.string().describe("The position ID within the job"),
      positivePrompt: z.string().nullable().optional().describe("Positive prompt override"),
      negativePrompt: z.string().nullable().optional().describe("Negative prompt override"),
      aspectRatio: z.string().nullable().optional().describe("Aspect ratio override"),
      batchSize: z.number().nullable().optional().describe("Batch size override"),
      seedPolicy: z.string().nullable().optional().describe("Seed policy: 'random' or 'fixed'"),
    },
    async ({ jobId, jobPositionId, ...patch }) => {
      try {
        const result = await updateJobPosition(jobId, jobPositionId, patch, ActorType.agent);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const mapped = mapJobError(error);
        return { content: [{ type: "text", text: `Error: ${mapped.message}` }], isError: true };
      }
    },
  );

  server.tool(
    "run_all_positions",
    "Trigger all enabled positions in a job to run. Creates queued PositionRun entries for the Worker to process.",
    {
      jobId: z.string().describe("The job ID to run all positions for"),
    },
    async ({ jobId }) => {
      try {
        const result = await enqueueJobRuns(jobId, undefined, ActorType.agent);
        const context = await getJobAgentContext(jobId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ result, context }, null, 2),
          }],
        };
      } catch (error) {
        const mapped = mapJobError(error);
        return { content: [{ type: "text", text: `Error: ${mapped.message}` }], isError: true };
      }
    },
  );

  server.tool(
    "run_position",
    "Trigger a single position to run within a job.",
    {
      jobId: z.string().describe("The job ID"),
      jobPositionId: z.string().describe("The position ID to run"),
    },
    async ({ jobId, jobPositionId }) => {
      try {
        const result = await enqueueJobPositionRun(jobId, jobPositionId, undefined, ActorType.agent);
        const context = await getJobAgentContext(jobId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ result, context }, null, 2),
          }],
        };
      } catch (error) {
        const mapped = mapJobError(error);
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
    "List all prompt blocks for a specific position within a job.",
    {
      jobPositionId: z.string().describe("The position ID to list blocks for"),
    },
    async ({ jobPositionId }) => {
      try {
        const blocks = await getPromptBlocks(jobPositionId);
        return { content: [{ type: "text", text: JSON.stringify(blocks, null, 2) }] };
      } catch (error) {
        const mapped = mapPromptBlockError(error);
        return { content: [{ type: "text", text: `Error: ${mapped.message}` }], isError: true };
      }
    },
  );

  server.tool(
    "add_prompt_block",
    "Add a new prompt block to a position. Use this to add custom prompt blocks or import from character/scene/style/position presets.",
    {
      jobPositionId: z.string().describe("The position ID to add the block to"),
      type: z.enum(["character", "scene", "style", "position", "custom"]).describe("Block type"),
      label: z.string().describe("Display label for this block"),
      positive: z.string().describe("Positive prompt text"),
      negative: z.string().nullable().optional().describe("Negative prompt text (optional)"),
      sourceId: z.string().nullable().optional().describe("Source entity ID (e.g. Character.id) if referencing a preset"),
    },
    async ({ jobPositionId, type, label, positive, negative, sourceId }) => {
      try {
        const block = await addPromptBlock(jobPositionId, { type, label, positive, negative, sourceId }, ActorType.agent);
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
    "Delete a prompt block from a position.",
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
    "Reorder prompt blocks for a position. Provide the block IDs in the desired order.",
    {
      jobPositionId: z.string().describe("The position ID"),
      blockIds: z.array(z.string()).describe("Array of block IDs in the desired order"),
    },
    async ({ jobPositionId, blockIds }) => {
      try {
        const blocks = await setPromptBlockOrder(jobPositionId, blockIds, ActorType.agent);
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

  // Dynamic resource: Job context
  server.resource(
    "job-context",
    new ResourceTemplate("comfyui://jobs/{jobId}/context", { list: undefined }),
    { description: "Full context for a specific job including positions, latest runs, and prompt overview" },
    async (uri, vars) => {
      const data = await getJobAgentContext(str(vars.jobId));
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

  // Dynamic resource: Job revisions
  server.resource(
    "job-revisions",
    new ResourceTemplate("comfyui://jobs/{jobId}/revisions", { list: undefined }),
    { description: "Revision history for a job (newest first)" },
    async (uri, vars) => {
      const data = await listJobRevisions(str(vars.jobId));
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
    "job-revision",
    new ResourceTemplate("comfyui://jobs/{jobId}/revisions/{revisionNumber}", { list: undefined }),
    { description: "Complete snapshot of a job at a specific revision number" },
    async (uri, vars) => {
      const data = await getJobRevision(str(vars.jobId), parseInt(str(vars.revisionNumber), 10));
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
    "position-blocks",
    new ResourceTemplate("comfyui://positions/{positionId}/blocks", { list: undefined }),
    { description: "All prompt blocks for a specific position, ordered by sortOrder" },
    async (uri, vars) => {
      try {
        const data = await getPromptBlocks(str(vars.positionId));
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
