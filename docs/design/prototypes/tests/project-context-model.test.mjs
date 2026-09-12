import test from 'node:test';
import assert from 'node:assert/strict';
import {
  childrenFor, filterProjects, listKey, projectKey, projects, projectTabs, resolveContextRoute,
  initialDataset, filterChildren, filterTasks, taskKey, foldersFor, folderTrail, projectFolderScope, sectionFolderScope,
  createFolder, renameFolder, moveFolder, moveResource,
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

test('related image records distinguish tasks from projects and unfinished outputs', () => {
  for (const project of projects) {
    assert.match(project.photo, /^\/media\/context\/scene-[1-6]\.jpg$/);
    const ownChildren = childrenFor(project);
    assert.equal(ownChildren.length, 6);
    assert.ok(ownChildren.every(child => child.projectId === project.id && child.module === project.module && child.photo));
    const ownTasks = filterTasks(project.module, { projectId: project.id });
    assert.equal(ownTasks.length, 4);
    for (const task of ownTasks) {
      assert.notEqual(task.id, project.id);
      assert.ok(task.sourcePhoto);
      assert.equal(task.photo !== null, task.state === 'done');
      if (task.childId) assert.ok(ownChildren.some(child => child.id === task.childId));
      const route = resolveContextRoute(taskKey(task));
      assert.equal(route.kind, 'task');
      assert.equal(route.section, 'tasks');
      assert.equal(route.project.id, project.id);
      assert.equal(route.task.id, task.id);
    }
  }
  assert.deepEqual(new Set(initialDataset.tasks.map(task => task.type)), new Set(['image-generation', 'material-generation', 'lora-training']));
  assert.ok(filterTasks('production', { q: '雨后街角', status: 'running' }).every(task => task.projectId === 'p01' && task.state === 'running'));
});

test('project and section folder URLs preserve current scope and list origins', () => {
  const scope = projectFolderScope('production');
  assert.equal(foldersFor(scope).length, 2);
  assert.ok(filterProjects('production', { folder: '' }).length >= 4);
  assert.equal(production.folderId, '');
  assert.equal(projects.find(project => project.id === 'p02').folderId, 'f-project-city');
  const source = listKey('production', 'projects', { q: '薄暮', folder: 'f-project-city' });
  const route = resolveContextRoute(projectKey(production, 'sections', source, '', { folder: 'f-p01-scenes', q: '光线' }));
  assert.equal(route.filters.folder, 'f-p01-scenes');
  assert.equal(route.filters.q, '光线');
  assert.equal(route.from, source);
  assert.deepEqual(folderTrail(scope, 'f-project-city').map(folder => folder.name), ['场景创作', '城市日常']);
  assert.equal(filterChildren(production, { folder: 'f-p01-scenes', q: '光线' })[0].id, 's03');
  const deep = resolveContextRoute(projectKey(production, 'sections', source, 's03', route.filters));
  assert.equal(deep.child.projectId, 'p01');
  assert.equal(deep.filters.folder, 'f-p01-scenes');
  assert.equal(resolveContextRoute(deep.key).key, deep.key);
  assert.equal(resolveContextRoute('training/projects?folder=f-project-scenes').filters.folder, undefined);
});

test('folder mutations are immutable and stay inside one organizational scope', () => {
  const scope = sectionFolderScope(production);
  const created = createFolder(initialDataset, { scope, name: '  新镜头  ', id: 'local-new' });
  assert.equal(created.folders.at(-1).name, '新镜头');
  assert.equal(initialDataset.folders.some(folder => folder.id === 'local-new'), false);
  const renamed = renameFolder(created, { id: 'local-new', name: '补充镜头' });
  assert.equal(created.folders.at(-1).name, '新镜头');
  assert.equal(renamed.folders.at(-1).name, '补充镜头');
  const moved = moveFolder(renamed, { id: 'local-new', parentId: 'f-p01-scenes' });
  assert.equal(moved.folders.at(-1).parentId, 'f-p01-scenes');
  assert.equal(renamed.folders.at(-1).parentId, '');
  assert.throws(() => moveFolder(moved, { id: 'local-new', parentId: 'f-p02-scenes' }), /当前范围/);
  assert.throws(() => createFolder(initialDataset, { scope: 'training/projects', name: '错误' }), /不支持/);
  assert.throws(() => createFolder(initialDataset, { scope, parentId: 'f-project-scenes', name: '错误' }), /当前范围/);
  assert.throws(() => renameFolder(initialDataset, { id: 'f-project-scenes', name: '人物研究' }), /同名/);
  assert.throws(() => createFolder(initialDataset, { scope, name: '   ' }), /名称/);
});

test('folder moving prevents self and descendant cycles while allowing same-scope reparenting', () => {
  assert.throws(() => moveFolder(initialDataset, { id: 'f-project-scenes', parentId: 'f-project-scenes' }), /自身/);
  assert.throws(() => moveFolder(initialDataset, { id: 'f-project-scenes', parentId: 'f-project-city' }), /子文件夹/);
  const moved = moveFolder(initialDataset, { id: 'f-project-city', parentId: 'f-project-portraits' });
  assert.deepEqual(folderTrail('production/projects', 'f-project-city', moved).map(folder => folder.id), ['f-project-portraits', 'f-project-city']);
  assert.equal(initialDataset.folders.find(folder => folder.id === 'f-project-city').parentId, 'f-project-scenes');
});

test('moving a project or section changes only that exact resource and preserves child identity', () => {
  const movedProject = moveResource(initialDataset, { kind: 'project', id: 'p01', module: 'production', folderId: 'f-project-city' });
  assert.equal(filterProjects('production', { folder: 'f-project-city' }, movedProject).some(project => project.id === 'p01'), true);
  assert.equal(production.folderId, '');
  const movedChild = moveResource(movedProject, { kind: 'child', module: 'production', projectId: 'p01', id: 's01', folderId: 'f-p01-scenes' });
  assert.equal(filterChildren(production, { folder: 'f-p01-scenes' }, movedChild).some(child => child.id === 's01'), true);
  assert.equal(childrenFor(projects.find(project => project.id === 'p02'), movedChild)[0].folderId, '');
  assert.equal(resolveContextRoute('production/projects/p01/sections/s01', movedChild).child.folderId, 'f-p01-scenes');
  assert.throws(() => moveResource(initialDataset, { kind: 'child', module: 'production', projectId: 'p01', id: 's01', folderId: 'f-p02-scenes' }), /当前范围/);
  assert.throws(() => moveResource(initialDataset, { kind: 'project', module: 'training', id: 't01', folderId: '' }), /不支持/);
});

test('missing folders recover to their surviving parent within the same scope', () => {
  const removed = { ...initialDataset, folders: initialDataset.folders.filter(folder => !['f-project-city', 'f-p01-details'].includes(folder.id)) };
  const rootList = resolveContextRoute('production/projects?folder=f-project-city&q=薄暮', removed);
  assert.equal(rootList.filters.folder, 'f-project-scenes');
  assert.equal(rootList.filters.q, '薄暮');
  assert.match(rootList.notice, /上级文件夹/);
  const sectionList = resolveContextRoute('production/projects/p01/sections?folder=f-p01-details', removed);
  assert.equal(sectionList.filters.folder, 'f-p01-scenes');
  assert.equal(sectionList.project.id, 'p01');
  const invalid = resolveContextRoute('production/projects/p01/sections?folder=f-p02-scenes', removed);
  assert.equal(invalid.filters.folder, undefined);
  assert.equal(invalid.key, 'production/projects/p01/sections');
  assert.equal(resolveContextRoute('production/projects?folder=unknown', removed).key, 'production/projects');
});

test('task detail restores its real task source without cross-module or recursive origins', () => {
  const task = initialDataset.tasks[0];
  const list = listKey('production', 'tasks', { q: '场景', status: 'done' });
  assert.equal(resolveContextRoute(taskKey(task, list)).from, list);
  const projectSource = projectKey(production, 'tasks', listKey('production', 'projects', { folder: 'f-project-city' }), '', { q: '场景', status: 'done' });
  const routed = resolveContextRoute(taskKey(task, projectSource));
  const safeProjectSource = projectSource;
  assert.equal(routed.from, safeProjectSource);
  assert.equal(resolveContextRoute(routed.from).filters.status, 'done');
  assert.equal(resolveContextRoute(routed.from).from, listKey('production', 'projects', { folder: 'f-project-city' }));
  for (const from of ['training/tasks', 'production/projects', 'production/tasks/run-p01-1', 'https://example.com/production/tasks', '//example.com/production/tasks', 'production/projects/missing/tasks']) {
    assert.equal(resolveContextRoute(taskKey(task, from)).from, undefined);
  }
  const missing = resolveContextRoute(`production/tasks/missing?from=${encodeURIComponent(safeProjectSource)}`);
  assert.equal(missing.kind, 'project');
  assert.equal(missing.key, safeProjectSource);
  assert.match(missing.notice, /任务不存在/);
  assert.equal(resolveContextRoute('training/tasks/run-p01-1').key, 'training/tasks');
});

test('task details return to the exact project overview, child workspace or collection', () => {
  for (const project of [production, training]) {
    const task = filterTasks(project.module, { projectId: project.id, status: 'done' })[0];
    const childTab = project.module === 'production' ? 'sections' : 'compositions';
    const child = childrenFor(project).find(item => item.id === task.childId);
    const origin = listKey(project.module, 'projects', { q: project.name, status: 'active', ...(project.module === 'production' ? { folder: 'f-project-city' } : {}) });
    const filters = project.module === 'production' ? { folder: 'f-p01-scenes', q: '场景' } : { q: '正面' };
    for (const [tab, childId, query] of [['overview', '', {}], [childTab, child.id, filters], [childTab, '', filters]]) {
      const source = projectKey(project, tab, origin, childId, query);
      const expected = source;
      const detail = resolveContextRoute(taskKey(task, source));
      assert.equal(detail.kind, 'task');
      assert.equal(detail.from, expected);
      const restored = resolveContextRoute(detail.from);
      assert.equal(restored.kind, childId ? 'child' : 'project');
      assert.equal(restored.project.id, project.id);
      assert.equal(restored.tab, tab);
      assert.equal(restored.child?.id || '', childId);
      assert.equal(restored.from, origin);
      assert.deepEqual(resolveContextRoute(restored.from).filters, resolveContextRoute(origin).filters);
      assert.equal(restored.notice, undefined);
    }
    for (const invalid of [
      `${project.module}/projects/${project.id}/${childTab}/missing`,
      `${project.module}/projects/${project.id}/${childTab}/${child.id}/extra`,
      `${project.module}/projects/${project.id}/overview/${child.id}`,
      `${project.module}/projects/${project.id}/tasks/${child.id}`,
      `${project.module}/projects/${project.id}/${project.module === 'production' ? 'compositions' : 'sections'}/${child.id}`,
      `${project.module}/projects/${project.module === 'production' ? 't01' : 'p01'}/${childTab}/${child.id}`,
      `${project.module}/projects/${project.id}/images`,
    ]) assert.equal(resolveContextRoute(taskKey(task, invalid)).from, undefined);
  }
  const withoutChild = { ...initialDataset, children: initialDataset.children.filter(child => !(child.projectId === 'p01' && child.id === 's01')) };
  assert.equal(resolveContextRoute(taskKey(initialDataset.tasks[0], 'production/projects/p01/sections/s01', withoutChild), withoutChild).from, undefined);
});

test('task source retains one bounded list origin and strips deeper or invalid origins', () => {
  const task = initialDataset.tasks[0];
  const childSource = 'production/projects/p01/sections/s01';
  const listOrigin = listKey('production', 'projects', { q: '雨后', status: 'active', folder: 'f-project-city' });
  const tooDeepList = `${listOrigin}&from=${encodeURIComponent('production/projects/p02/overview?from=training%2Fprojects')}`;
  const sourceWithNestedList = `${childSource}?from=${encodeURIComponent(tooDeepList)}`;
  const route = resolveContextRoute(taskKey(task, sourceWithNestedList));
  const restoredChild = resolveContextRoute(route.from);
  assert.equal(restoredChild.kind, 'child');
  assert.equal(restoredChild.from, listOrigin);
  assert.equal(resolveContextRoute(restoredChild.from).key, listOrigin);
  assert.equal(resolveContextRoute(restoredChild.from).from, undefined);
  for (const invalidInner of [
    'training/projects?q=跨模块', 'production/projects/p02/overview',
    'production/projects/p01/sections/s02', 'production/tasks/run-p01-1',
    'https://example.com/production/projects', '//example.com/production/projects',
  ]) {
    const source = `${childSource}?from=${encodeURIComponent(invalidInner)}`;
    const detail = resolveContextRoute(taskKey(task, source));
    assert.equal(detail.from, childSource);
    assert.equal(resolveContextRoute(detail.from).from, undefined);
  }
  const taskListOrigin = listKey('production', 'tasks', { q: '场景', status: 'running' });
  const projectSource = `production/projects/p01/overview?from=${encodeURIComponent(taskListOrigin)}`;
  assert.equal(resolveContextRoute(resolveContextRoute(taskKey(task, projectSource)).from).from, taskListOrigin);
});
