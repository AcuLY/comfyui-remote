import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("section two-stage KSampler switch is submitted and persisted through write paths", () => {
  const action = readSource("src/app/projects/actions.ts");
  const service = readSource("src/server/services/project-service.ts");
  const repository = readSource("src/server/repositories/project-repository.ts");
  const sectionActions = readSource("src/lib/actions/section.ts");
  const templateSave = readSource("src/lib/actions/template-save.ts");
  const templateImport = readSource("src/lib/actions/template-import.ts");
  const templateCrud = readSource("src/lib/actions/template-crud.ts");
  const templateResolver = readSource("src/server/prompt-config/template-resolver.ts");

  assert.match(action, /useTwoStageKSampler/);
  assert.match(service, /"useTwoStageKSampler"/);
  assert.match(service, /useTwoStageKSampler:\s*normalizeOptionalBoolean\(parsedBody\.useTwoStageKSampler/);
  assert.match(repository, /data\.useTwoStageKSampler\s*=\s*input\.useTwoStageKSampler/);
  assert.match(sectionActions, /useTwoStageKSampler:\s*true/);
  assert.match(sectionActions, /useTwoStageKSampler:\s*section\.useTwoStageKSampler/);
  assert.match(templateSave, /useTwoStageKSampler:\s*section\.useTwoStageKSampler/);
  assert.match(templateImport, /useTwoStageKSampler:\s*sectionData\.useTwoStageKSampler \?\? true/);
  assert.match(templateCrud, /useTwoStageKSampler:\s*section\.useTwoStageKSampler/);
  assert.match(templateResolver, /useTwoStageKSampler/);
});

test("section parameter form uses the explicit two-stage switch instead of 1x upscale semantics", () => {
  const page = readSource("src/app/projects/[projectId]/sections/[sectionId]/page.tsx");
  const form = readSource("src/app/projects/[projectId]/sections/[sectionId]/section-params-form.tsx");

  assert.match(page, /readResolvedBooleanParam\("useTwoStageKSampler"\)/);
  assert.match(form, /name="useTwoStageKSampler"/);
  assert.match(form, /setUseTwoStageKSampler/);
  assert.match(form, /disabled=\{pending \|\| !useTwoStageKSampler\}/);
  assert.doesNotMatch(form, /upscaleFactor === "1"/);
});
