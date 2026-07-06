import assert from "node:assert/strict";
import test from "node:test";

import { ServiceValidationError } from "../src/server/services/validation-utils";

process.env.DB_PROVIDER ??= "sqlite";
process.env.DATABASE_URL ??= "file:./data/test-project-section-delete-service.db";

let deleteProjectSectionsWithDependencies: typeof import("../src/server/services/project-service").deleteProjectSectionsWithDependencies;
let normalizeBatchDeleteProjectSectionsBody: typeof import("../src/server/services/project-service").normalizeBatchDeleteProjectSectionsBody;

test.before(async () => {
  const projectService = await import("../src/server/services/project-service");

  deleteProjectSectionsWithDependencies = projectService.deleteProjectSectionsWithDependencies;
  normalizeBatchDeleteProjectSectionsBody = projectService.normalizeBatchDeleteProjectSectionsBody;
});

test("normalizeBatchDeleteProjectSectionsBody trims and deduplicates section ids", () => {
  assert.deepEqual(
    normalizeBatchDeleteProjectSectionsBody({ sectionIds: [" section-1 ", "section-2", "section-1"] }),
    ["section-1", "section-2"],
  );
});

test("normalizeBatchDeleteProjectSectionsBody rejects invalid section id lists", () => {
  assert.throws(
    () => normalizeBatchDeleteProjectSectionsBody({ sectionIds: ["section-1", " "] }),
    /sectionIds must be a non-empty string array/,
  );
  assert.throws(
    () => normalizeBatchDeleteProjectSectionsBody([]),
    /Request body must be an object/,
  );
});

test("deleteProjectSectionsWithDependencies verifies project ownership before deleting", async () => {
  const calls: Array<{ projectId: string; sectionIds: string[] }> = [];
  let deletedSectionIds: string[] | null = null;

  const result = await deleteProjectSectionsWithDependencies(" project-1 ", {
    sectionIds: [" section-1 ", "section-2", "section-1"],
  }, {
    findProjectSections: async (projectId, sectionIds) => {
      calls.push({ projectId, sectionIds });
      return [{ id: "section-1" }, { id: "section-2" }];
    },
    deleteSections: async (sectionIds) => {
      deletedSectionIds = sectionIds;
    },
  });

  assert.deepEqual(calls, [{ projectId: "project-1", sectionIds: ["section-1", "section-2"] }]);
  assert.deepEqual(deletedSectionIds, ["section-1", "section-2"]);
  assert.deepEqual(result, { deletedCount: 2 });
});

test("deleteProjectSectionsWithDependencies does not delete when any section is outside the project", async () => {
  let deleteCalled = false;

  await assert.rejects(
    () => deleteProjectSectionsWithDependencies("project-1", {
      sectionIds: ["section-1", "section-2"],
    }, {
      findProjectSections: async () => [{ id: "section-1" }],
      deleteSections: async () => {
        deleteCalled = true;
      },
    }),
    (error) =>
      error instanceof ServiceValidationError &&
      error.message === "One or more sections were not found in this project" &&
      error.status === 404,
  );

  assert.equal(deleteCalled, false);
});
