// R02-02 uses local fragment routes and synthetic records only.
export const projectTabs = {
  production: [
    { id: 'overview', label: '概览' },
    { id: 'sections', label: '小节' },
    { id: 'images', label: '图片' },
    { id: 'tasks', label: '任务' },
  ],
  training: [
    { id: 'overview', label: '概览' },
    { id: 'profile', label: '角色档案' },
    { id: 'references', label: '参考图' },
    { id: 'compositions', label: '构图' },
    { id: 'materials', label: '训练素材' },
    { id: 'tasks', label: '任务' },
  ],
};

const moduleLabels = { production: '生产', training: '训练' };
const sectionLabels = { projects: '项目', tasks: '任务', presets: '预制', templates: '模板' };
const globalLabels = { models: '模型', monitoring: '监控与日志', settings: '设置' };
const projectNames = {
  production: [
    '雨后街角', '薄暮书店', '海岸旅人', '春日窗边', '城市夜行', '山间来信',
    '旧物与日常', '林下光影', '周末咖啡馆', '清晨候车室', '远山与湖泊', '暖色厨房',
    '夏日庭院', '雪中的街道', '午后散步', '人物半身像',
    '关于海边小镇雨后黄昏与人物服饰细节的连续画面设计研究', '冬日室内光线',
  ],
  training: [
    '青禾', '洛川', '日常服饰', '水彩肖像', '短发角色', '旅行装束',
    '侧脸与逆光', '长发角色', '运动服细节', '室内自然光', '配饰与手部', '柔和线条',
    '冬季外套', '表情练习', '全身比例', '自然姿态',
    '青禾角色在不同光照与复杂服饰条件下的一致性训练样本集', '色彩与质感',
  ],
};

export const projects = Object.entries(projectNames).flatMap(([module, names]) =>
  names.map((name, index) => ({
    id: `${module === 'production' ? 'p' : 't'}${String(index + 1).padStart(2, '0')}`,
    module,
    name,
    state: (index + 1) % 5 === 0 ? 'archived' : 'active',
    folderId: module === 'production' && index % 3 === 1 ? (index % 2 ? 'f-project-city' : 'f-project-scenes') : module === 'production' && index % 3 === 2 ? 'f-project-portraits' : '',
    photo: `/media/context/scene-${index % 6 + 1}.jpg`,
    summary: module === 'production'
      ? '6 个图片小节' : '6 个构图',
  })),
);

export const projectFolderScope = module => module === 'production' ? 'production/projects' : '';
export const sectionFolderScope = project => project?.module === 'production' ? `production/${project.id}/sections` : '';
const photoFor = index => `/media/context/scene-${index % 6 + 1}.jpg`;
const children = projects.flatMap((project, projectIndex) => {
  const names = project.module === 'production' ? ['场景与氛围', '人物与服饰', '光线与细节', '街角远景', '窗边近景', '雨后倒影'] : ['正面半身', '侧面全身', '近景表情', '逆光侧脸', '坐姿与手部', '室外自然光'];
  return names.map((name, index) => ({
    id: `${project.module === 'production' ? 's' : 'c'}0${index + 1}`, projectId: project.id, module: project.module, name,
    folderId: project.module === 'production' && index > 1 ? `f-${project.id}-${index > 3 ? 'details' : 'scenes'}` : '',
    photo: photoFor(projectIndex + index), type: project.module === 'production' ? 'image' : 'composition',
  }));
});
const tasks = projects.flatMap((project, projectIndex) => ['done', 'running', 'queued', 'failed'].map((state, index) => {
  const child = children.find(item => item.projectId === project.id && item.id === `${project.module === 'production' ? 's' : 'c'}0${index + 1}`);
  const type = project.module === 'production' ? 'image-generation' : index === 3 ? 'lora-training' : 'material-generation';
  return {
    id: `${project.module === 'production' ? 'run' : 'train'}-${project.id}-${index + 1}`, module: project.module, projectId: project.id,
    childId: type === 'lora-training' ? null : child.id, type, state,
    name: type === 'lora-training' ? `${project.name} · LoRA 训练` : `${child.name} · 第 ${index + 1} 次生成`,
    photo: state === 'done' ? photoFor(projectIndex + index) : null, sourcePhoto: child.photo, outputCount: state === 'done' ? 4 : 0,
  };
}));
const folders = [
  { id: 'f-project-scenes', scope: 'production/projects', parentId: '', name: '场景创作', module: 'production' },
  { id: 'f-project-city', scope: 'production/projects', parentId: 'f-project-scenes', name: '城市日常', module: 'production' },
  { id: 'f-project-portraits', scope: 'production/projects', parentId: '', name: '人物研究', module: 'production' },
  ...projects.filter(project => project.module === 'production').flatMap(project => [
    { id: `f-${project.id}-scenes`, scope: sectionFolderScope(project), parentId: '', name: '场景镜头', module: 'production' },
    { id: `f-${project.id}-details`, scope: sectionFolderScope(project), parentId: `f-${project.id}-scenes`, name: '细节补充', module: 'production' },
  ]),
];
export const initialDataset = { projects, children, tasks, folders };

export function childrenFor(project, dataset = initialDataset) {
  return dataset.children.filter(child => child.projectId === project?.id && child.module === project?.module);
}
export function filterChildren(project, filters = {}, dataset = initialDataset) {
  const needle = String(filters.q || '').trim().toLocaleLowerCase();
  return childrenFor(project, dataset).filter(child => (!Object.hasOwn(filters, 'folder') || child.folderId === filters.folder) && (!needle || child.name.toLocaleLowerCase().includes(needle)));
}
export function foldersFor(scope, parentId = '', dataset = initialDataset) {
  return dataset.folders.filter(folder => folder.scope === scope && folder.parentId === (parentId || ''));
}
export function folderTrail(scope, folderId, dataset = initialDataset) {
  const result = [], seen = new Set();
  let current = folderId;
  while (current && !seen.has(current)) {
    seen.add(current);
    const folder = dataset.folders.find(item => item.id === current && item.scope === scope);
    if (!folder) break;
    result.unshift(folder);
    current = folder.parentId;
  }
  return result;
}
// Missing seeded folders can recover to a known surviving ancestor.
function resolveFolder(scope, requested, dataset) {
  if (!scope || !requested) return { folder: '' };
  const seen = new Set();
  let current = requested;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (dataset.folders.some(folder => folder.id === current && folder.scope === scope)) return { folder: current, ...(current !== requested ? { notice: '文件夹不存在，已返回最近的上级文件夹。' } : {}) };
    current = initialDataset.folders.find(folder => folder.id === current && folder.scope === scope)?.parentId || '';
  }
  return { folder: '', notice: '文件夹不存在，已返回当前范围的根目录。' };
}
function assertScope(dataset, scope) {
  if (scope === 'production/projects' || dataset.projects.some(project => scope && sectionFolderScope(project) === scope)) return;
  throw new Error('此范围不支持文件夹。');
}
function assertTarget(dataset, scope, parentId) {
  assertScope(dataset, scope);
  if (parentId && !dataset.folders.some(folder => folder.id === parentId && folder.scope === scope)) throw new Error('目标文件夹不属于当前范围。');
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
export function createFolder(dataset, { scope, parentId = '', name, id }) {
  assertTarget(dataset, scope, parentId);
  const cleanName = folderName(name);
  assertUniqueName(dataset, scope, parentId, cleanName);
  let nextId = id;
  if (!nextId) {
    let index = 1;
    while (dataset.folders.some(folder => folder.id === `folder-local-${index}`)) index += 1;
    nextId = `folder-local-${index}`;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(nextId) || dataset.folders.some(folder => folder.id === nextId)) throw new Error('文件夹标识无效或已存在。');
  return { ...dataset, folders: [...dataset.folders, { id: nextId, scope, parentId, name: cleanName, module: 'production' }] };
}
export function renameFolder(dataset, { id, name }) {
  const folder = dataset.folders.find(item => item.id === id);
  if (!folder) throw new Error('文件夹不存在。');
  assertScope(dataset, folder.scope);
  const cleanName = folderName(name);
  assertUniqueName(dataset, folder.scope, folder.parentId, cleanName, id);
  return { ...dataset, folders: dataset.folders.map(item => item.id === id ? { ...item, name: cleanName } : item) };
}
export function moveFolder(dataset, { id, parentId = '' }) {
  const folder = dataset.folders.find(item => item.id === id);
  if (!folder) throw new Error('文件夹不存在。');
  assertTarget(dataset, folder.scope, parentId);
  if (id === parentId || folderTrail(folder.scope, parentId, dataset).some(item => item.id === id)) throw new Error('不能将文件夹移动到自身或其子文件夹。');
  assertUniqueName(dataset, folder.scope, parentId, folder.name, id);
  return { ...dataset, folders: dataset.folders.map(item => item.id === id ? { ...item, parentId } : item) };
}
export function moveResource(dataset, { kind, id, module, projectId, folderId = '' }) {
  const collection = kind === 'project' ? 'projects' : kind === 'child' ? 'children' : '';
  if (!collection) throw new Error('此类资源不支持文件夹移动。');
  const record = dataset[collection].find(item => item.id === id && item.module === module && (kind === 'project' || item.projectId === projectId));
  if (!record) throw new Error('资源不存在。');
  const project = kind === 'project' ? record : dataset.projects.find(item => item.id === projectId && item.module === module);
  assertTarget(dataset, kind === 'project' ? projectFolderScope(module) : sectionFolderScope(project), folderId);
  return { ...dataset, [collection]: dataset[collection].map(item => item === record ? { ...item, folderId } : item) };
}

function isModule(module) {
  return Object.hasOwn(moduleLabels, module);
}

function normalizeFilters(filters = {}, taskList = false, withFolder = true) {
  const q = typeof filters.q === 'string' ? filters.q.trim().slice(0, 80) : '';
  const statuses = taskList ? ['done', 'running', 'queued', 'failed'] : ['active', 'archived'];
  const status = statuses.includes(filters.status) ? filters.status : 'all';
  return { q, status, ...(withFolder && typeof filters.folder === 'string' && filters.folder ? { folder: filters.folder.slice(0, 100) } : {}) };
}

function splitKey(raw) {
  const key = typeof raw === 'string' ? raw.trim().replace(/^#/, '').replace(/^\/(?!\/)/, '') : '';
  const queryAt = key.indexOf('?');
  const path = (queryAt < 0 ? key : key.slice(0, queryAt)).replace(/\/$/, '');
  return {
    path,
    parts: path.split('/'),
    query: new URLSearchParams(queryAt < 0 ? '' : key.slice(queryAt + 1)),
  };
}

export function listKey(module, section = 'projects', filters = {}) {
  const safeModule = isModule(module) ? module : 'production';
  const safeSection = ['projects', 'tasks'].includes(section) ? section : 'projects';
  const { q, status, folder } = normalizeFilters(filters, safeSection === 'tasks', safeModule === 'production' && safeSection === 'projects');
  const query = new URLSearchParams();
  if (q) query.set('q', q);
  if (status !== 'all') query.set('status', status);
  if (folder) query.set('folder', folder);
  return `${safeModule}/${safeSection}${query.size ? `?${query}` : ''}`;
}

function normalizeFrom(module, from, dataset = initialDataset, allowProjectViews = false) {
  if (typeof from !== 'string' || !from.trim()) return '';
  const { parts, query } = splitKey(from);
  if (parts[0] !== module) return '';
  if (parts.length === 2 && (allowProjectViews ? parts[1] === 'tasks' : ['projects', 'tasks'].includes(parts[1]))) return resolveList(module, parts[1], filtersFromQuery(query), undefined, dataset).key;
  if (allowProjectViews && [4, 5].includes(parts.length) && parts[1] === 'projects') {
    const project = dataset.projects.find(item => item.id === parts[2] && item.module === module);
    if (!project) return '';
    const childTab = module === 'production' ? 'sections' : 'compositions';
    const tab = parts[3];
    if (!['overview', 'tasks', childTab].includes(tab)) return '';
    const child = parts.length === 5 && tab === childTab && childrenFor(project, dataset).find(item => item.id === parts[4]);
    if (parts.length === 5 && !child) return '';
    // Preserve one list origin below a project source; list normalization removes any deeper origin.
    const listOrigin = normalizeFrom(module, query.get('from'), dataset, false);
    const key = projectKey(project, tab, listOrigin, child?.id || '', filtersFromQuery(query), dataset);
    return resolveContextRoute(key, dataset).key;
  }
  return '';
}

function filtersFromQuery(query) { return { q: query.get('q'), status: query.get('status'), folder: query.get('folder') }; }

export function projectKey(project, tab = 'overview', from = '', childId = '', filters = {}, dataset = initialDataset) {
  const record = dataset.projects.find((item) => item.id === project?.id && item.module === project?.module);
  if (!record) return listKey(project?.module);
  const safeTab = projectTabs[record.module].some((item) => item.id === tab) ? tab : 'overview';
  const childTab = record.module === 'production' ? 'sections' : 'compositions';
  const child = safeTab === childTab && childrenFor(record, dataset).find((item) => item.id === childId);
  const safeFrom = normalizeFrom(record.module, from, dataset);
  const query = new URLSearchParams();
  if (safeFrom) query.set('from', safeFrom);
  if (safeTab === childTab || safeTab === 'tasks') {
    const safeFilters = normalizeFilters(filters, safeTab === 'tasks', safeTab === 'sections');
    if (safeFilters.q) query.set('q', safeFilters.q);
    if (safeFilters.status !== 'all') query.set('status', safeFilters.status);
    if (safeFilters.folder) query.set('folder', safeFilters.folder);
  }
  return `${record.module}/projects/${record.id}/${safeTab}${child ? `/${child.id}` : ''}${query.size ? `?${query}` : ''}`;
}

export function taskKey(task, from = '', dataset = initialDataset) {
  const record = dataset.tasks.find(item => item.id === task?.id && item.module === task?.module);
  if (!record) return listKey(task?.module, 'tasks');
  const safeFrom = normalizeFrom(record.module, from, dataset, true);
  const query = new URLSearchParams();
  if (safeFrom) query.set('from', safeFrom);
  return `${record.module}/tasks/${record.id}${query.size ? `?${query}` : ''}`;
}

export function filterProjects(module, filters = {}, dataset = initialDataset) {
  const { q, status } = normalizeFilters(filters);
  const needle = q.toLocaleLowerCase();
  return dataset.projects.filter((project) => project.module === module
    && (status === 'all' || project.state === status)
    && (!Object.hasOwn(filters, 'folder') || project.folderId === filters.folder)
    && (!needle || project.name.toLocaleLowerCase().includes(needle)));
}

export function filterTasks(module, filters = {}, dataset = initialDataset) {
  const { q, status } = normalizeFilters(filters, true, false);
  const needle = q.toLocaleLowerCase();
  return dataset.tasks.filter(task => {
    const project = dataset.projects.find(item => item.id === task.projectId && item.module === module);
    return task.module === module && (!filters.projectId || task.projectId === filters.projectId) && (!filters.childId || task.childId === filters.childId)
      && (status === 'all' || task.state === status) && (!needle || `${task.name} ${project?.name || ''}`.toLocaleLowerCase().includes(needle));
  });
}

function resolveList(module, section, filters = {}, notice, dataset = initialDataset) {
  const normalized = normalizeFilters(filters, section === 'tasks', section === 'projects' && module === 'production');
  const folder = resolveFolder(section === 'projects' ? projectFolderScope(module) : '', normalized.folder, dataset);
  delete normalized.folder;
  if (folder.folder) normalized.folder = folder.folder;
  return {
    key: listKey(module, section, normalized),
    rootKey: `${module}/${section}`,
    module,
    section,
    title: `${moduleLabels[module]} · ${sectionLabels[section]}`,
    kind: 'list',
    filters: normalized,
    ...((notice || folder.notice) ? { notice: notice || folder.notice } : {}),
  };
}

export function resolveContextRoute(rawHashOrKey, dataset = initialDataset) {
  const { path, parts, query } = splitKey(rawHashOrKey);
  if (!path) return resolveList('production', 'projects', {}, undefined, dataset);
  const [module, section, projectId, requestedTab, childId] = parts;

  if (module === 'global' && parts.length === 2 && Object.hasOwn(globalLabels, section)) {
    return {
      key: path, rootKey: path, section, title: globalLabels[section], kind: 'global',
      filters: normalizeFilters(),
    };
  }
  if (!isModule(module)) {
    return resolveList('production', 'tasks', {}, '无法识别业务模块，已返回生产任务。', dataset);
  }
  if (parts.length === 2 && ['projects', 'tasks'].includes(section)) {
    return resolveList(module, section, filtersFromQuery(query), undefined, dataset);
  }
  if (parts.length === 2 && ['presets', 'templates'].includes(section)) {
    return {
      key: `${module}/${section}`, rootKey: `${module}/${section}`, module, section,
      title: `${moduleLabels[module]} · ${sectionLabels[section]}`, kind: 'stub',
      filters: normalizeFilters(),
    };
  }
  if (section === 'tasks' && projectId) {
    const from = normalizeFrom(module, query.get('from'), dataset, true);
    const task = parts.length === 3 && dataset.tasks.find(item => item.id === projectId && item.module === module);
    if (!task) {
      const fallback = from ? resolveContextRoute(from, dataset) : resolveList(module, 'tasks', {}, undefined, dataset);
      return { ...fallback, notice: '任务不存在或已移除，已返回任务列表。' };
    }
    const project = dataset.projects.find(item => item.id === task.projectId && item.module === module);
    const child = dataset.children.find(item => item.id === task.childId && item.projectId === task.projectId && item.module === module);
    return { key: taskKey(task, from, dataset), rootKey: `${module}/tasks`, module, section: 'tasks', kind: 'task', title: task.name, task, project, child, filters: normalizeFilters({}, true), ...(from ? { from } : {}) };
  }
  if (section !== 'projects' || !projectId) {
    return resolveList(module, 'tasks', {}, `无法识别${moduleLabels[module]}页面，已返回${moduleLabels[module]}任务。`, dataset);
  }

  const from = normalizeFrom(module, query.get('from'), dataset);
  const project = dataset.projects.find((item) => item.id === projectId && item.module === module);
  if (!project) {
    const source = splitKey(from);
    const filters = source.parts[1] === 'projects'
      ? filtersFromQuery(source.query) : {};
    return resolveList(module, 'projects', filters, '项目不存在或已移除，已返回项目列表。', dataset);
  }

  const knownTab = projectTabs[module].find((item) => item.id === (requestedTab || 'overview'));
  const tab = knownTab?.id ?? 'overview';
  let notice = knownTab ? undefined : '该项目没有此页签，已返回项目概览。';
  const childTab = module === 'production' ? 'sections' : 'compositions';
  let child;
  if (knownTab && (childId || parts.length > 4)) {
    if (tab === childTab) {
      child = parts.length === 5 && childrenFor(project, dataset).find((item) => item.id === childId);
      if (!child) notice = `${module === 'production' ? '小节' : '构图'}不存在，已返回项目${knownTab.label}。`;
    } else {
      notice = '此页签没有该下级页面，已返回项目页签。';
    }
  }
  const filters = normalizeFilters(tab === childTab || tab === 'tasks' ? filtersFromQuery(query) : {}, tab === 'tasks', tab === 'sections');
  const folder = resolveFolder(tab === 'sections' ? sectionFolderScope(project) : '', filters.folder, dataset);
  delete filters.folder;
  if (folder.folder) filters.folder = folder.folder;
  notice ||= folder.notice;
  return {
    key: projectKey(project, tab, from, child?.id, filters, dataset),
    rootKey: `${module}/projects`,
    module,
    section: 'projects',
    title: child?.name ?? project.name,
    kind: child ? 'child' : 'project',
    filters,
    project,
    tab,
    ...(child ? { child } : {}),
    ...(from ? { from } : {}),
    ...(notice ? { notice } : {}),
  };
}
