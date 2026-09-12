import test from 'node:test';
import assert from 'node:assert/strict';
import {
  childrenFor, filterProjects, listKey, projectKey, projects, projectTabs, resolveContextRoute,
  initialDataset, filterChildren, filterTasks, taskKey, foldersFor, folderTrail, projectFolderScope, sectionFolderScope,
  createFolder, renameFolder, moveFolder, moveResource, moveResources, reorderResources, isProjectReadOnly,
  referencesFor, imagesFor, materialsFor, referenceKey, imageKey, taskStateOptions, taskTypeOptions,
} from '../src/project-context-model.mjs';

const production = projects.find(project => project.id === 'p01');
const training = projects.find(project => project.id === 't01');
const ids = records => records.map(record => record.id);
const projectById = id => projects.find(project => project.id === id);
const sectionTab = project => project.module === 'production' ? 'sections' : 'compositions';
const completedTask = project => filterTasks(project.module, { projectId: project.id, status: 'completed' })[0];

test('catalog retains realistic project lifecycles, long names and module-wide child identities', () => {
  for (const module of ['production', 'training']) {
    const records = filterProjects(module);
    assert.equal(records.length, 18);
    assert.equal(filterProjects(module, { status: 'archived' }).length, 3);
    assert.equal(filterProjects(module, { status: 'active' }).length, 15);
    assert.ok(records.some(record => record.name.length > 24));
    assert.equal(filterProjects(module, { q: records[0].name, status: 'active' })[0].id, records[0].id);
    assert.equal(filterProjects(module, { q: '不存在的样本' }).length, 0);
    for (const collection of ['projects', 'children', 'references', 'images', 'tasks']) {
      const own = initialDataset[collection].filter(record => record.module === module);
      assert.equal(new Set(ids(own)).size, own.length, collection + ' identities must be unique within their module');
    }
    for (const project of records) {
      assert.ok(project.synthetic);
      assert.equal(childrenFor(project).length, 6);
      assert.ok(childrenFor(project).every(child => child.id.startsWith(project.id + '-')));
    }
  }
});

test('archived projects have no nonterminal tasks and keep checkpoint removal truthful', () => {
  for (const project of projects.filter(isProjectReadOnly)) {
    const tasks = filterTasks(project.module, { projectId: project.id });
    assert.ok(tasks.length);
    assert.ok(tasks.every(task => ['completed', 'failed', 'cancelled'].includes(task.state)));
    assert.ok(tasks.filter(task => task.type === 'lora-training').flatMap(task => task.checkpoints).every(checkpoint => checkpoint.state === 'removed'));
  }
  const activeLora = initialDataset.tasks.filter(task => task.type === 'lora-training' && ['pending', 'running'].includes(task.state));
  assert.equal(activeLora.length, 1);
});

test('references are independent inputs with names, purposes and actual composition relations', () => {
  const references = referencesFor(training);
  assert.equal(references.length, 3);
  assert.ok(references.some(reference => reference.description));
  assert.ok(references.some(reference => !reference.description));
  assert.ok(references.every(reference => reference.photo && !childrenFor(training).some(child => child.id === reference.id || child.name === reference.name)));
  assert.ok(references.every(reference => !imagesFor(training).some(image => image.id === reference.id)));
  assert.ok(childrenFor(training).every(child => child.inputReferenceIds.every(id => references.some(reference => reference.id === id))));
  assert.deepEqual(Object.keys(training.profile).sort(), ['characterDescription', 'imageProductionPrompt', 'triggerToken']);
  assert.ok(Object.values(training.profile).every(value => typeof value === 'string' && value));
  assert.deepEqual(referencesFor(production), []);
});

test('training materials derive candidate counts, representative and authoritative Caption from each composition', () => {
  const materials = materialsFor(training);
  assert.equal(materials.length, 6);
  for (const material of materials) {
    assert.strictEqual(material.child, childrenFor(training).find(child => child.id === material.id));
    assert.equal(material.candidateCount, material.candidates.length);
    assert.ok(material.candidates.every(image => image.childId === material.child.id && image.projectId === training.id));
    assert.equal(material.trainingCaption, material.child.trainingCaption);
    assert.equal(material.photo, material.selectedResult?.photo || null);
  }
  assert.ok(materials.some(material => material.candidateCount > 0 && !material.selectedResult && material.trainingCaption));
  assert.ok(materials.some(material => material.selectedResult && !material.trainingCaption));
  assert.ok(materials.some(material => !material.candidateCount && !material.photo));
  const original = materials[0];
  const changed = { ...initialDataset, children: initialDataset.children.map(child => child === original.child ? { ...child, selectedResultId: original.candidates[1].id } : child) };
  assert.equal(materialsFor(training, changed)[0].trainingCaption, original.trainingCaption);
  assert.equal(materialsFor(training, changed)[0].selectedResult.id, original.candidates[1].id);
  assert.deepEqual(materialsFor(production), []);
});

test('image results and source inputs retain distinct task and resource identities', () => {
  for (const image of initialDataset.images) {
    const task = initialDataset.tasks.find(task => task.id === image.taskId && task.module === image.module);
    assert.equal(task.state, 'completed');
    assert.ok(task.outputImageIds.includes(image.id));
    assert.equal(task.childId, image.childId);
    assert.equal(task.projectId, image.projectId);
    assert.ok(!task.inputImages.some(input => input.id === image.id));
  }
  for (const task of initialDataset.tasks.filter(task => task.type !== 'lora-training')) {
    assert.equal(task.sourcePhoto, task.inputImages[0]?.photo || null);
    assert.equal(task.photo, initialDataset.images.find(image => image.id === task.outputImageIds[0])?.photo || null);
    assert.equal(task.outputCount, task.outputImageIds.length);
    if (task.state !== 'completed') {
      assert.deepEqual(task.outputImageIds, []);
      assert.equal(task.photo, null);
    }
    if (task.module === 'training') {
      assert.deepEqual(task.inputImages.map(input => input.referenceId), task.inputReferenceIds);
      assert.ok(task.inputReferenceIds.every(id => initialDataset.references.some(reference => reference.id === id && reference.projectId === task.projectId)));
    }
  }
  assert.ok(initialDataset.tasks.some(task => task.type === 'image-generation' && task.sourcePhoto !== task.photo));
});

test('LoRA runs preserve input snapshots and checkpoint results in completed, failed and running states', () => {
  const runs = filterTasks('training', { projectId: training.id, type: 'lora-training' });
  for (const state of ['completed', 'failed', 'running']) {
    const run = runs.find(task => task.state === state);
    assert.ok(run.samples.length);
    assert.ok(run.checkpoints.length);
    assert.equal(run.childId, null);
    assert.equal(run.photo, null);
    assert.equal(run.outputImageIds, undefined);
    assert.equal(run.outputCount, undefined);
    for (const sample of run.samples) {
      const image = initialDataset.images.find(image => image.id === sample.imageId);
      assert.equal(image.childId, sample.childId);
      assert.equal(sample.selectedResultId, image.id);
      assert.equal(sample.photo, image.photo);
      assert.ok(sample.caption);
      assert.notEqual(sample, childrenFor(training).find(child => child.id === sample.childId));
    }
  }
  const snapshots = structuredClone(runs.map(run => run.samples));
  const changed = { ...initialDataset, children: initialDataset.children.map(child => child.module === 'training' && child.projectId === training.id ? { ...child, selectedResultId: null, trainingCaption: '修改后的当前 Caption' } : child) };
  const reordered = reorderResources(changed, { kind: 'child', module: 'training', projectId: training.id, ids: ['t01-c06'], beforeId: 't01-c01' });
  assert.deepEqual(filterTasks('training', { projectId: training.id, type: 'lora-training' }, reordered).map(run => run.samples), snapshots);
});

test('task states and filtering use each module contract and respect the actual task type', () => {
  assert.deepEqual(taskStateOptions('production').map(option => option.value), ['unsubmitted', 'submitted', 'running', 'paused', 'completed', 'failed', 'cancelled']);
  assert.deepEqual(taskStateOptions('training').map(option => option.value), ['pending', 'running', 'completed', 'failed', 'cancelled']);
  for (const module of ['production', 'training']) {
    for (const { value: status } of taskStateOptions(module)) {
      const filtered = filterTasks(module, { status });
      assert.ok(filtered.length);
      assert.ok(filtered.every(task => task.module === module && task.state === status));
    }
    for (const { value: type } of taskTypeOptions(module)) {
      const filtered = filterTasks(module, { type, status: 'completed' });
      assert.ok(filtered.length);
      assert.ok(filtered.every(task => task.type === type && task.state === 'completed'));
    }
  }
  assert.deepEqual(filterTasks('production', { type: 'lora-training' }), []);
  assert.equal(resolveContextRoute('training/tasks?status=paused&type=material-generation').filters.status, 'all');
  const key = listKey('training', 'tasks', { q: '青禾', status: 'failed', type: 'lora-training' });
  assert.deepEqual(resolveContextRoute(key).filters, { q: '青禾', status: 'failed', type: 'lora-training' });
  assert.equal(resolveContextRoute('production/tasks?status=pending').filters.status, 'all');
});

test('root, current folder and all-resource queries are distinct and copyable', () => {
  assert.equal(filterChildren(production).length, 6);
  assert.equal(filterChildren(production, { folder: 'all' }).length, 6);
  assert.equal(filterChildren(production, { folder: '' }).length, 2);
  assert.equal(filterChildren(production, { folder: 'f-p01-scenes' }).length, 2);
  assert.equal(filterProjects('production', { folder: 'all' }).length, 18);
  assert.ok(filterProjects('production', { folder: '' }).length < 18);
  for (const folder of ['', 'all', 'f-p01-scenes']) {
    const route = resolveContextRoute(projectKey(production, 'sections', '', '', { folder }));
    assert.equal(route.filters.folder, folder);
    assert.equal(resolveContextRoute(route.key).key, route.key);
  }
  assert.equal(resolveContextRoute('production/projects').filters.folder, '');
  assert.equal(resolveContextRoute('production/projects/p01/sections').filters.folder, '');
  assert.equal(resolveContextRoute('training/projects?folder=f-project-scenes').filters.folder, undefined);
});

test('list query normalization preserves punctuation and valid filters without arbitrary origins', () => {
  const key = listKey('production', 'projects', { q: '雨后 & + / 小镇', status: 'archived', folder: 'all' });
  const route = resolveContextRoute('#' + key + '&unsupported=yes&from=production%2Ftasks');
  assert.equal(route.key, key);
  assert.deepEqual(route.filters, { q: '雨后 & + / 小镇', status: 'archived', type: 'all', folder: 'all' });
  assert.equal(route.from, undefined);
  const normalized = resolveContextRoute('training/projects?q=' + '青'.repeat(100) + '&status=invalid');
  assert.equal(normalized.filters.q.length, 80);
  assert.equal(normalized.filters.status, 'all');
});

test('child detail inherits the complete collection query and returns to exactly that collection', () => {
  const list = listKey('production', 'projects', { q: '雨后', status: 'active', folder: 'all' });
  const filters = { q: '光线', status: 'active', type: 'image', folder: 'f-p01-scenes' };
  const collection = projectKey(production, 'sections', list, '', filters);
  const child = filterChildren(production, filters)[0];
  const route = resolveContextRoute(projectKey(production, 'sections', collection, child.id));
  assert.equal(route.child.id, 'p01-s03');
  assert.equal(route.from, list);
  assert.deepEqual(route.filters, filters);
  assert.equal(route.collectionKey, collection);
  assert.equal(resolveContextRoute(route.collectionKey).filters.q, '光线');
  assert.equal(resolveContextRoute(route.collectionKey).from, list);
  const folderNavigation = projectKey(production, 'sections', route.from, '', { ...route.filters, folder: '' });
  assert.equal(resolveContextRoute(folderNavigation).filters.q, '光线');
  assert.equal(resolveContextRoute(folderNavigation).filters.folder, '');
});

test('source-free production child links return to their actual parent folder', () => {
  for (const childId of ['p01-s01', 'p01-s03', 'p01-s05']) {
    const child = childrenFor(production).find(item => item.id === childId);
    const raw = 'production/projects/p01/sections/' + childId;
    const direct = resolveContextRoute(raw);
    assert.equal(direct.kind, 'child');
    assert.equal(direct.from, undefined);
    assert.equal(direct.filters.folder, child.folderId);
    const collection = resolveContextRoute(direct.collectionKey);
    assert.equal(collection.filters.folder, child.folderId);
    assert.ok(filterChildren(production, collection.filters).some(item => item.id === childId));
    assert.equal(direct.key, projectKey(production, 'sections', '', childId));
    assert.equal(resolveContextRoute(projectKey(production, 'sections', '', childId, { q: child.name })).filters.folder, child.folderId);
  }
  const queried = resolveContextRoute('production/projects/p01/sections/p01-s03?q=光线');
  assert.equal(queried.filters.folder, 'f-p01-scenes');
  assert.equal(resolveContextRoute(queried.collectionKey).filters.q, '光线');
});

test('explicit root and all scopes override a deep child location while preserving query and source', () => {
  const origin = listKey('production', 'projects', { q: '雨后', status: 'active', folder: 'all' });
  for (const folder of ['', 'all']) {
    const filters = { folder, q: '光线', status: 'active', type: 'image' };
    const key = projectKey(production, 'sections', origin, 'p01-s03', filters);
    const route = resolveContextRoute(key);
    assert.deepEqual(route.filters, filters);
    assert.equal(route.from, origin);
    const collection = resolveContextRoute(route.collectionKey);
    assert.deepEqual(collection.filters, filters);
    assert.equal(collection.from, origin);
    assert.equal(resolveContextRoute(route.key).key, route.key);
    const direct = resolveContextRoute('production/projects/p01/sections/p01-s03?folder=' + folder + '&q=光线');
    assert.equal(direct.filters.folder, folder);
    assert.equal(resolveContextRoute(direct.collectionKey).filters.q, '光线');
  }
});

test('reference and result details have independent identities and bounded collection return paths', () => {
  const examples = [
    { project: training, record: referencesFor(training)[0], kind: 'reference', tab: 'references', keyFor: referenceKey },
    { project: training, record: imagesFor(training)[0], kind: 'image', tab: 'materials', keyFor: imageKey },
    { project: production, record: imagesFor(production)[0], kind: 'image', tab: 'images', keyFor: imageKey },
  ];
  for (const { project, record, kind, tab, keyFor } of examples) {
    const origin = listKey(project.module, 'projects', { q: project.name, status: 'active', folder: 'all' });
    const collection = projectKey(project, tab, origin, '', { q: '正面 & 候选' });
    const route = resolveContextRoute(keyFor(record, collection));
    assert.equal(route.kind, kind);
    assert.equal(route[kind].id, record.id);
    assert.equal(route.from, collection);
    assert.equal(resolveContextRoute(route.from).from, origin);
    assert.equal(resolveContextRoute(route.from).filters.q, '正面 & 候选');
    assert.equal(resolveContextRoute(route.key).key, route.key);
    const copied = resolveContextRoute(keyFor(record));
    assert.equal(copied.kind, kind);
    assert.equal(copied[kind].id, record.id);
    assert.equal(resolveContextRoute(copied.from).tab, tab);
    for (const invalid of ['https://example.com/' + collection, 'production/projects/p02/images', 'training/projects/t02/references', record.module + '/tasks/unknown']) {
      assert.equal(resolveContextRoute(keyFor(record, invalid)).from, projectKey(project, tab));
    }
  }
  assert.equal(resolveContextRoute('training/projects/t01/references/ref-t01-1').child, undefined);
  assert.equal(resolveContextRoute('production/projects/p01/images/' + imagesFor(production)[0].id).image.taskId, completedTask(production).id);
});

test('candidate details can return to their actual composition while retaining collection filters', () => {
  const image = imagesFor(training)[0];
  const list = listKey('training', 'projects', { q: '青禾', status: 'active' });
  const childSource = projectKey(training, 'compositions', list, image.childId, { q: '正面', type: 'composition' });
  const route = resolveContextRoute(imageKey(image, childSource));
  assert.equal(route.from, childSource);
  assert.equal(resolveContextRoute(route.from).filters.q, '正面');
  assert.equal(resolveContextRoute(route.from).from, list);
});

test('missing media recovers to its own collection with query and project-list source intact', () => {
  for (const [project, tab, segment] of [[training, 'references', 'references'], [training, 'materials', 'images'], [production, 'images', 'images']]) {
    const list = listKey(project.module, 'projects', { q: project.name });
    const collection = projectKey(project, tab, list, '', { q: '保留查询' });
    const route = resolveContextRoute(project.module + '/projects/' + project.id + '/' + segment + '/missing?from=' + encodeURIComponent(collection));
    assert.equal(route.kind, 'project');
    assert.equal(route.key, collection);
    assert.match(route.notice, /不存在/);
  }
});

test('task details restore only their real bounded task, project or child source', () => {
  for (const project of [production, training]) {
    const task = completedTask(project), tab = sectionTab(project);
    const origin = listKey(project.module, 'projects', { q: project.name, status: 'active', folder: 'all' });
    const sources = [
      listKey(project.module, 'tasks', { q: project.name, status: 'completed', type: task.type }),
      projectKey(project, 'overview', origin),
      projectKey(project, 'tasks', origin, '', { q: task.name, status: 'completed', type: task.type }),
      projectKey(project, tab, origin, task.childId, { q: '场景', folder: 'all' }),
      projectKey(project, tab, origin, '', { q: '场景', folder: 'all' }),
      projectKey(project, project.module === 'production' ? 'images' : 'materials', origin, '', { q: '候选' }),
    ];
    for (const source of sources) {
      const route = resolveContextRoute(taskKey(task, source));
      assert.equal(route.kind, 'task');
      assert.equal(route.from, source);
      assert.equal(resolveContextRoute(route.from).key, source);
    }
    for (const invalid of [
      'https://example.com/' + sources[0], '//example.com/' + sources[0],
      project.module + '/projects', project.module + '/tasks/' + task.id,
      project.module + '/projects/' + (project.module === 'production' ? 'p02' : 't02') + '/tasks',
      project.module + '/projects/' + project.id + '/' + tab + '/missing',
      project.module + '/projects/' + project.id + '/' + tab + '/' + task.childId + '/extra',
    ]) assert.equal(resolveContextRoute(taskKey(task, invalid)).from, undefined);
  }
  assert.equal(resolveContextRoute(taskKey(completedTask(training), 'production/tasks')).from, undefined);
});

test('task and media source normalization retain only one nested list origin', () => {
  const origin = listKey('production', 'projects', { q: '雨后', status: 'active', folder: 'all' });
  const nestedList = origin + '&from=' + encodeURIComponent('production/projects/p02/overview');
  const childSource = 'production/projects/p01/sections/p01-s01?folder=all&from=' + encodeURIComponent(nestedList);
  const taskRoute = resolveContextRoute(taskKey(completedTask(production), childSource));
  const restored = resolveContextRoute(taskRoute.from);
  assert.equal(restored.from, origin);
  assert.equal(resolveContextRoute(restored.from).from, undefined);
  const collection = 'production/projects/p01/images?from=' + encodeURIComponent(nestedList);
  assert.equal(resolveContextRoute(resolveContextRoute(imageKey(imagesFor(production)[0], collection)).from).from, origin);
  for (const invalidInner of ['training/projects', 'production/projects/p02/overview', 'production/tasks/missing']) {
    const source = 'production/projects/p01/overview?from=' + encodeURIComponent(invalidInner);
    assert.equal(resolveContextRoute(resolveContextRoute(taskKey(completedTask(production), source)).from).from, undefined);
  }
});

test('missing projects, children and tasks fall back to the nearest valid filtered collection', () => {
  const source = listKey('production', 'projects', { q: '雨后', status: 'archived', folder: 'all' });
  const missingProject = resolveContextRoute('production/projects/missing/overview?from=' + encodeURIComponent(source));
  assert.equal(missingProject.key, source);
  assert.match(missingProject.notice, /项目不存在/);
  const collection = projectKey(production, 'sections', source, '', { q: '光线', type: 'image', folder: 'f-p01-scenes' });
  const missingChild = resolveContextRoute(collection.replace('/sections?', '/sections/missing?'));
  assert.equal(missingChild.key, collection);
  assert.match(missingChild.notice, /小节不存在/);
  const taskSource = projectKey(production, 'tasks', source, '', { type: 'image-generation', status: 'completed' });
  const missingTask = resolveContextRoute('production/tasks/missing?from=' + encodeURIComponent(taskSource));
  assert.equal(missingTask.key, taskSource);
  assert.equal(resolveContextRoute('production/projects/p01/sections/s01').kind, 'project');
});

test('missing folders recover only inside their own scope without losing other query filters', () => {
  const removed = { ...initialDataset, folders: initialDataset.folders.filter(folder => !['f-project-city', 'f-p01-details'].includes(folder.id)) };
  const list = resolveContextRoute('production/projects?folder=f-project-city&q=薄暮&status=active', removed);
  assert.equal(list.filters.folder, 'f-project-scenes');
  assert.equal(list.filters.q, '薄暮');
  assert.equal(list.filters.status, 'active');
  assert.match(list.notice, /上级文件夹/);
  const sections = resolveContextRoute('production/projects/p01/sections?folder=f-p01-details&q=窗边&type=image', removed);
  assert.equal(sections.filters.folder, 'f-p01-scenes');
  assert.equal(sections.filters.q, '窗边');
  assert.equal(sections.filters.type, 'image');
  const invalid = resolveContextRoute('production/projects/p01/sections?folder=f-p02-scenes', removed);
  assert.equal(invalid.filters.folder, '');
  assert.equal(invalid.key, projectKey(production, 'sections'));
});

test('all valid module tabs remain available and malformed routes normalize once', () => {
  for (const project of [production, training]) {
    for (const { id } of projectTabs[project.module]) {
      const route = resolveContextRoute(projectKey(project, id));
      assert.equal(route.tab, id);
      assert.equal(route.kind, 'project');
      assert.equal(route.notice, undefined);
    }
  }
  for (const raw of [
    '#/production/projects/p01/', 'production/projects/p01/sections/p01-s01/extra',
    'training/projects/t01/profile/unknown', 'training/projects/t01/compositions/t01-c01?from=%E0%A4%A',
    'https://example.com/production/projects', 'global/unknown', 'production/projects?q=%E0%A4%A',
    'training/projects/t01/images/missing/extra', 'production/projects/p01/compositions',
  ]) {
    const first = resolveContextRoute(raw), second = resolveContextRoute(first.key);
    assert.equal(second.key, first.key);
    assert.equal(second.notice, undefined);
  }
  assert.equal(resolveContextRoute('unknown/projects').key, 'production/tasks');
  assert.equal(resolveContextRoute('training/unknown/child').key, 'training/tasks');
  for (const section of ['models', 'monitoring', 'settings']) assert.equal(resolveContextRoute('global/' + section).kind, 'global');
  for (const module of ['production', 'training']) for (const section of ['presets', 'templates']) assert.equal(resolveContextRoute(module + '/' + section).kind, 'stub');
});

test('folder mutations stay immutable, scoped, acyclic and append after destination siblings', () => {
  const scope = sectionFolderScope(production);
  const created = createFolder(initialDataset, { scope, name: ' 新镜头 ', id: 'local-new' });
  assert.equal(created.folders.at(-1).name, '新镜头');
  assert.ok(!initialDataset.folders.some(folder => folder.id === 'local-new'));
  const renamed = renameFolder(created, { id: 'local-new', name: '补充镜头' });
  assert.equal(created.folders.at(-1).name, '新镜头');
  const moved = moveFolder(renamed, { id: 'local-new', parentId: 'f-p01-scenes' });
  assert.equal(foldersFor(scope, 'f-p01-scenes', moved).at(-1).id, 'local-new');
  assert.equal(renamed.folders.at(-1).parentId, '');
  for (const operation of [
    () => createFolder(initialDataset, { scope: 'training/projects', name: '错误' }),
    () => createFolder(initialDataset, { scope, parentId: 'f-project-scenes', name: '错误' }),
    () => createFolder(initialDataset, { scope, name: '   ' }),
    () => renameFolder(initialDataset, { id: 'f-project-scenes', name: '人物研究' }),
    () => moveFolder(initialDataset, { id: 'f-project-scenes', parentId: 'f-project-scenes' }),
    () => moveFolder(initialDataset, { id: 'f-project-scenes', parentId: 'f-project-city' }),
    () => moveFolder(moved, { id: 'local-new', parentId: 'f-p02-scenes' }),
  ]) assert.throws(operation);
  assert.deepEqual(folderTrail(projectFolderScope('production'), 'f-project-city').map(folder => folder.name), ['场景创作', '城市日常']);
});

test('every current archive mutation entry rejects before changing any records', () => {
  const before = JSON.stringify(initialDataset);
  const archived = projectById('p10');
  for (const operation of [
    () => moveResource(initialDataset, { kind: 'project', id: archived.id, module: 'production', folderId: 'f-project-city' }),
    () => moveResources(initialDataset, { kind: 'project', ids: ['p01', archived.id], module: 'production', folderId: 'f-project-city' }),
    () => moveResource(initialDataset, { kind: 'child', id: 'p10-s01', projectId: 'p10', module: 'production', folderId: 'f-p10-scenes' }),
    () => createFolder(initialDataset, { scope: sectionFolderScope(archived), name: '不可写' }),
    () => renameFolder(initialDataset, { id: 'f-p10-scenes', name: '不可写' }),
    () => moveFolder(initialDataset, { id: 'f-p10-details', parentId: '' }),
    () => reorderResources(initialDataset, { kind: 'folder', module: 'production', projectId: 'p10', ids: ['f-p10-scenes'] }),
    () => reorderResources(initialDataset, { kind: 'child', module: 'production', projectId: 'p10', ids: ['p10-s01'] }),
    () => reorderResources(initialDataset, { kind: 'child', module: 'training', projectId: 't10', ids: ['t10-c01'] }),
    () => reorderResources(initialDataset, { kind: 'project', module: 'training', ids: ['t01', 't10'] }),
  ]) assert.throws(operation, /归档.*只读/);
  assert.equal(JSON.stringify(initialDataset), before);
});

test('batch moves preflight every resource, preserve identities and append to the destination', () => {
  const before = JSON.stringify(initialDataset);
  const options = { kind: 'child', module: 'production', projectId: production.id, folderId: 'f-p01-scenes' };
  for (const invalid of [
    { ...options, ids: ['p01-s01', 'p02-s01'] },
    { ...options, ids: ['p01-s01', 'missing'] },
    { ...options, ids: ['p01-s01', 'p01-s01'] },
    { ...options, ids: ['p01-s01'], folderId: 'f-p02-scenes' },
    { ...options, ids: ['p01-s01'], folderId: 'all' },
    { kind: 'project', module: 'production', ids: ['p01', 't01'], folderId: '' },
  ]) assert.throws(() => moveResources(initialDataset, invalid));
  assert.equal(JSON.stringify(initialDataset), before);
  const moved = moveResources(initialDataset, { ...options, ids: ['p01-s01', 'p01-s02'] });
  assert.deepEqual(ids(filterChildren(production, { folder: 'f-p01-scenes' }, moved)), ['p01-s03', 'p01-s04', 'p01-s01', 'p01-s02']);
  assert.strictEqual(moved.tasks, initialDataset.tasks);
  assert.strictEqual(moved.images, initialDataset.images);
  assert.strictEqual(moved.children.find(child => child.id === 'p02-s01'), initialDataset.children.find(child => child.id === 'p02-s01'));
  assert.equal(resolveContextRoute('production/projects/p01/sections/p01-s01', moved).child.folderId, 'f-p01-scenes');
  const movedProjects = moveResources(initialDataset, { kind: 'project', module: 'production', ids: ['p01', 'p04'], folderId: 'f-project-city' });
  assert.deepEqual(ids(filterProjects('production', { folder: 'f-project-city' }, movedProjects)).slice(-2), ['p01', 'p04']);
  assert.ok(movedProjects.projects.filter(project => project.module === 'production').every(project => !Object.hasOwn(project, 'sortOrder')));
});

test('child reorder only changes ordering within the current collection', () => {
  const moved = reorderResources(initialDataset, { kind: 'child', module: 'production', projectId: 'p01', folderId: '', ids: ['p01-s02'], beforeId: 'p01-s01' });
  assert.deepEqual(ids(filterChildren(production, { folder: '' }, moved)), ['p01-s02', 'p01-s01']);
  assert.strictEqual(moved.children.find(child => child.id === 'p01-s03'), initialDataset.children.find(child => child.id === 'p01-s03'));
  assert.strictEqual(moved.tasks, initialDataset.tasks);
  const trainingMoved = reorderResources(initialDataset, { kind: 'child', module: 'training', projectId: 't01', ids: ['t01-c06', 't01-c05'], beforeId: 't01-c01' });
  assert.deepEqual(ids(childrenFor(training, trainingMoved)).slice(0, 3), ['t01-c06', 't01-c05', 't01-c01']);
  for (const change of [
    { folderId: 'all', ids: ['p01-s01'] }, { folderId: '', ids: ['p01-s03'] },
    { folderId: '', ids: ['p02-s01'] }, { folderId: '', ids: ['p01-s01'], beforeId: 'p01-s03' },
    { folderId: '', ids: ['p01-s01'], beforeId: 'p01-s01' },
  ]) assert.throws(() => reorderResources(initialDataset, { kind: 'child', module: 'production', projectId: 'p01', ...change }));
});

test('image collections and image details return through their owning task without losing the list origin', () => {
  for (const project of [production, training]) {
    const image = imagesFor(project)[0], task = completedTask(project);
    const list = listKey(project.module, 'projects', { q: project.name, status: 'active', folder: 'all' });
    const collection = projectKey(project, project.module === 'production' ? 'images' : 'materials', list, '', { q: '候选 & 保留' });
    const imageRoute = resolveContextRoute(imageKey(image, collection));
    // ResourceDetail currently passes the image's collection return key.
    const throughCollection = resolveContextRoute(taskKey(task, imageRoute.from));
    assert.equal(throughCollection.from, collection);
    assert.equal(resolveContextRoute(throughCollection.from).from, list);
    // A direct detail source also remains a valid, copyable return target.
    const throughDetail = resolveContextRoute(taskKey(task, imageRoute.key));
    assert.equal(throughDetail.from, imageRoute.key);
    assert.equal(resolveContextRoute(throughDetail.from).from, collection);
    assert.equal(resolveContextRoute(throughDetail.key).key, throughDetail.key);
    const unrelatedImage = imagesFor(project).find(item => item.taskId !== task.id);
    assert.equal(resolveContextRoute(taskKey(task, imageKey(unrelatedImage, collection))).from, undefined);
    const noOutputs = filterTasks(project.module, { projectId: project.id, status: 'failed' })[0];
    assert.equal(resolveContextRoute(taskKey(noOutputs, collection)).from, undefined);
  }
});

test('task outputs return from image detail to the exact task and its original source', () => {
  for (const project of [production, training]) {
    const task = completedTask(project), image = imagesFor(project).find(item => item.taskId === task.id);
    const list = listKey(project.module, 'projects', { q: project.name, status: 'active', folder: 'all' });
    const sources = [
      listKey(project.module, 'tasks', { q: project.name, type: task.type, status: 'completed' }),
      projectKey(project, 'tasks', list, '', { q: '场景', type: task.type, status: 'completed' }),
      projectKey(project, sectionTab(project), list, task.childId, { q: '场景', folder: 'all' }),
    ];
    for (const source of sources) {
      const taskRoute = resolveContextRoute(taskKey(task, source));
      const imageRoute = resolveContextRoute(imageKey(image, taskRoute.key));
      assert.equal(imageRoute.from, taskRoute.key);
      assert.equal(resolveContextRoute(imageRoute.from).from, source);
      assert.equal(resolveContextRoute(imageRoute.key).key, imageRoute.key);
      // The existing image-to-task link may pass the current task itself.
      assert.equal(resolveContextRoute(taskKey(task, imageRoute.from)).from, source);
    }
    const unrelatedTask = filterTasks(project.module, { projectId: project.id, status: 'completed' }).find(item => item.id !== task.id);
    assert.equal(resolveContextRoute(imageKey(image, taskKey(unrelatedTask))).from, projectKey(project, project.module === 'production' ? 'images' : 'materials'));
    const crossedProject = projectById(project.module === 'production' ? 'p02' : 't02');
    assert.equal(resolveContextRoute(imageKey(image, taskKey(completedTask(crossedProject)))).from, projectKey(project, project.module === 'production' ? 'images' : 'materials'));
    const brokenRelation = { ...initialDataset, tasks: initialDataset.tasks.map(item => item === task ? { ...item, outputImageIds: [] } : item) };
    assert.equal(resolveContextRoute(imageKey(image, taskKey(task), brokenRelation), brokenRelation).from, projectKey(project, project.module === 'production' ? 'images' : 'materials'));
  }
});

test('reference details can return only to a composition that uses the reference', () => {
  const reference = referencesFor(training)[0], child = childrenFor(training)[0];
  const list = listKey('training', 'projects', { q: '青禾', status: 'active' });
  const childRoute = projectKey(training, 'compositions', list, child.id, { q: '正面', type: 'composition' });
  const referenceRoute = resolveContextRoute(referenceKey(reference, childRoute));
  assert.equal(referenceRoute.from, childRoute);
  assert.equal(resolveContextRoute(referenceRoute.from).from, list);
  assert.equal(resolveContextRoute(referenceRoute.from).filters.q, '正面');
  const removedInput = { ...initialDataset, children: initialDataset.children.map(item => item === child ? { ...item, inputReferenceIds: [] } : item) };
  assert.equal(resolveContextRoute(referenceKey(reference, childRoute, removedInput), removedInput).from, projectKey(training, 'references'));
  const foreignChild = projectKey(projectById('t02'), 'compositions', '', 't02-c01');
  assert.equal(resolveContextRoute(referenceKey(reference, foreignChild)).from, projectKey(training, 'references'));
});

test('repeated task and output-image visits keep a bounded detail source and the original collection', () => {
  const task = completedTask(production), image = imagesFor(production)[0];
  const list = listKey('production', 'projects', { q: '雨后 & 街角', status: 'active', folder: 'all' });
  const collection = projectKey(production, 'images', list, '', { q: '候选' });
  let taskRoute = resolveContextRoute(taskKey(task, collection));
  const lengths = [];
  for (let index = 0; index < 12; index += 1) {
    const imageRoute = resolveContextRoute(imageKey(image, taskRoute.key));
    taskRoute = resolveContextRoute(taskKey(task, imageRoute.key));
    assert.equal(resolveContextRoute(taskRoute.key).key, taskRoute.key);
    const previousImage = resolveContextRoute(taskRoute.from);
    assert.equal(previousImage.kind, 'image');
    assert.equal(previousImage.from, collection);
    assert.equal(resolveContextRoute(previousImage.from).from, list);
    lengths.push(taskRoute.key.length);
  }
  assert.equal(new Set(lengths).size, 1);
});

test('folder and active training-project ordering exclude unrelated or archived scopes', () => {
  const folderOrder = reorderResources(initialDataset, { kind: 'folder', module: 'production', ids: ['f-project-portraits'], beforeId: 'f-project-scenes' });
  assert.deepEqual(ids(foldersFor('production/projects', '', folderOrder)), ['f-project-portraits', 'f-project-scenes']);
  assert.strictEqual(folderOrder.folders.find(folder => folder.id === 'f-p01-scenes'), initialDataset.folders.find(folder => folder.id === 'f-p01-scenes'));
  const created = createFolder(initialDataset, { scope: sectionFolderScope(production), id: 'p01-extra', name: '补充' });
  const sectionFolders = reorderResources(created, { kind: 'folder', module: 'production', projectId: 'p01', ids: ['p01-extra'], beforeId: 'f-p01-scenes' });
  assert.deepEqual(ids(foldersFor(sectionFolderScope(production), '', sectionFolders)), ['p01-extra', 'f-p01-scenes']);
  const trainingOrder = reorderResources(initialDataset, { kind: 'project', module: 'training', ids: ['t03', 't02'], beforeId: 't01' });
  assert.deepEqual(ids(filterProjects('training', { status: 'active' }, trainingOrder)).slice(0, 3), ['t03', 't02', 't01']);
  for (const project of projects.filter(isProjectReadOnly)) assert.strictEqual(trainingOrder.projects.find(item => item.id === project.id), project);
  assert.throws(() => reorderResources(initialDataset, { kind: 'project', module: 'production', ids: ['p01'] }), /不支持/);
  assert.throws(() => reorderResources(initialDataset, { kind: 'folder', module: 'production', projectId: 'p01', ids: ['f-p02-scenes'] }), /当前范围/);
  assert.throws(() => reorderResources(initialDataset, { kind: 'project', module: 'training', ids: ['t01'], beforeId: 't10' }), /当前范围/);
});
