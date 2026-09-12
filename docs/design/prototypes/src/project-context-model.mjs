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
    summary: module === 'production'
      ? `生产导航样本 ${String(index + 1).padStart(2, '0')} · 3 个小节`
      : `训练导航样本 ${String(index + 1).padStart(2, '0')} · 3 个构图`,
  })),
);

export function childrenFor(project) {
  if (project?.module === 'production') {
    return [
      { id: 's01', name: '场景与氛围' },
      { id: 's02', name: '人物与服饰' },
      { id: 's03', name: '光线与细节' },
    ];
  }
  if (project?.module === 'training') {
    return [
      { id: 'c01', name: '正面半身' },
      { id: 'c02', name: '侧面全身' },
      { id: 'c03', name: '近景表情' },
    ];
  }
  return [];
}

function isModule(module) {
  return Object.hasOwn(moduleLabels, module);
}

function normalizeFilters(filters = {}) {
  const q = typeof filters.q === 'string' ? filters.q.trim().slice(0, 80) : '';
  const status = ['active', 'archived'].includes(filters.status) ? filters.status : 'all';
  return { q, status };
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
  const { q, status } = normalizeFilters(filters);
  const query = new URLSearchParams();
  if (q) query.set('q', q);
  if (status !== 'all') query.set('status', status);
  return `${safeModule}/${safeSection}${query.size ? `?${query}` : ''}`;
}

function normalizeFrom(module, from) {
  if (typeof from !== 'string' || !from.trim()) return '';
  const { parts, query } = splitKey(from);
  if (parts.length !== 2 || parts[0] !== module || !['projects', 'tasks'].includes(parts[1])) return '';
  return listKey(module, parts[1], { q: query.get('q'), status: query.get('status') });
}

export function projectKey(project, tab = 'overview', from = '', childId = '') {
  const record = projects.find((item) => item.id === project?.id && item.module === project?.module);
  if (!record) return listKey(project?.module);
  const safeTab = projectTabs[record.module].some((item) => item.id === tab) ? tab : 'overview';
  const childTab = record.module === 'production' ? 'sections' : 'compositions';
  const child = safeTab === childTab && childrenFor(record).find((item) => item.id === childId);
  const safeFrom = normalizeFrom(record.module, from);
  const query = new URLSearchParams();
  if (safeFrom) query.set('from', safeFrom);
  return `${record.module}/projects/${record.id}/${safeTab}${child ? `/${child.id}` : ''}${query.size ? `?${query}` : ''}`;
}

export function filterProjects(module, filters = {}) {
  const { q, status } = normalizeFilters(filters);
  const needle = q.toLocaleLowerCase();
  return projects.filter((project) => project.module === module
    && (status === 'all' || project.state === status)
    && (!needle || project.name.toLocaleLowerCase().includes(needle)));
}

function resolveList(module, section, filters = {}, notice) {
  return {
    key: listKey(module, section, filters),
    rootKey: `${module}/${section}`,
    module,
    section,
    title: `${moduleLabels[module]} · ${sectionLabels[section]}`,
    kind: 'list',
    filters: normalizeFilters(filters),
    ...(notice ? { notice } : {}),
  };
}

export function resolveContextRoute(rawHashOrKey) {
  const { path, parts, query } = splitKey(rawHashOrKey);
  if (!path) return resolveList('production', 'projects');
  const [module, section, projectId, requestedTab, childId] = parts;

  if (module === 'global' && parts.length === 2 && Object.hasOwn(globalLabels, section)) {
    return {
      key: path, rootKey: path, section, title: globalLabels[section], kind: 'global',
      filters: normalizeFilters(),
    };
  }
  if (!isModule(module)) {
    return resolveList('production', 'tasks', {}, '无法识别业务模块，已返回生产任务。');
  }
  if (parts.length === 2 && ['projects', 'tasks'].includes(section)) {
    return resolveList(module, section, { q: query.get('q'), status: query.get('status') });
  }
  if (parts.length === 2 && ['presets', 'templates'].includes(section)) {
    return {
      key: `${module}/${section}`, rootKey: `${module}/${section}`, module, section,
      title: `${moduleLabels[module]} · ${sectionLabels[section]}`, kind: 'stub',
      filters: normalizeFilters(),
    };
  }
  if (section !== 'projects' || !projectId) {
    return resolveList(module, 'tasks', {}, `无法识别${moduleLabels[module]}页面，已返回${moduleLabels[module]}任务。`);
  }

  const from = normalizeFrom(module, query.get('from'));
  const project = projects.find((item) => item.id === projectId && item.module === module);
  if (!project) {
    const source = splitKey(from);
    const filters = source.parts[1] === 'projects'
      ? { q: source.query.get('q'), status: source.query.get('status') } : {};
    return resolveList(module, 'projects', filters, '项目不存在或已移除，已返回项目列表。');
  }

  const knownTab = projectTabs[module].find((item) => item.id === (requestedTab || 'overview'));
  const tab = knownTab?.id ?? 'overview';
  let notice = knownTab ? undefined : '该项目没有此页签，已返回项目概览。';
  const childTab = module === 'production' ? 'sections' : 'compositions';
  let child;
  if (knownTab && (childId || parts.length > 4)) {
    if (tab === childTab) {
      child = parts.length === 5 && childrenFor(project).find((item) => item.id === childId);
      if (!child) notice = `${module === 'production' ? '小节' : '构图'}不存在，已返回项目${knownTab.label}。`;
    } else {
      notice = '此页签没有该下级页面，已返回项目页签。';
    }
  }
  return {
    key: projectKey(project, tab, from, child?.id),
    rootKey: `${module}/projects`,
    module,
    section: 'projects',
    title: child?.name ?? project.name,
    kind: child ? 'child' : 'project',
    filters: normalizeFilters(),
    project,
    tab,
    ...(child ? { child } : {}),
    ...(from ? { from } : {}),
    ...(notice ? { notice } : {}),
  };
}
