import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { ProjectDeletionDb } from "../src/server/services/project-deletion-service";

process.env.DB_PROVIDER ??= "sqlite";
process.env.DATABASE_URL ??= "file:./data/test-project-deletion-cleanup.db";

test("complete project deletion cancels queued, running, and paused tasks before deleting project data", async () => {
  const { deleteProjectCompletelyWithDependencies } = await import(
    "../src/server/services/project-deletion-service"
  );

  const events: string[] = [];
  let runStatusFilter: string[] | undefined;
  let censoringStatusFilter: string[] | undefined;

  type StatusFilterArgs = { where: { status: { in: string[] } } };
  const getStatusFilter = (args: unknown) => (args as StatusFilterArgs).where.status.in;

  const db: ProjectDeletionDb = {
    project: {
      findFirst: async () => {
        events.push("project.findFirst");
        return {
          id: "project-1",
          slug: "safe-project",
          title: "Exported Project",
          sections: [
            {
              id: "section-1",
              runs: [{ comfyOutputSubfolder: "safe-project/run-1" }],
            },
          ],
        };
      },
      delete: async () => {
        events.push("project.delete");
        return { id: "project-1" };
      },
    },
    run: {
      findMany: async (args) => {
        events.push("run.findMany");
        runStatusFilter = getStatusFilter(args);
        return [
          { id: "run-queued", status: "queued", comfyPromptId: "prompt-pending" },
          { id: "run-running", status: "running", comfyPromptId: "prompt-running" },
          { id: "run-paused", status: "paused", comfyPromptId: "prompt-paused" },
        ];
      },
      updateMany: async (args) => {
        events.push("run.updateMany");
        runStatusFilter = getStatusFilter(args);
        return { count: 3 };
      },
    },
    censoringTask: {
      findMany: async (args) => {
        events.push("censoringTask.findMany");
        censoringStatusFilter = getStatusFilter(args);
        return [
          { id: "censor-queued", status: "queued", errorMessage: "promptId:censor-pending" },
          { id: "censor-running", status: "running", errorMessage: "promptId:censor-running" },
          { id: "censor-paused", status: "paused", errorMessage: "promptId:censor-paused" },
        ];
      },
      updateMany: async (args) => {
        events.push("censoringTask.updateMany");
        censoringStatusFilter = getStatusFilter(args);
        return { count: 3 };
      },
    },
    imageResult: {
      findMany: async () => {
        events.push("imageResult.findMany");
        return [];
      },
    },
    trashRecord: {
      deleteMany: async () => {
        events.push("trashRecord.deleteMany");
        return { count: 0 };
      },
    },
  };

  const queuePositions = new Map([
    ["prompt-pending", "pending"],
    ["prompt-running", "running"],
    ["prompt-paused", "pending"],
    ["censor-pending", "pending"],
    ["censor-running", "running"],
    ["censor-paused", "pending"],
  ]);

  const result = await deleteProjectCompletelyWithDependencies("project-1", {
    db,
    now: () => new Date("2026-06-01T00:00:00.000Z"),
    cleanupProjectSectionFiles: async () => {
      events.push("cleanup.sections");
      return { deletedManagedDir: true, deletedComfyDirs: 1 };
    },
    cleanupProjectExportDirectory: async () => {
      events.push("cleanup.export");
      return { deletedExportDir: true };
    },
    removeTrashFile: async () => {
      events.push("trash.remove");
    },
    comfy: {
      apiUrl: "http://comfy.local",
      clearQueueSnapshotCache: () => events.push("comfy.clear"),
      getQueuePosition: async (_apiUrl: string, promptId: string) => {
        events.push(`comfy.position:${promptId}`);
        return (queuePositions.get(promptId) ?? "not_found") as "running" | "pending" | "not_found";
      },
      deleteQueueItems: async (_apiUrl: string, promptIds: string[]) => {
        events.push(`comfy.delete:${promptIds.join(",")}`);
      },
      interruptPrompt: async () => {
        events.push("comfy.interrupt");
      },
    },
    logWarning: () => {},
  });

  assert.equal(result.deletedProject, true);
  assert.equal(result.cancelledRuns, 3);
  assert.equal(result.cancelledCensoringTasks, 3);
  assert.deepEqual(runStatusFilter, ["queued", "running", "paused"]);
  assert.deepEqual(censoringStatusFilter, ["queued", "running", "paused"]);
  assert.ok(events.indexOf("run.updateMany") < events.indexOf("cleanup.sections"));
  assert.ok(events.indexOf("censoringTask.updateMany") < events.indexOf("cleanup.sections"));
  assert.ok(events.indexOf("cleanup.export") < events.indexOf("project.delete"));
  assert.ok(events.includes("comfy.delete:prompt-pending,prompt-paused"));
  assert.ok(events.includes("comfy.delete:censor-pending,censor-paused"));
  assert.ok(events.includes("comfy.interrupt"));
});

test("complete project deletion resolves projects through the generation resource boundary", async () => {
  const { deleteProjectCompletelyWithDependencies } = await import(
    "../src/server/services/project-deletion-service"
  );

  const events: string[] = [];
  let projectLookupArgs: unknown;

  const db = {
    project: {
      findFirst: async (args: unknown) => {
        projectLookupArgs = args;
        events.push("project.findFirst");
        return null;
      },
      delete: async () => {
        events.push("project.delete");
        return { id: "training-benchmark-project" };
      },
    },
    run: {
      findMany: async () => [],
      updateMany: async () => ({ count: 0 }),
    },
    censoringTask: {
      findMany: async () => [],
      updateMany: async () => ({ count: 0 }),
    },
    imageResult: {
      findMany: async () => [],
    },
    trashRecord: {
      deleteMany: async () => ({ count: 0 }),
    },
  };

  const result = await deleteProjectCompletelyWithDependencies("training-benchmark-project", {
    db: db as unknown as ProjectDeletionDb,
    now: () => new Date("2026-06-01T00:00:00.000Z"),
    cleanupProjectSectionFiles: async () => {
      events.push("cleanup.sections");
      return { deletedManagedDir: false, deletedComfyDirs: 0 };
    },
    cleanupProjectExportDirectory: async () => {
      events.push("cleanup.export");
      return { deletedExportDir: false };
    },
    removeTrashFile: async () => {},
    comfy: {
      apiUrl: "http://comfy.local",
      clearQueueSnapshotCache: () => {},
      getQueuePosition: async () => "not_found",
      deleteQueueItems: async () => {},
      interruptPrompt: async () => {},
    },
    logWarning: () => {},
  });

  assert.equal(result.deletedProject, false);
  assert.deepEqual(events, ["project.findFirst"]);
  assert.match(
    JSON.stringify(projectLookupArgs),
    /training_benchmark/,
    "project deletion should reuse the generation project boundary instead of a raw id lookup",
  );
});

test("project deletion task and trash cleanup queries stay inside generation-owned projects", async () => {
  const { cancelProjectTasksForCleanupWithDependencies, deleteProjectCompletelyWithDependencies } = await import(
    "../src/server/services/project-deletion-service"
  );

  const runQueries: unknown[] = [];
  const censoringQueries: unknown[] = [];
  const imageQueries: unknown[] = [];

  const db: ProjectDeletionDb = {
    project: {
      findFirst: async () => ({
        id: "project-1",
        slug: "safe-project",
        title: "Generation Project",
        sections: [],
      }),
      delete: async () => ({ id: "project-1" }),
    },
    run: {
      findMany: async (args) => {
        runQueries.push(args);
        return [];
      },
      updateMany: async (args) => {
        runQueries.push(args);
        return { count: 0 };
      },
    },
    censoringTask: {
      findMany: async (args) => {
        censoringQueries.push(args);
        return [];
      },
      updateMany: async (args) => {
        censoringQueries.push(args);
        return { count: 0 };
      },
    },
    imageResult: {
      findMany: async (args) => {
        imageQueries.push(args);
        return [];
      },
    },
    trashRecord: {
      deleteMany: async () => ({ count: 0 }),
    },
  };

  const deps = {
    db,
    now: () => new Date("2026-06-01T00:00:00.000Z"),
    cleanupProjectSectionFiles: async () => ({ deletedManagedDir: false, deletedComfyDirs: 0 }),
    cleanupProjectExportDirectory: async () => ({ deletedExportDir: false }),
    removeTrashFile: async () => {},
    comfy: {
      apiUrl: "http://comfy.local",
      clearQueueSnapshotCache: () => {},
      getQueuePosition: async () => "not_found" as const,
      deleteQueueItems: async () => {},
      interruptPrompt: async () => {},
    },
    logWarning: () => {},
  };

  await cancelProjectTasksForCleanupWithDependencies("project-1", deps);
  await deleteProjectCompletelyWithDependencies("project-1", deps);

  for (const query of [...runQueries, ...censoringQueries, ...imageQueries]) {
    assert.match(
      JSON.stringify(query),
      /training_benchmark/,
      "cleanup subresource queries must retain the generation project boundary",
    );
  }
});

test("project export cleanup removes only contained data/export project directories", async () => {
  const { cleanupProjectExportDirectory, resolveProjectExportDirectory } = await import(
    "../src/server/services/project-file-cleanup-service"
  );

  const cwd = await mkdtemp(join(tmpdir(), "project-export-cleanup-"));
  const exportDir = resolve(cwd, "data", "export", "Exported Project");
  const outsideDir = resolve(cwd, "data", "outside");
  await mkdir(exportDir, { recursive: true });
  await mkdir(outsideDir, { recursive: true });
  await writeFile(join(exportDir, "Exported Project.zip"), "zip");
  await writeFile(join(outsideDir, "keep.txt"), "keep");

  assert.equal(resolveProjectExportDirectory("../outside", cwd), null);

  const skipped = await cleanupProjectExportDirectory("../outside", cwd);
  assert.equal(skipped.deletedExportDir, false);
  await access(outsideDir);

  const deleted = await cleanupProjectExportDirectory("Exported Project", cwd);
  assert.equal(deleted.deletedExportDir, true);
  await assert.rejects(access(exportDir));
});
