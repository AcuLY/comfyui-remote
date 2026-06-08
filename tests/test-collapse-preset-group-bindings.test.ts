import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";

import { collapsePresetGroupBindings } from "../scripts/db/collapse-preset-group-bindings";

function setupDb(dbPath: string) {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE "PresetGroup" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "categoryId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL
    );
    CREATE TABLE "SectionPresetBinding" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectSectionId" TEXT NOT NULL,
      "bindingKey" TEXT NOT NULL,
      "categoryId" TEXT NOT NULL,
      "presetId" TEXT,
      "variantId" TEXT,
      "presetGroupId" TEXT,
      "groupBindingKey" TEXT,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME
    );
    CREATE TABLE "SectionPromptBlock" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectSectionId" TEXT NOT NULL,
      "sectionBindingId" TEXT,
      "type" TEXT NOT NULL DEFAULT 'custom',
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME
    );
    CREATE TABLE "SectionManualLoraEntry" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectSectionId" TEXT NOT NULL,
      "sectionBindingId" TEXT,
      "stage" TEXT NOT NULL,
      "path" TEXT NOT NULL,
      "detachedFromBindingKey" TEXT,
      "detachedFromPath" TEXT
    );
    CREATE TABLE "TemplateSectionPresetBinding" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectTemplateSectionId" TEXT NOT NULL,
      "bindingKey" TEXT NOT NULL,
      "categoryId" TEXT NOT NULL,
      "presetId" TEXT,
      "variantId" TEXT,
      "presetGroupId" TEXT,
      "groupBindingKey" TEXT,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME
    );
    CREATE TABLE "TemplateSectionPromptBlock" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectTemplateSectionId" TEXT NOT NULL,
      "templateSectionBindingId" TEXT,
      "type" TEXT NOT NULL DEFAULT 'custom',
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME
    );
    CREATE TABLE "TemplateSectionManualLoraEntry" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectTemplateSectionId" TEXT NOT NULL,
      "templateSectionBindingId" TEXT,
      "stage" TEXT NOT NULL,
      "path" TEXT NOT NULL,
      "detachedFromBindingKey" TEXT,
      "detachedFromPath" TEXT
    );

    INSERT INTO "PresetGroup" ("id", "categoryId", "name", "slug")
      VALUES ('group-1', 'cat-group', 'Group One', 'group-one');

    INSERT INTO "SectionPresetBinding"
      ("id", "projectSectionId", "bindingKey", "categoryId", "presetId", "variantId", "groupBindingKey", "sortOrder", "createdAt")
      VALUES
      ('section-binding-a', 'section-1', 'bind-a', 'cat-member', 'preset-a', 'variant-a', 'grp:group-1:instance-1', 10, '2026-01-01'),
      ('section-binding-b', 'section-1', 'bind-b', 'cat-member', 'preset-b', 'variant-b', 'grp:group-1:instance-1', 11, '2026-01-02'),
      ('section-legacy-a', 'section-1', 'legacy-a', 'cat-member', 'preset-c', 'variant-c', 'legacy-instance', 20, '2026-01-03'),
      ('section-legacy-b', 'section-1', 'legacy-b', 'cat-member', 'preset-d', 'variant-d', 'legacy-instance', 21, '2026-01-04');
    INSERT INTO "SectionPresetBinding"
      ("id", "projectSectionId", "bindingKey", "categoryId", "presetId", "variantId", "presetGroupId", "groupBindingKey", "sortOrder", "createdAt")
      VALUES
      ('section-tracked-a', 'section-2', 'tracked-a', 'cat-member', 'preset-a', 'variant-a', 'group-1', 'grp:group-1:tracked-instance', 30, '2026-01-05'),
      ('section-tracked-b', 'section-2', 'tracked-b', 'cat-member', 'preset-b', 'variant-b', 'group-1', 'grp:group-1:tracked-instance', 31, '2026-01-06');
    INSERT INTO "SectionPromptBlock"
      ("id", "projectSectionId", "sectionBindingId", "type", "sortOrder", "createdAt")
      VALUES
      ('section-prompt-a', 'section-1', 'section-binding-a', 'preset', 10, '2026-01-01'),
      ('section-prompt-b', 'section-1', 'section-binding-b', 'preset', 11, '2026-01-02'),
      ('section-tracked-prompt-a', 'section-2', 'section-tracked-a', 'preset', 30, '2026-01-05'),
      ('section-tracked-prompt-b', 'section-2', 'section-tracked-b', 'preset', 31, '2026-01-06');
    INSERT INTO "SectionManualLoraEntry"
      ("id", "projectSectionId", "sectionBindingId", "stage", "path", "detachedFromBindingKey", "detachedFromPath")
      VALUES
      ('section-lora-a', 'section-1', 'section-binding-b', 'lora1', 'a.safetensors', 'bind-b', 'a.safetensors');

    INSERT INTO "TemplateSectionPresetBinding"
      ("id", "projectTemplateSectionId", "bindingKey", "categoryId", "presetId", "variantId", "groupBindingKey", "sortOrder", "createdAt")
      VALUES
      ('template-binding-a', 'template-section-1', 'template-bind-a', 'cat-member', 'preset-a', 'variant-a', 'grp:group-1:template-instance', 5, '2026-01-01'),
      ('template-binding-b', 'template-section-1', 'template-bind-b', 'cat-member', 'preset-b', 'variant-b', 'grp:group-1:template-instance', 6, '2026-01-02');
    INSERT INTO "TemplateSectionPromptBlock"
      ("id", "projectTemplateSectionId", "templateSectionBindingId", "type", "sortOrder", "createdAt")
      VALUES
      ('template-prompt-a', 'template-section-1', 'template-binding-a', 'preset', 5, '2026-01-01'),
      ('template-prompt-b', 'template-section-1', 'template-binding-b', 'preset', 6, '2026-01-02');
    INSERT INTO "TemplateSectionManualLoraEntry"
      ("id", "projectTemplateSectionId", "templateSectionBindingId", "stage", "path", "detachedFromBindingKey", "detachedFromPath")
      VALUES
      ('template-lora-a', 'template-section-1', 'template-binding-b', 'lora2', 'b.safetensors', 'template-bind-b', 'b.safetensors');
  `);
  db.close();
}

test("collapsePresetGroupBindings dry-run reports without writing", async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "collapse-preset-groups-dry-"));
  const dbPath = path.join(tempDir, "test.db");
  setupDb(dbPath);

  try {
    const summary = collapsePresetGroupBindings({ databaseUrl: `file:${dbPath}` });
    assert.equal(summary.dryRun, true);
    assert.equal(summary.section.collapsedGroups, 2);
    assert.equal(summary.section.skippedLegacyGroups, 1);
    assert.equal(summary.template.collapsedGroups, 1);

    const db = new Database(dbPath, { readonly: true });
    try {
      const sectionRefs = db.prepare("SELECT COUNT(*) AS count FROM SectionPresetBinding WHERE presetGroupId IS NOT NULL").get() as { count: number };
      assert.equal(sectionRefs.count, 2);
    } finally {
      db.close();
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("collapsePresetGroupBindings folds expanded section and template members into group references", async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "collapse-preset-groups-write-"));
  const dbPath = path.join(tempDir, "test.db");
  setupDb(dbPath);

  try {
    const summary = collapsePresetGroupBindings({ databaseUrl: `file:${dbPath}`, write: true });
    assert.equal(summary.dryRun, false);
    assert.equal(summary.section.collapsedGroups, 2);
    assert.equal(summary.section.deletedBindings, 2);
    assert.equal(summary.section.deletedPromptBlocks, 2);
    assert.equal(summary.section.movedManualLoras, 1);
    assert.equal(summary.template.collapsedGroups, 1);

    const db = new Database(dbPath, { readonly: true });
    try {
      const sectionRows = db.prepare(`
        SELECT id, bindingKey, categoryId, presetId, variantId, presetGroupId, groupBindingKey, sortOrder
        FROM SectionPresetBinding
        WHERE groupBindingKey = 'grp:group-1:instance-1'
        ORDER BY sortOrder
      `).all();
      assert.deepEqual(sectionRows, [
        {
          id: "section-binding-a",
          bindingKey: "bind-a",
          categoryId: "cat-group",
          presetId: null,
          variantId: null,
          presetGroupId: "group-1",
          groupBindingKey: "grp:group-1:instance-1",
          sortOrder: 10,
        },
      ]);

      const trackedRows = db.prepare(`
        SELECT id, bindingKey, categoryId, presetId, variantId, presetGroupId, groupBindingKey, sortOrder
        FROM SectionPresetBinding
        WHERE groupBindingKey = 'grp:group-1:tracked-instance'
        ORDER BY sortOrder
      `).all();
      assert.deepEqual(trackedRows, [
        {
          id: "section-tracked-a",
          bindingKey: "tracked-a",
          categoryId: "cat-group",
          presetId: null,
          variantId: null,
          presetGroupId: "group-1",
          groupBindingKey: "grp:group-1:tracked-instance",
          sortOrder: 30,
        },
      ]);

      const sectionPrompts = db.prepare("SELECT id, sectionBindingId, type, sortOrder FROM SectionPromptBlock WHERE projectSectionId = 'section-1' ORDER BY id").all();
      assert.deepEqual(sectionPrompts, [
        { id: "section-prompt-a", sectionBindingId: "section-binding-a", type: "preset", sortOrder: 10 },
      ]);

      const sectionLora = db.prepare("SELECT sectionBindingId, detachedFromBindingKey FROM SectionManualLoraEntry WHERE id = 'section-lora-a'").get();
      assert.deepEqual(sectionLora, {
        sectionBindingId: "section-binding-a",
        detachedFromBindingKey: "bind-a",
      });

      const legacyRows = db.prepare("SELECT COUNT(*) AS count FROM SectionPresetBinding WHERE groupBindingKey = 'legacy-instance'").get() as { count: number };
      assert.equal(legacyRows.count, 2);

      const templateRows = db.prepare(`
        SELECT id, categoryId, presetId, variantId, presetGroupId, groupBindingKey, sortOrder
        FROM TemplateSectionPresetBinding
        WHERE groupBindingKey = 'grp:group-1:template-instance'
      `).all();
      assert.deepEqual(templateRows, [
        {
          id: "template-binding-a",
          categoryId: "cat-group",
          presetId: null,
          variantId: null,
          presetGroupId: "group-1",
          groupBindingKey: "grp:group-1:template-instance",
          sortOrder: 5,
        },
      ]);

      const templateLora = db.prepare("SELECT templateSectionBindingId, detachedFromBindingKey FROM TemplateSectionManualLoraEntry WHERE id = 'template-lora-a'").get();
      assert.deepEqual(templateLora, {
        templateSectionBindingId: "template-binding-a",
        detachedFromBindingKey: "template-bind-a",
      });
    } finally {
      db.close();
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
