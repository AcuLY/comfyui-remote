import test from 'node:test';
import assert from 'node:assert/strict';
import {
  childrenFor, filterProjects, listKey, projectKey, projects, projectTabs, resolveContextRoute,
} from '../src/project-context-model.mjs';

const production = projects.find((project) => project.id === 'p01');
const training = projects.find((project) => project.id === 't01');

test('synthetic catalog covers both modules, filtering and long-name layout', () => {
  for (const module of ['production', 'training']) {
    const records = filterProjects(module);
    assert.equal(records.length, 18);
    assert.equal(new Set(records.map(({ id }) => id)).size, 18);
    assert.ok(records.some(({ name }) => name.length > 24));
    assert.equal(filterProjects(module, { status: 'archived' }).length, 3);
    assert.equal(filterProjects(module, { status: 'active' }).length, 15);
    assert.equal(filterProjects(module, { q: records[0].name, status: 'active' })[0].id, records[0].id);
    assert.equal(filterProjects(module, { q: '不存在的样本' }).length, 0);
  }
});

test('each module exposes only its own valid project tabs', () => {
  assert.deepEqual(projectTabs.production.map(({ id }) => id), ['overview', 'sections', 'images', 'tasks']);
  assert.deepEqual(projectTabs.training.map(({ id }) => id), ['overview', 'profile', 'references', 'compositions', 'materials', 'tasks']);
  for (const project of [production, training]) {
    for (const { id } of projectTabs[project.module]) {
      const result = resolveContextRoute(projectKey(project, id));
      assert.equal(result.tab, id);
      assert.equal(result.section, 'projects');
      assert.equal(result.kind, 'project');
      assert.equal(result.notice, undefined);
    }
  }
});

test('list query round trip preserves Chinese and punctuation and removes unsupported parameters', () => {
  const key = listKey('production', 'projects', { q: '雨后 & + / 小镇', status: 'archived' });
  const result = resolveContextRoute(`#${key}&unsupported=yes`);
  assert.equal(result.key, key);
  assert.deepEqual(result.filters, { q: '雨后 & + / 小镇', status: 'archived' });
  const normalized = resolveContextRoute(`training/projects?q=${'青'.repeat(100)}&status=invalid`);
  assert.equal(normalized.filters.q.length, 80);
  assert.equal(normalized.filters.status, 'all');
  assert.equal(resolveContextRoute(normalized.key).key, normalized.key);
});

test('project and child deep links retain the same-module filtered list source', () => {
  for (const project of [production, training]) {
    const tab = project.module === 'production' ? 'sections' : 'compositions';
    const child = childrenFor(project)[0];
    const from = listKey(project.module, 'projects', { q: project.name, status: 'active' });
    const key = projectKey(project, tab, from, child.id);
    const result = resolveContextRoute(`#${key}`);
    assert.equal(result.kind, 'child');
    assert.equal(result.key, key);
    assert.equal(result.child.id, child.id);
    assert.equal(result.from, from);
    assert.equal(result.rootKey, `${project.module}/projects`);
    const parent = resolveContextRoute(projectKey(result.project, result.tab, result.from));
    assert.equal(parent.kind, 'project');
    assert.equal(parent.from, from);
  }
});

test('task list is a valid source while external, cross-module and nested sources are discarded', () => {
  const from = listKey('training', 'tasks', { q: '运行中', status: 'active' });
  assert.equal(resolveContextRoute(from).rootKey, 'training/tasks');
  assert.equal(resolveContextRoute(projectKey(training, 'overview', from)).from, from);
  for (const invalid of [
    'https://example.com/training/projects', '//example.com/training/projects',
    'production/projects?q=青禾', 'training/projects/t02/overview',
    'training/settings', 'global/models', 'javascript:alert(1)',
  ]) {
    assert.equal(projectKey(training, 'overview', invalid), 'training/projects/t01/overview');
    const result = resolveContextRoute(`training/projects/t01/overview?from=${encodeURIComponent(invalid)}`);
    assert.equal(result.from, undefined);
    assert.equal(result.key, 'training/projects/t01/overview');
  }
});

test('invalid project tab falls back to its own overview and preserves a valid source', () => {
  for (const [project, invalidTab] of [[production, 'compositions'], [training, 'images']]) {
    const from = listKey(project.module, 'projects', { q: project.name });
    const result = resolveContextRoute(`${project.module}/projects/${project.id}/${invalidTab}?from=${encodeURIComponent(from)}`);
    assert.equal(result.module, project.module);
    assert.equal(result.tab, 'overview');
    assert.equal(result.project.id, project.id);
    assert.equal(result.from, from);
    assert.match(result.notice, /页签.*概览/);
    assert.equal(resolveContextRoute(result.key).notice, undefined);
  }
});

test('missing child recovers to its project collection, not the root list', () => {
  for (const [project, tab, noun] of [[production, 'sections', '小节'], [training, 'compositions', '构图']]) {
    const result = resolveContextRoute(`${project.module}/projects/${project.id}/${tab}/missing`);
    assert.equal(result.kind, 'project');
    assert.equal(result.tab, tab);
    assert.equal(result.project.id, project.id);
    assert.equal(result.key, projectKey(project, tab));
    assert.ok(result.notice.includes(noun));
  }
});

test('missing project returns to its module list and restores only a valid project-list filter', () => {
  for (const module of ['production', 'training']) {
    const source = listKey(module, 'projects', { q: '雨后 & 光线', status: 'archived' });
    const result = resolveContextRoute(`${module}/projects/missing/overview?from=${encodeURIComponent(source)}`);
    assert.equal(result.kind, 'list');
    assert.equal(result.key, source);
    assert.equal(result.module, module);
    assert.match(result.notice, /项目不存在/);
    const taskSource = listKey(module, 'tasks', { q: '已完成' });
    assert.equal(resolveContextRoute(`${module}/projects/missing/overview?from=${encodeURIComponent(taskSource)}`).key, `${module}/projects`);
  }
  const crossed = resolveContextRoute('training/projects/p01/overview?from=production%2Fprojects%3Fq%3Dwrong');
  assert.equal(crossed.key, 'training/projects');
  assert.deepEqual(crossed.filters, { q: '', status: 'all' });
});

test('unknown module and unknown module paths have canonical task fallbacks', () => {
  assert.equal(resolveContextRoute('').key, 'production/projects');
  assert.equal(resolveContextRoute('#').key, 'production/projects');
  assert.equal(resolveContextRoute('unknown/projects/p01/overview').key, 'production/tasks');
  const own = resolveContextRoute('training/unknown/child');
  assert.equal(own.key, 'training/tasks');
  assert.match(own.notice, /训练/);
  assert.equal(resolveContextRoute('production/tasks/unknown').key, 'production/tasks');
});

test('global and stub entries resolve without manufacturing project content', () => {
  for (const section of ['models', 'monitoring', 'settings']) {
    const result = resolveContextRoute(`global/${section}?ignored=yes`);
    assert.equal(result.kind, 'global');
    assert.equal(result.key, `global/${section}`);
    assert.equal(result.project, undefined);
  }
  for (const module of ['production', 'training']) {
    for (const section of ['presets', 'templates']) {
      const result = resolveContextRoute(`${module}/${section}`);
      assert.equal(result.kind, 'stub');
      assert.equal(result.module, module);
      assert.equal(result.rootKey, `${module}/${section}`);
    }
  }
});

test('normalization is stable for incomplete, malformed and over-deep fragment routes', () => {
  for (const raw of [
    '#/production/projects/p01/', 'production/projects/p01/sections/s01/extra',
    'training/projects/t01/profile/unknown', 'training/projects/t01/compositions/c01?from=%E0%A4%A',
    'https://example.com/production/projects', 'global/unknown', 'production/projects?q=%E0%A4%A',
  ]) {
    const first = resolveContextRoute(raw);
    const second = resolveContextRoute(first.key);
    assert.equal(second.key, first.key);
    assert.equal(second.notice, undefined);
  }
});
