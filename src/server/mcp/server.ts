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

import { ActorType } from "@/generated/prisma";
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
      version: "0.1.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
      instructions: [
        "ComfyUI Remote MCP Server — manage AI image generation jobs.",
        "Use tools to list/update jobs, trigger runs, and review generated images.",
        "Use resources to read detailed context for jobs, runs, workflows, and revisions.",
        "Typical workflow: list_jobs → get job context → update params → run → poll run context → review images.",
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
        const result = await enqueueJobRuns(jobId, ActorType.agent);
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
        const result = await enqueueJobPositionRun(jobId, jobPositionId, ActorType.agent);
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

  _server = server;
  return server;
}
