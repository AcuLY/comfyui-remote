import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductionSeed, resolveProductionRoute, advanceSimulation } from '../src/production-model.mjs';
import { exportEligibility } from '../src/production-export-model.mjs';

test('every production output resolves to its actual task and section', () => {
  const data = createProductionSeed();
  for (const image of data.images) {
    const run = data.runs.find(r => r.id === image.runId);
    assert.equal(run.projectId, image.projectId);
    assert.equal(run.sectionId, image.sectionId);
    assert.equal(data.sections.find(s => s.id === image.sectionId).projectId, image.projectId);
    if (image.tags.length) assert.equal(image.review, 'kept');
  }
});

test('foreign and deleted section routes fall back to the owning project', () => {
  const data = createProductionSeed();
  for (const id of ['s07', 'missing']) {
    const route = resolveProductionRoute('production/projects/p01/sections/' + id, data);
    assert.equal(route.key, 'production/projects/p01');
    assert.ok(route.notice);
  }
});

test('missing resources never reopen the discarded overview or task design', () => {
  const data = createProductionSeed();
  assert.equal(resolveProductionRoute('production/projects/p07/overview', data).key, 'production/projects');
  assert.equal(resolveProductionRoute('production/projects/p01/overview', data).key, 'production/projects/p01');
  assert.equal(resolveProductionRoute('production/tasks/missing', data).key, 'production/tasks');
});

test('query filters and edit routes survive route parsing', () => {
  const data = createProductionSeed();
  const route = resolveProductionRoute('production/projects/p01/sections/s01?tab=presets&folder=sf-p01', data);
  assert.deepEqual(route.segments, ['projects', 'p01', 'sections', 's01']);
  assert.deepEqual(route.query, { tab: 'presets', folder: 'sf-p01' });
  assert.equal(resolveProductionRoute('production/projects/new', data).key, 'production/projects/new');
});

test('simulated completion produces outputs once and preserves the input snapshot', () => {
  const data = createProductionSeed();
  const original = structuredClone(data);
  const first = advanceSimulation(data);
  const second = advanceSimulation(first);
  assert.deepEqual(data, original);
  assert.equal(second.runs.find(r => r.id === 'r04').status, 'completed');
  const outputIds = second.images.filter(i => i.runId === 'r04').map(i => i.id);
  assert.equal(outputIds.length, 4);
  assert.equal(new Set(outputIds).size, 4);
  const third = advanceSimulation(second);
  assert.equal(third.images.length, second.images.length);
  assert.deepEqual(third.runs.find(r => r.id === 'r04').params, original.runs.find(r => r.id === 'r04').params);
});

test('paused queue does not advance image generation', () => {
  const data = createProductionSeed();
  data.queuePaused = true;
  const advanced = advanceSimulation(data);
  assert.deepEqual(advanced.runs, data.runs);
  assert.deepEqual(advanced.images, data.images);
});

test('archived samples do not contain nonterminal production work', () => {
  const data = createProductionSeed();
  for (const project of data.projects.filter(p => p.archived)) {
    assert.ok(data.runs.filter(r => r.projectId === project.id).every(r => ['completed', 'failed', 'cancelled'].includes(r.status)));
  }
});

test('export requires unique slug, one cover, retained images and censored purpose images', () => {
  const data = createProductionSeed(), project = data.projects[0];
  assert.ok(exportEligibility(project, data).missing.length > 0);
  data.images.filter(i => i.projectId === project.id).forEach(i => { i.censored = true; });
  assert.deepEqual(exportEligibility(project, data).issues, []);
  data.projects[1].slug = project.slug;
  assert.ok(exportEligibility(project, data).issues.some(i => i.includes('英文标识已被')));
  data.images.find(i => i.projectId === project.id && !i.tags.includes('cover')).tags.push('cover');
  assert.ok(exportEligibility(project, data).issues.some(i => i.includes('恰好一张封面')));
});

test('trash and non-purpose retained images do not create censor export blockers', () => {
  const data = createProductionSeed(), project = data.projects[0];
  data.images.filter(i => i.projectId === project.id && i.tags.length).forEach(i => { i.censored = true; });
  const image = data.images.find(i => i.projectId === project.id && !i.tags.length);
  image.review = 'kept'; image.censored = false;
  assert.deepEqual(exportEligibility(project, data).issues, []);
  assert.ok(exportEligibility(project, data).kept.some(i => i.id === image.id));
  image.trashed = true; image.tags.push('featured');
  assert.deepEqual(exportEligibility(project, data).issues, []);
});

test('one simulated censor step updates its actual image and ignores pending pause callbacks', () => {
  const data = createProductionSeed(), image = data.images[0];
  data.censorJobs = [{ id: 'new', status: 'running', done: 0, total: 1, imageIds: [image.id] }];
  const next = advanceSimulation(data);
  assert.equal(next.images[0].censored, true);
  assert.equal(next.censorJobs[0].status, 'completed');
  data.censorJobs[0].pauseRequested = true;
  assert.equal(advanceSimulation(data).censorJobs[0].done, 0);
});

test('starting a submitted task reuses the submitted attempt', () => {
  const data = createProductionSeed();
  data.runs = data.runs.filter(run => run.status === 'submitted');
  const originalId = data.runs[0].attempts[0].id;
  const next = advanceSimulation(data);
  assert.equal(next.runs[0].status, 'running');
  assert.equal(next.runs[0].attempts.length, 1);
  assert.equal(next.runs[0].attempts[0].id, originalId);
});

test('a retried task starts a new attempt and keeps the prior failure', () => {
  const data = createProductionSeed();
  data.runs = data.runs.filter(run => run.status === 'failed');
  const previous = structuredClone(data.runs[0].attempts[0]);
  data.runs[0].status = 'unsubmitted'; data.runs[0].error = '';
  const next = advanceSimulation(data);
  assert.equal(next.runs[0].attempts.length, 2);
  assert.deepEqual(next.runs[0].attempts[0], previous);
  assert.equal(next.runs[0].attempts[1].status, 'running');
});
