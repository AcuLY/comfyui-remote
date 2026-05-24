import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

function assertIncludes(content, needle, label) {
  if (!content.includes(needle)) {
    throw new Error(`${label}: missing ${JSON.stringify(needle)}`);
  }
}

function assertNotIncludes(content, needle, label) {
  if (content.includes(needle)) {
    throw new Error(`${label}: unexpected ${JSON.stringify(needle)}`);
  }
}

const workflowActions = read('src/app/character-lora-training/[jobId]/workflow-actions.ts');
const personaPage = read('src/app/character-lora-training/[jobId]/persona-reference/page.tsx');
const sectionDetailPage = read('src/app/character-lora-training/[jobId]/sections/[sectionId]/page.tsx');
const sharedUi = read('src/app/character-lora-training/[jobId]/shared-ui.tsx');
const previewComponent = read('src/app/character-lora-training/[jobId]/artifact-image-preview.tsx');
const workbenchClient = read('src/app/character-lora-training/[jobId]/job-workbench-client.tsx');

assertIncludes(workflowActions, 'return { ok: true, message: `已入队人设图', 'canonical enqueue action should return visible run/task feedback');
assertIncludes(workflowActions, 'previousCandidateImageIds', 'section enqueue action should accept previous candidate references');
assertIncludes(workflowActions, 'parentRunId', 'section enqueue action should accept parent run lineage');

assertIncludes(personaPage, '<WorkflowActionForm', 'persona reference page should use client action form for enqueue feedback');
assertIncludes(personaPage, '人设图任务状态', 'persona reference page should show canonical external task status');
assertIncludes(personaPage, 'canonicalTaskByRunId', 'persona reference page should join runs to worker tasks');

assertIncludes(sectionDetailPage, '基于此图重跑', 'section detail candidate card should expose rerun-from-image entry');
assertIncludes(sectionDetailPage, 'previousCandidateImageIds', 'section detail rerun should send the candidate image as previous reference');
assertIncludes(sectionDetailPage, 'parentRunId', 'section detail rerun should preserve parent run lineage');
assertIncludes(sectionDetailPage, '任务状态', 'section detail page should show generation/worker task status');

assertIncludes(workbenchClient, 'onRerunFromImage', 'expert workbench candidate cards should expose rerun-from-image action');
assertIncludes(workbenchClient, 'previousCandidateImageIds', 'expert workbench rerun should send previous candidate references');

assertIncludes(previewComponent, '"use client"', 'artifact preview should be a client-side lightbox component');
assertIncludes(previewComponent, 'fixed inset-0', 'artifact preview should render an in-page modal overlay');
assertIncludes(previewComponent, 'Escape', 'artifact preview should support Escape to close');
assertIncludes(sharedUi, '<ArtifactImagePreview', 'shared LoRA thumbnails should use in-page preview component');
assertIncludes(workbenchClient, '<ArtifactImagePreview', 'expert workbench thumbnails should use in-page preview component');
assertNotIncludes(sharedUi, 'target="_blank"', 'shared LoRA thumbnails should not open candidate images in a new tab');
assertNotIncludes(workbenchClient, 'target="_blank" rel="noreferrer" className="block"', 'expert workbench thumbnail should not open candidate images in a new tab');

console.log('LoRA workflow UI regression checks passed.');
