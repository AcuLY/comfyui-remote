import { ok } from "@/lib/api-response";

export const dynamic = "force-dynamic";

const TRAINING_API_MANIFEST = {
  module: "training",
  version: 1,
  description: "HTTP capability manifest for the LoRA training workflow.",
  entrypoints: {
    projects: "/api/training/projects",
    runs: "/api/training/runs",
    models: "/api/training/models?kind=checkpoint",
    presets: "/api/training/presets",
    templates: "/api/training/templates",
    scheduler: "/api/training/scheduler/status",
  },
  workflows: [
    {
      id: "project_setup",
      description: "Create a training project, upload reference images, and save profile data.",
      steps: [
        { method: "POST", path: "/api/training/projects" },
        { method: "POST", path: "/api/training/projects/:projectId/character-images" },
        { method: "GET", path: "/api/training/projects/:projectId/character-images" },
        { method: "GET", path: "/api/training/projects/:projectId/profile" },
        { method: "PATCH", path: "/api/training/projects/:projectId/profile" },
      ],
    },
    {
      id: "section_and_generation",
      description: "Manage sections, build generation inputs, preview, and run generation tasks.",
      steps: [
        { method: "GET", path: "/api/training/projects/:projectId/sections" },
        { method: "POST", path: "/api/training/projects/:projectId/sections" },
        { method: "PATCH", path: "/api/training/projects/:projectId/sections/:sectionId" },
        { method: "POST", path: "/api/training/sections/:sectionId/blocks" },
        { method: "PATCH", path: "/api/training/blocks/:blockId" },
        { method: "POST", path: "/api/training/projects/:projectId/generation-tasks" },
        { method: "PATCH", path: "/api/training/generation-tasks/:taskId" },
        { method: "POST", path: "/api/training/generation-tasks/:taskId/inputs" },
        { method: "POST", path: "/api/training/generation-tasks/:taskId/preview" },
        { method: "POST", path: "/api/training/generation-tasks/:taskId/run" },
      ],
    },
    {
      id: "result_review_and_dataset",
      description: "Review image results, update captions, and freeze a dataset revision.",
      steps: [
        { method: "GET", path: "/api/training/projects/:projectId/image-results" },
        { method: "POST", path: "/api/training/image-results/:imageResultId/review" },
        { method: "PATCH", path: "/api/training/image-results/:imageResultId" },
        { method: "POST", path: "/api/training/projects/:projectId/captions/generate" },
        { method: "GET", path: "/api/training/projects/:projectId/dataset-readiness" },
        { method: "POST", path: "/api/training/projects/:projectId/dataset-revisions" },
        { method: "GET", path: "/api/training/dataset-revisions/:revisionId" },
      ],
    },
    {
      id: "training_execution",
      description: "Launch training, poll status, manage cleanup, and create presets from completed runs.",
      steps: [
        { method: "POST", path: "/api/training/projects/:projectId/training-runs" },
        { method: "GET", path: "/api/training/training-runs/:trainingRunId" },
        { method: "POST", path: "/api/training/training-runs/:trainingRunId/poll" },
        { method: "POST", path: "/api/training/training-runs/:trainingRunId/cancel" },
        { method: "POST", path: "/api/training/training-runs/:trainingRunId/cleanup" },
        { method: "POST", path: "/api/training/training-runs/:trainingRunId/create-preset" },
      ],
    },
    {
      id: "worker_execution",
      description: "Advance queued generation and training work, then write worker progress or completion callbacks.",
      steps: [
        { method: "GET", path: "/api/training/scheduler/status" },
        { method: "POST", path: "/api/training/scheduler/tick" },
        { method: "POST", path: "/api/training/worker/generation-tasks/:taskId/complete" },
        { method: "POST", path: "/api/training/worker/generation-tasks/:taskId/fail" },
        { method: "POST", path: "/api/training/worker/training-runs/:trainingRunId/progress" },
        { method: "POST", path: "/api/training/worker/training-runs/:trainingRunId/complete" },
        { method: "POST", path: "/api/training/worker/training-runs/:trainingRunId/fail" },
      ],
    },
  ],
  resources: {
    projects: {
      list: { method: "GET", path: "/api/training/projects" },
      create: { method: "POST", path: "/api/training/projects" },
      detail: { method: "GET", path: "/api/training/projects/:projectId" },
      update: { method: "PATCH", path: "/api/training/projects/:projectId" },
      remove: { method: "DELETE", path: "/api/training/projects/:projectId" },
      reorder: { method: "POST", path: "/api/training/projects/reorder" },
    },
    presets: {
      list: { method: "GET", path: "/api/training/presets" },
      create: { method: "POST", path: "/api/training/presets" },
      update: { method: "PATCH", path: "/api/training/presets/:presetId" },
      remove: { method: "DELETE", path: "/api/training/presets/:presetId" },
      sortRules: { method: "POST", path: "/api/training/presets/sort-rules" },
    },
    templates: {
      list: { method: "GET", path: "/api/training/templates" },
      create: { method: "POST", path: "/api/training/templates" },
      update: { method: "PATCH", path: "/api/training/templates/:templateId" },
      remove: { method: "DELETE", path: "/api/training/templates/:templateId" },
      reorder: { method: "POST", path: "/api/training/templates/reorder" },
    },
    models: {
      checkpoints: { method: "GET", path: "/api/training/models?kind=checkpoint" },
      loras: { method: "GET", path: "/api/training/models?kind=lora" },
    },
    scheduler: {
      status: { method: "GET", path: "/api/training/scheduler/status" },
      tick: { method: "POST", path: "/api/training/scheduler/tick" },
    },
    worker: {
      generation: {
        complete: { method: "POST", path: "/api/training/worker/generation-tasks/:taskId/complete" },
        fail: { method: "POST", path: "/api/training/worker/generation-tasks/:taskId/fail" },
      },
      training: {
        progress: { method: "POST", path: "/api/training/worker/training-runs/:trainingRunId/progress" },
        complete: { method: "POST", path: "/api/training/worker/training-runs/:trainingRunId/complete" },
        fail: { method: "POST", path: "/api/training/worker/training-runs/:trainingRunId/fail" },
      },
    },
    taxonomy: {
      sceneCategories: { method: "GET", path: "/api/training/scene-description/categories" },
      sceneFolders: { method: "GET", path: "/api/training/scene-description/folders" },
      textRevisions: { method: "GET", path: "/api/training/projects/:projectId/text-revisions" },
    },
  },
} as const;

export async function GET() {
  return ok(TRAINING_API_MANIFEST);
}
