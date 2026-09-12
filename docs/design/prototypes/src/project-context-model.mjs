// R02-02 uses local fragment routes and explicitly synthetic records only.
export const projectTabs = {
  production: [{ id: 'overview', label: '概览' }, { id: 'sections', label: '小节' }, { id: 'images', label: '图片' }, { id: 'tasks', label: '任务' }],
  training: [{ id: 'overview', label: '概览' }, { id: 'profile', label: '角色档案' }, { id: 'references', label: '参考图' }, { id: 'compositions', label: '构图' }, { id: 'materials', label: '训练素材' }, { id: 'tasks', label: '任务' }],
};
const moduleLabels = { production: '生产', training: '训练' };
const sectionLabels = { projects: '项目', tasks: '任务', presets: '预制', templates: '模板' };
const globalLabels = { models: '模型', monitoring: '监控与日志', settings: '设置' };
const taskStates = {
  production: [['unsubmitted', '未提交'], ['submitted', '已提交'], ['running', '运行中'], ['paused', '已暂停'], ['completed', '已完成'], ['failed', '失败'], ['cancelled', '已取消']],
  training: [['pending', '等待中'], ['running', '运行中'], ['completed', '已完成'], ['failed', '失败'], ['cancelled', '已取消']],
};
const taskTypes = { production: [['image-generation', '图片生成']], training: [['material-generation', '素材生成'], ['lora-training', 'LoRA 训练']] };
export const taskStateOptions = module => (taskStates[module] || []).map(([value, label]) => ({ value, label }));
export const taskTypeOptions = module => (taskTypes[module] || []).map(([value, label]) => ({ value, label }));
export const isProjectReadOnly = project => project?.state === 'archived';
export const projectFolderScope = module => module === 'production' ? 'production/projects' : '';
export const sectionFolderScope = project => project?.module === 'production' ? 'production/' + project.id + '/sections' : '';
const photoFor = index => '/media/context/scene-' + (index % 6 + 1) + '.jpg';
const childTabFor = module => module === 'production' ? 'sections' : 'compositions';
const ordered = records => [...records].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
const belongsTo = (record, project) => record.projectId === project?.id && record.module === project?.module;
const projectNames = {
  production: ['雨后街角', '薄暮书店', '海岸旅人', '春日窗边', '城市夜行', '山间来信', '旧物与日常', '林下光影', '周末咖啡馆', '清晨候车室', '远山与湖泊', '暖色厨房', '夏日庭院', '雪中的街道', '午后散步', '人物半身像', '关于海边小镇雨后黄昏与人物服饰细节的连续画面设计研究', '冬日室内光线'],
  training: ['青禾', '洛川', '日常服饰', '水彩肖像', '短发角色', '旅行装束', '侧脸与逆光', '长发角色', '运动服细节', '室内自然光', '配饰与手部', '柔和线条', '冬季外套', '表情练习', '全身比例', '自然姿态', '青禾角色在不同光照与复杂服饰条件下的一致性训练样本集', '色彩与质感'],
};
export const projects = Object.entries(projectNames).flatMap(([module, names]) => names.map((name, index) => ({
  id: (module === 'production' ? 'p' : 't') + String(index + 1).padStart(2, '0'), module, name, synthetic: true,
  state: (index + 1) % 5 === 0 ? 'archived' : 'active',
  folderId: module === 'production' && index % 3 === 1 ? (index % 2 ? 'f-project-city' : 'f-project-scenes') : module === 'production' && index % 3 === 2 ? 'f-project-portraits' : '',
  photo: photoFor(index), summary: module === 'production' ? '6 个图片小节' : '6 个构图',
  ...(module === 'training' ? { sortOrder: index, profile: {
    triggerToken: 'sample_' + String(index + 1).padStart(2, '0'),
    characterDescription: name + '的虚构角色设定：短发、灰绿色外套，神情自然。',
    imageProductionPrompt: 'sample_' + String(index + 1).padStart(2, '0') + ', short hair, grey green jacket, natural expression',
  } } : {}),
})));
const references = projects.filter(project => project.module === 'training').flatMap((project, projectIndex) =>
  ['角色正面参考', '服饰与配色参考', '侧面轮廓参考'].map((name, index) => ({
    id: 'ref-' + project.id + '-' + (index + 1), projectId: project.id, module: 'training', name,
    description: ['用于保持面部与发型一致。', '用于比对外套层次与灰绿色配色。', ''][index],
    photo: photoFor(projectIndex + index), sortOrder: index, synthetic: true,
  })));
const children = projects.flatMap(project => {
  const names = project.module === 'production' ? ['场景与氛围', '人物与服饰', '光线与细节', '街角远景', '窗边近景', '雨后倒影'] : ['正面半身', '侧面全身', '近景表情', '逆光侧脸', '坐姿与手部', '室外自然光'];
  return names.map((name, index) => ({
    id: project.id + '-' + (project.module === 'production' ? 's' : 'c') + String(index + 1).padStart(2, '0'),
    projectId: project.id, module: project.module, name, synthetic: true,
    folderId: project.module === 'production' && index > 1 ? 'f-' + project.id + '-' + (index > 3 ? 'details' : 'scenes') : '',
    sortOrder: index, photo: null, type: project.module === 'production' ? 'image' : 'composition',
    ...(project.module === 'training' ? {
      selectedResultId: null,
      trainingCaption: index === 3 || index === 4 ? '' : project.profile.triggerToken + ', ' + ['front view, half body', 'side view, full body', 'close-up, gentle smile', '', '', 'outdoors, natural light'][index],
      inputReferenceIds: references.filter(reference => belongsTo(reference, project)).map(reference => reference.id),
    } : {}),
  }));
});
const images = [];
const tasks = [];
for (const [projectIndex, project] of projects.entries()) {
  const ownChildren = children.filter(child => belongsTo(child, project));
  function addImageTask(child, state, suffix, count = 0) {
    const id = (project.module === 'production' ? 'run-' : 'train-') + project.id + '-' + suffix;
    const inputReferenceIds = child.inputReferenceIds ? [...child.inputReferenceIds] : [];
    const inputImages = project.module === 'training' ? inputReferenceIds.map(referenceId => {
      const reference = references.find(item => item.id === referenceId);
      return { id: reference.id, referenceId, name: reference.name, photo: reference.photo };
    }) : [{ id: 'input-' + id, name: '上传的场景输入图', photo: photoFor(projectIndex + 4) }];
    const outputImageIds = [];
    for (let index = 0; index < count; index += 1) {
      const image = {
        id: 'img-' + project.id + '-' + suffix + '-' + (index + 1), projectId: project.id, module: project.module,
        childId: child.id, taskId: id, name: child.name + ' · 候选 ' + (index + 1),
        photo: photoFor(projectIndex + ownChildren.indexOf(child) + index), sortOrder: index,
        ...(project.module === 'production' ? { reviewStatus: index === 0 ? 'kept' : 'pending' } : {}), synthetic: true,
      };
      images.push(image); outputImageIds.push(image.id);
    }
    const task = {
      id, module: project.module, projectId: project.id, childId: child.id,
      type: project.module === 'production' ? 'image-generation' : 'material-generation',
      state, name: child.name + (state === 'completed' ? ' · 第 1 次生成' : ' · 生成任务'), synthetic: true,
      inputReferenceIds, inputImages, sourcePhoto: inputImages[0]?.photo || null, outputImageIds,
      photo: images.find(image => image.id === outputImageIds[0])?.photo || null, outputCount: outputImageIds.length,
      ...(state === 'unsubmitted' ? { waitingReason: '等待生成环境可用' } : {}),
      ...(state === 'pending' ? { waitingReason: '等待素材生成任务开始' } : {}),
      ...(state === 'failed' ? { error: '生成过程意外中断（模拟样本）' } : {}),
    };
    tasks.push(task); return task;
  }
  ownChildren.forEach((child, index) => {
    const count = project.module === 'production' ? (index === 5 ? 0 : 2) : [3, 2, 2, 1, 0, 2][index];
    if (count) {
      const task = addImageTask(child, 'completed', 'result-' + (index + 1), count);
      if (project.module === 'training') {
        child.selectedResultId = index === 2 ? null : task.outputImageIds[index === 1 || index === 5 ? 1 : 0];
        child.photo = images.find(image => image.id === child.selectedResultId)?.photo || null;
      } else child.photo = task.photo;
    }
  });
  const extraStates = project.module === 'production' ? ['unsubmitted', 'submitted', 'running', 'paused', 'failed', 'cancelled'] : ['pending', 'running', 'failed', 'cancelled'];
  for (const state of extraStates) {
    if (isProjectReadOnly(project) && !['failed', 'cancelled'].includes(state)) continue;
    addImageTask(ownChildren[4], state, state);
  }
  if (project.module === 'training') {
    for (const state of ['completed', 'failed', 'cancelled', ...(project.id === 't01' ? ['running'] : [])]) {
      const id = 'lora-' + project.id + '-' + state;
      const samples = ownChildren.filter(child => child.selectedResultId && child.trainingCaption).map((child, index) => {
        const image = images.find(item => item.id === child.selectedResultId);
        return { id: 'sample-' + id + '-' + (index + 1), childId: child.id, imageId: image.id, selectedResultId: image.id, photo: image.photo, caption: child.trainingCaption, sortOrder: index };
      });
      const checkpoints = (state === 'completed' ? [500, 1000] : state === 'failed' || state === 'running' ? [500] : []).map(step => ({
        id: 'checkpoint-' + id + '-' + step, name: project.id + '-' + state + '-' + step + '.safetensors',
        step, state: isProjectReadOnly(project) ? 'removed' : 'available', synthetic: true,
      }));
      tasks.push({
        id, module: 'training', projectId: project.id, childId: null, type: 'lora-training', state,
        name: project.name + ' · LoRA 训练 · ' + taskStateOptions('training').find(option => option.value === state).label,
        samples, checkpoints, sourcePhoto: samples[0]?.photo || null, photo: null, synthetic: true,
        progress: state === 'completed' ? 100 : state === 'running' ? 62 : state === 'failed' ? 53 : 0,
        ...(state === 'failed' ? { error: '训练进程意外中断，已保留输入快照和中间 checkpoint（模拟样本）' } : {}),
      });
    }
  }
}
const folders = [
  { id: 'f-project-scenes', scope: 'production/projects', parentId: '', name: '场景创作', module: 'production', sortOrder: 0 },
  { id: 'f-project-city', scope: 'production/projects', parentId: 'f-project-scenes', name: '城市日常', module: 'production', sortOrder: 0 },
  { id: 'f-project-portraits', scope: 'production/projects', parentId: '', name: '人物研究', module: 'production', sortOrder: 1 },
  ...projects.filter(project => project.module === 'production').flatMap(project => [
    { id: 'f-' + project.id + '-scenes', scope: sectionFolderScope(project), parentId: '', name: '场景镜头', module: 'production', sortOrder: 0 },
    { id: 'f-' + project.id + '-details', scope: sectionFolderScope(project), parentId: 'f-' + project.id + '-scenes', name: '细节补充', module: 'production', sortOrder: 0 },
  ]),
];
export const initialDataset = { projects, children, tasks, folders, references, images };

export function childrenFor(project, dataset = initialDataset) { return ordered(dataset.children.filter(child => belongsTo(child, project))); }
export function referencesFor(project, dataset = initialDataset) { return ordered(dataset.references.filter(reference => belongsTo(reference, project))); }
export function imagesFor(project, dataset = initialDataset) { return dataset.images.filter(image => belongsTo(image, project)); }
export function materialsFor(project, dataset = initialDataset) {
  if (project?.module !== 'training') return [];
  return childrenFor(project, dataset).map(child => {
    const candidates = imagesFor(project, dataset).filter(image => image.childId === child.id);
    const selectedResult = candidates.find(image => image.id === child.selectedResultId) || null;
    return {
      id: child.id, projectId: project.id, module: project.module, name: child.name, child, candidates,
      candidateCount: candidates.length, selectedResult, selectedResultId: child.selectedResultId,
      photo: selectedResult?.photo || null, trainingCaption: child.trainingCaption, inputReferenceIds: [...child.inputReferenceIds],
    };
  });
}
function inFolder(record, filters) { return !Object.hasOwn(filters, 'folder') || filters.folder === 'all' || record.folderId === filters.folder; }
export function filterChildren(project, filters = {}, dataset = initialDataset) {
  const needle = String(filters.q || '').trim().toLocaleLowerCase();
  return childrenFor(project, dataset).filter(child => inFolder(child, filters)
    && (!filters.type || filters.type === 'all' || child.type === filters.type) && (!needle || child.name.toLocaleLowerCase().includes(needle)));
}
export function foldersFor(scope, parentId = '', dataset = initialDataset) { return ordered(dataset.folders.filter(folder => folder.scope === scope && folder.parentId === parentId)); }
export function folderTrail(scope, folderId, dataset = initialDataset) {
  const result = [], seen = new Set();
  let current = folderId;
  while (current && !seen.has(current)) {
    seen.add(current);
    const folder = dataset.folders.find(item => item.id === current && item.scope === scope);
    if (!folder) break;
    result.unshift(folder); current = folder.parentId;
  }
  return result;
}
function resolveFolder(scope, requested, dataset) {
  if (!scope) return {};
  if (requested === 'all' || !requested) return { folder: requested === 'all' ? 'all' : '' };
  const seen = new Set();
  let current = requested;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (dataset.folders.some(folder => folder.id === current && folder.scope === scope)) return { folder: current, ...(current !== requested ? { notice: '文件夹不存在，已返回最近的上级文件夹。' } : {}) };
    current = initialDataset.folders.find(folder => folder.id === current && folder.scope === scope)?.parentId || '';
  }
  return { folder: '', notice: '文件夹不存在，已返回当前范围的根目录。' };
}
function assertWritable(project) {
  if (!project) throw new Error('项目不存在。');
  if (isProjectReadOnly(project)) throw new Error('归档项目永久只读，不能修改。');
}
function assertScope(dataset, scope) {
  if (scope === 'production/projects') return;
  const project = dataset.projects.find(item => scope && sectionFolderScope(item) === scope);
  if (!project) throw new Error('此范围不支持文件夹。');
  assertWritable(project);
}
function assertTarget(dataset, scope, parentId) {
  assertScope(dataset, scope);
  if (typeof parentId !== 'string' || parentId === 'all' || (parentId && !dataset.folders.some(folder => folder.id === parentId && folder.scope === scope))) throw new Error('目标文件夹不属于当前范围。');
}
function folderName(value) {
  const name = typeof value === 'string' ? value.trim().slice(0, 80) : '';
  if (!name) throw new Error('请输入文件夹名称。');
  if (/[\\/]/.test(name)) throw new Error('文件夹名称不能包含路径分隔符。');
  return name;
}
function assertUniqueName(dataset, scope, parentId, name, excludedId = '') {
  if (dataset.folders.some(folder => folder.scope === scope && folder.parentId === parentId && folder.id !== excludedId && folder.name === name)) throw new Error('此位置已有同名文件夹。');
}
const nextOrder = records => Math.max(-1, ...records.map(record => record.sortOrder ?? 0)) + 1;
export function createFolder(dataset, { scope, parentId = '', name, id }) {
  assertTarget(dataset, scope, parentId);
  const cleanName = folderName(name);
  assertUniqueName(dataset, scope, parentId, cleanName);
  let nextId = id;
  if (!nextId) {
    let index = 1;
    while (dataset.folders.some(folder => folder.id === 'folder-local-' + index)) index += 1;
    nextId = 'folder-local-' + index;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(nextId) || dataset.folders.some(folder => folder.id === nextId)) throw new Error('文件夹标识无效或已存在。');
  return { ...dataset, folders: [...dataset.folders, { id: nextId, scope, parentId, name: cleanName, module: 'production', sortOrder: nextOrder(foldersFor(scope, parentId, dataset)) }] };
}
export function renameFolder(dataset, { id, name }) {
  const folder = dataset.folders.find(item => item.id === id);
  if (!folder) throw new Error('文件夹不存在。');
  assertScope(dataset, folder.scope);
  const cleanName = folderName(name);
  assertUniqueName(dataset, folder.scope, folder.parentId, cleanName, id);
  return { ...dataset, folders: dataset.folders.map(item => item === folder ? { ...item, name: cleanName } : item) };
}
export function moveFolder(dataset, { id, parentId = '' }) {
  const folder = dataset.folders.find(item => item.id === id);
  if (!folder) throw new Error('文件夹不存在。');
  assertTarget(dataset, folder.scope, parentId);
  if (id === parentId || folderTrail(folder.scope, parentId, dataset).some(item => item.id === id)) throw new Error('不能将文件夹移动到自身或其子文件夹。');
  assertUniqueName(dataset, folder.scope, parentId, folder.name, id);
  if (folder.parentId === parentId) return dataset;
  const sortOrder = nextOrder(foldersFor(folder.scope, parentId, dataset));
  return { ...dataset, folders: dataset.folders.map(item => item === folder ? { ...item, parentId, sortOrder } : item) };
}
function checkedIds(ids) {
  if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) throw new Error('请选择不重复的有效资源。');
  return ids;
}
export function moveResources(dataset, { kind, ids, module, projectId, folderId = '' }) {
  checkedIds(ids);
  const collection = kind === 'project' ? 'projects' : kind === 'child' ? 'children' : '';
  if (!collection) throw new Error('此类资源不支持文件夹移动。');
  const records = ids.map(id => dataset[collection].find(item => item.id === id && item.module === module && (kind === 'project' || item.projectId === projectId)));
  if (records.some(record => !record)) throw new Error('资源不存在或不属于当前范围。');
  const project = kind === 'child' ? dataset.projects.find(item => item.id === projectId && item.module === module) : null;
  for (const record of records) assertWritable(kind === 'project' ? record : project);
  assertTarget(dataset, kind === 'project' ? projectFolderScope(module) : sectionFolderScope(project), folderId);
  const moving = records.filter(record => record.folderId !== folderId);
  if (!moving.length) return dataset;
  const movingSet = new Set(moving);
  const firstOrder = nextOrder(dataset[collection].filter(item => item.module === module && item.folderId === folderId && (kind === 'project' || item.projectId === projectId)));
  const updated = moving.map((record, index) => ({ ...record, folderId, ...(kind === 'child' ? { sortOrder: firstOrder + index } : {}) }));
  return { ...dataset, [collection]: [...dataset[collection].filter(item => !movingSet.has(item)), ...updated] };
}
export function moveResource(dataset, { id, ...options }) { return moveResources(dataset, { ...options, ids: [id] }); }
export function reorderResources(dataset, { kind, ids, module, projectId, folderId = '', beforeId }) {
  checkedIds(ids);
  if (folderId === 'all') throw new Error('请进入根目录或具体文件夹后排序。');
  let collection, siblings;
  if (kind === 'folder') {
    const project = projectId && dataset.projects.find(item => item.id === projectId && item.module === module);
    const scope = projectId ? sectionFolderScope(project) : projectFolderScope(module);
    assertTarget(dataset, scope, folderId);
    collection = 'folders'; siblings = foldersFor(scope, folderId, dataset);
  } else if (kind === 'child') {
    const project = dataset.projects.find(item => item.id === projectId && item.module === module);
    assertWritable(project);
    if (module === 'production') assertTarget(dataset, sectionFolderScope(project), folderId);
    else if (folderId !== '') throw new Error('此范围不支持文件夹。');
    collection = 'children'; siblings = childrenFor(project, dataset).filter(child => child.folderId === folderId);
  } else if (kind === 'project' && module === 'training') {
    if (folderId !== '' || projectId) throw new Error('项目排序不属于当前范围。');
    collection = 'projects'; siblings = ordered(dataset.projects.filter(project => project.module === module && !isProjectReadOnly(project)));
    for (const id of ids) {
      const project = dataset.projects.find(item => item.id === id && item.module === module);
      if (project) assertWritable(project);
    }
  } else throw new Error('此类资源不支持手工排序。');
  const selected = ids.map(id => siblings.find(item => item.id === id));
  if (selected.some(record => !record)) throw new Error('排序资源不属于当前范围。');
  if (beforeId && (!siblings.some(item => item.id === beforeId) || ids.includes(beforeId))) throw new Error('排序目标不属于当前范围或已在选择中。');
  const rest = siblings.filter(item => !ids.includes(item.id));
  const insertAt = beforeId ? rest.findIndex(item => item.id === beforeId) : rest.length;
  const sequence = [...rest.slice(0, insertAt), ...selected, ...rest.slice(insertAt)];
  const orders = new Map(sequence.map((record, index) => [record, index]));
  return { ...dataset, [collection]: dataset[collection].map(record => orders.has(record) ? { ...record, sortOrder: orders.get(record) } : record) };
}

function isModule(module) { return Object.hasOwn(moduleLabels, module); }
function normalizeFilters(module, filters = {}, { taskList = false, withFolder = false, childList = false } = {}) {
  const q = typeof filters.q === 'string' ? filters.q.trim().slice(0, 80) : '';
  const statuses = taskList ? taskStateOptions(module).map(option => option.value) : ['active', 'archived'];
  const types = taskList ? taskTypeOptions(module).map(option => option.value) : childList ? [module === 'production' ? 'image' : 'composition'] : [];
  return {
    q, status: statuses.includes(filters.status) ? filters.status : 'all', type: types.includes(filters.type) ? filters.type : 'all',
    ...(withFolder ? { folder: typeof filters.folder === 'string' ? filters.folder.slice(0, 100) : '' } : {}),
  };
}
function splitKey(raw) {
  const key = typeof raw === 'string' ? raw.trim().replace(/^#/, '').replace(/^\/(?!\/)/, '') : '';
  const queryAt = key.indexOf('?');
  const path = (queryAt < 0 ? key : key.slice(0, queryAt)).replace(/\/$/, '');
  return { path, parts: path.split('/'), query: new URLSearchParams(queryAt < 0 ? '' : key.slice(queryAt + 1)) };
}
function filtersFromQuery(query) {
  return { q: query.get('q'), status: query.get('status'), type: query.get('type'), ...(query.has('folder') ? { folder: query.get('folder') } : {}) };
}
function putFilters(query, filters) {
  if (filters.q) query.set('q', filters.q);
  if (filters.status !== 'all') query.set('status', filters.status);
  if (filters.type !== 'all') query.set('type', filters.type);
  if (Object.hasOwn(filters, 'folder')) query.set('folder', filters.folder);
}
const withQuery = (path, query) => path + (query.size ? '?' + query : '');
export function listKey(module, section = 'projects', filters = {}) {
  const safeModule = isModule(module) ? module : 'production';
  const safeSection = ['projects', 'tasks'].includes(section) ? section : 'projects';
  const normalized = normalizeFilters(safeModule, filters, { taskList: safeSection === 'tasks', withFolder: safeModule === 'production' && safeSection === 'projects' });
  const query = new URLSearchParams(); putFilters(query, normalized);
  return withQuery(safeModule + '/' + safeSection, query);
}
function normalizeListFrom(module, from, dataset, tasksOnly = false) {
  if (typeof from !== 'string' || !from.trim()) return '';
  const { parts, query } = splitKey(from);
  if (parts[0] !== module || parts.length !== 2 || !(tasksOnly ? ['tasks'] : ['projects', 'tasks']).includes(parts[1])) return '';
  return resolveList(module, parts[1], filtersFromQuery(query), undefined, dataset).key;
}
function projectFilters(project, tab, filters) {
  return normalizeFilters(project.module, filters, { taskList: tab === 'tasks', withFolder: tab === 'sections', childList: tab === childTabFor(project.module) });
}
export function projectKey(project, tab = 'overview', from = '', childId = '', filters = {}, dataset = initialDataset) {
  const record = dataset.projects.find(item => item.id === project?.id && item.module === project?.module);
  if (!record) return listKey(project?.module);
  const safeTab = projectTabs[record.module].some(item => item.id === tab) ? tab : 'overview';
  const child = safeTab === childTabFor(record.module) && childrenFor(record, dataset).find(item => item.id === childId);
  let listFrom = normalizeListFrom(record.module, from, dataset);
  let currentFilters = filters;
  // Child links can inherit the collection query directly, including its bounded list origin.
  const origin = splitKey(from);
  if (child && origin.parts.length === 4 && origin.parts[0] === record.module && origin.parts[1] === 'projects' && origin.parts[2] === record.id && origin.parts[3] === safeTab) {
    listFrom = normalizeListFrom(record.module, origin.query.get('from'), dataset);
    currentFilters = { ...filtersFromQuery(origin.query), ...filters };
  }
  if (child && safeTab === 'sections' && !Object.hasOwn(currentFilters, 'folder')) {
    currentFilters = { ...currentFilters, folder: child.folderId };
  }
  const query = new URLSearchParams();
  if (listFrom) query.set('from', listFrom);
  if (!['overview', 'profile'].includes(safeTab)) putFilters(query, projectFilters(record, safeTab, currentFilters));
  return withQuery([record.module, 'projects', record.id, safeTab, ...(child ? [child.id] : [])].join('/'), query);
}
// Keep one detail-to-detail hop above the existing collection and list origins.
// Repeated task/image visits collapse to that collection instead of growing the URL.
const sourceContext = () => ({ details: 0, hops: 0 });
const nextSourceContext = context => ({ details: context.details + 1, hops: context.hops + 1 });
function detailKey(path, from) {
  const query = new URLSearchParams();
  if (from) query.set('from', from);
  return withQuery(path, query);
}
function taskOwnsImage(task, image) {
  return image && image.module === task.module && image.projectId === task.projectId
    && image.taskId === task.id && task.outputImageIds?.includes(image.id);
}
function normalizeTaskFrom(task, from, dataset, context = sourceContext()) {
  if (context.hops >= 8) return '';
  const list = normalizeListFrom(task.module, from, dataset, true);
  if (list) return list;
  const { parts, query } = splitKey(from);
  if (parts[0] === task.module && parts[1] === 'tasks' && parts[2] === task.id && parts.length === 3) {
    return normalizeTaskFrom(task, query.get('from'), dataset, { ...context, hops: context.hops + 1 });
  }
  if (parts[0] !== task.module || parts[1] !== 'projects' || parts[2] !== task.projectId || ![4, 5].includes(parts.length)) return '';
  const project = dataset.projects.find(item => item.id === parts[2] && item.module === task.module);
  if (!project) return '';
  const tab = parts[3], childTab = childTabFor(task.module);
  const imageTab = task.module === 'production' ? 'images' : 'materials';
  if (parts.length === 5 && tab === 'images') {
    const image = dataset.images.find(item => item.id === parts[4] && taskOwnsImage(task, item));
    if (!image) return '';
    const inner = normalizeMediaFrom(image, query.get('from'), 'image', dataset, nextSourceContext(context));
    return context.details ? inner : detailKey(parts.join('/'), inner);
  }
  if (!['overview', 'tasks', childTab, imageTab].includes(tab)) return '';
  if (tab === imageTab && !dataset.images.some(image => taskOwnsImage(task, image))) return '';
  const child = parts.length === 5 && tab === childTab && childrenFor(project, dataset).find(item => item.id === parts[4]);
  if (parts.length === 5 && (!child || (task.childId && child.id !== task.childId))) return '';
  const key = projectKey(project, tab, normalizeListFrom(task.module, query.get('from'), dataset), child?.id || '', filtersFromQuery(query), dataset);
  return resolveContextRoute(key, dataset).key;
}
export function taskKey(task, from = '', dataset = initialDataset) {
  const record = dataset.tasks.find(item => item.id === task?.id && item.module === task?.module);
  if (!record) return listKey(task?.module, 'tasks');
  const safeFrom = normalizeTaskFrom(record, from, dataset);
  const query = new URLSearchParams();
  if (safeFrom) query.set('from', safeFrom);
  return withQuery(record.module + '/tasks/' + record.id, query);
}
function normalizeMediaFrom(record, from, kind, dataset, context = sourceContext()) {
  if (context.hops >= 8) return '';
  const { parts, query } = splitKey(from);
  if (kind === 'image') {
    const list = normalizeListFrom(record.module, from, dataset, true);
    if (list) return list;
    if (parts[0] === record.module && parts[1] === 'tasks' && parts.length === 3) {
      const task = dataset.tasks.find(item => item.id === parts[2] && taskOwnsImage(item, record));
      if (!task) return '';
      const inner = normalizeTaskFrom(task, query.get('from'), dataset, nextSourceContext(context));
      return context.details ? inner : detailKey(parts.join('/'), inner);
    }
  }
  if (parts[0] !== record.module || parts[1] !== 'projects' || parts[2] !== record.projectId) return '';
  const project = dataset.projects.find(item => item.id === record.projectId && item.module === record.module);
  if (!project) return '';
  const defaultTab = kind === 'reference' ? 'references' : record.module === 'production' ? 'images' : 'materials';
  const childTab = childTabFor(record.module);
  const child = parts.length === 5 && parts[3] === childTab && childrenFor(project, dataset).find(item => item.id === parts[4]
    && (kind === 'image' ? item.id === record.childId : item.inputReferenceIds?.includes(record.id)));
  const allowedTabs = kind === 'image' ? [defaultTab, 'overview', 'tasks'] : [defaultTab];
  if (!(parts.length === 4 && allowedTabs.includes(parts[3])) && !child) return '';
  const key = projectKey(project, child ? childTab : parts[3], normalizeListFrom(record.module, query.get('from'), dataset), child?.id || '', filtersFromQuery(query), dataset);
  return resolveContextRoute(key, dataset).key;
}
function mediaKey(record, from, kind, dataset) {
  const collection = kind === 'reference' ? 'references' : 'images';
  const found = dataset[collection].find(item => item.id === record?.id && item.module === record?.module && item.projectId === record?.projectId);
  const project = dataset.projects.find(item => item.id === record?.projectId && item.module === record?.module);
  if (!found || !project) return project ? projectKey(project, kind === 'reference' ? 'references' : project.module === 'production' ? 'images' : 'materials', '', '', {}, dataset) : listKey(record?.module);
  const safeFrom = normalizeMediaFrom(found, from, kind, dataset);
  const query = new URLSearchParams();
  if (safeFrom) query.set('from', safeFrom);
  return withQuery([found.module, 'projects', found.projectId, collection, found.id].join('/'), query);
}
export const referenceKey = (reference, from = '', dataset = initialDataset) => mediaKey(reference, from, 'reference', dataset);
export const imageKey = (image, from = '', dataset = initialDataset) => mediaKey(image, from, 'image', dataset);

export function filterProjects(module, filters = {}, dataset = initialDataset) {
  const { q, status } = normalizeFilters(module, filters);
  const needle = q.toLocaleLowerCase();
  const result = dataset.projects.filter(project => project.module === module && (status === 'all' || project.state === status)
    && inFolder(project, filters) && (!needle || project.name.toLocaleLowerCase().includes(needle)));
  return module === 'training' ? ordered(result) : result;
}
export function filterTasks(module, filters = {}, dataset = initialDataset) {
  const { q, status } = normalizeFilters(module, filters, { taskList: true });
  const needle = q.toLocaleLowerCase();
  return dataset.tasks.filter(task => {
    const project = dataset.projects.find(item => item.id === task.projectId && item.module === module);
    return task.module === module && (!filters.projectId || task.projectId === filters.projectId) && (!filters.childId || task.childId === filters.childId)
      && (status === 'all' || task.state === status) && (!filters.type || filters.type === 'all' || task.type === filters.type)
      && (!needle || (task.name + ' ' + (project?.name || '')).toLocaleLowerCase().includes(needle));
  });
}
function resolveList(module, section, filters = {}, notice, dataset = initialDataset) {
  const normalized = normalizeFilters(module, filters, { taskList: section === 'tasks', withFolder: section === 'projects' && module === 'production' });
  const folder = resolveFolder(section === 'projects' ? projectFolderScope(module) : '', normalized.folder, dataset);
  if (Object.hasOwn(folder, 'folder')) normalized.folder = folder.folder;
  return {
    key: listKey(module, section, normalized), rootKey: module + '/' + section, module, section,
    title: moduleLabels[module] + ' · ' + sectionLabels[section], kind: 'list', filters: normalized,
    ...((notice || folder.notice) ? { notice: notice || folder.notice } : {}),
  };
}
export function resolveContextRoute(rawHashOrKey, dataset = initialDataset) {
  const { path, parts, query } = splitKey(rawHashOrKey);
  if (!path) return resolveList('production', 'projects', {}, undefined, dataset);
  const [module, section, resourceId, requestedTab, detailId] = parts;
  if (module === 'global' && parts.length === 2 && Object.hasOwn(globalLabels, section)) {
    return { key: path, rootKey: path, section, title: globalLabels[section], kind: 'global', filters: normalizeFilters(module) };
  }
  if (!isModule(module)) return resolveList('production', 'tasks', {}, '无法识别业务模块，已返回生产任务。', dataset);
  if (parts.length === 2 && ['projects', 'tasks'].includes(section)) return resolveList(module, section, filtersFromQuery(query), undefined, dataset);
  if (parts.length === 2 && ['presets', 'templates'].includes(section)) {
    return { key: module + '/' + section, rootKey: module + '/' + section, module, section, title: moduleLabels[module] + ' · ' + sectionLabels[section], kind: 'stub', filters: normalizeFilters(module) };
  }
  if (section === 'tasks' && resourceId) {
    const task = parts.length === 3 && dataset.tasks.find(item => item.id === resourceId && item.module === module);
    if (!task) {
      const source = splitKey(query.get('from'));
      const from = normalizeTaskFrom({ module, projectId: source.parts[1] === 'projects' ? source.parts[2] : '', childId: null }, query.get('from'), dataset);
      const fallback = from ? resolveContextRoute(from, dataset) : resolveList(module, 'tasks', {}, undefined, dataset);
      return { ...fallback, notice: '任务不存在或已移除，已返回来源任务集合。' };
    }
    const from = normalizeTaskFrom(task, query.get('from'), dataset);
    const project = dataset.projects.find(item => item.id === task.projectId && item.module === module);
    const child = dataset.children.find(item => item.id === task.childId && belongsTo(item, project));
    return {
      key: taskKey(task, from, dataset), rootKey: module + '/tasks', module, section: 'tasks', kind: 'task', title: task.name,
      task, project, child, filters: normalizeFilters(module, {}, { taskList: true }), ...(from ? { from } : {}),
    };
  }
  if (section !== 'projects' || !resourceId) return resolveList(module, 'tasks', {}, '无法识别' + moduleLabels[module] + '页面，已返回' + moduleLabels[module] + '任务。', dataset);
  const from = normalizeListFrom(module, query.get('from'), dataset);
  const project = dataset.projects.find(item => item.id === resourceId && item.module === module);
  if (!project) {
    const source = splitKey(from);
    return resolveList(module, 'projects', source.parts[1] === 'projects' ? filtersFromQuery(source.query) : {}, '项目不存在或已移除，已返回项目列表。', dataset);
  }
  if (['references', 'images'].includes(requestedTab) && detailId && parts.length === 5 && (requestedTab !== 'references' || module === 'training')) {
    const kind = requestedTab === 'references' ? 'reference' : 'image';
    const record = dataset[requestedTab].find(item => item.id === detailId && belongsTo(item, project));
    const fallbackTab = kind === 'reference' ? 'references' : module === 'production' ? 'images' : 'materials';
    const mediaFrom = normalizeMediaFrom(record || { module, projectId: project.id }, query.get('from'), kind, dataset);
    const collectionKey = mediaFrom || projectKey(project, fallbackTab, from, '', {}, dataset);
    if (!record) return { ...resolveContextRoute(collectionKey, dataset), notice: (kind === 'reference' ? '参考图' : '图片结果') + '不存在，已返回所属集合。' };
    const sourceRoute = resolveContextRoute(collectionKey, dataset);
    return {
      key: mediaKey(record, mediaFrom, kind, dataset), rootKey: module + '/projects', module, section: 'projects', title: record.name,
      kind, project, tab: sourceRoute.tab || fallbackTab, [kind]: record,
      child: kind === 'image' ? childrenFor(project, dataset).find(item => item.id === record.childId) : undefined,
      from: collectionKey, collectionKey, filters: sourceRoute.filters,
    };
  }
  const knownTab = projectTabs[module].find(item => item.id === (requestedTab || 'overview'));
  const tab = knownTab?.id || 'overview';
  let notice = knownTab ? undefined : '该项目没有此页签，已返回项目概览。';
  const childTab = childTabFor(module);
  let child;
  if (knownTab && (detailId || parts.length > 4)) {
    if (tab === childTab) {
      child = parts.length === 5 && childrenFor(project, dataset).find(item => item.id === detailId);
      if (!child) notice = (module === 'production' ? '小节' : '构图') + '不存在，已返回项目' + knownTab.label + '。';
    } else notice = '此页签没有该下级页面，已返回项目页签。';
  }
  const filters = projectFilters(project, tab, !['overview', 'profile'].includes(tab) ? filtersFromQuery(query) : {});
  if (child && tab === 'sections' && !query.has('folder')) filters.folder = child.folderId;
  const folder = resolveFolder(tab === 'sections' ? sectionFolderScope(project) : '', filters.folder, dataset);
  if (Object.hasOwn(folder, 'folder')) filters.folder = folder.folder;
  notice ||= folder.notice;
  return {
    key: projectKey(project, tab, from, child?.id, filters, dataset), rootKey: module + '/projects', module, section: 'projects',
    title: child?.name || project.name, kind: child ? 'child' : 'project', filters, project, tab,
    ...(child ? { child, collectionKey: projectKey(project, tab, from, '', filters, dataset) } : {}),
    ...(from ? { from } : {}), ...(notice ? { notice } : {}),
  };
}
