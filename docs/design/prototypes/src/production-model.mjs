// Independent browser-session data for the production design prototype.
// Every record and generated result below is illustrative, never production data.
export const productionSessionKey = 'cm-production-demo-layout-v1';
export const defaultParams = { aspectRatio: '2:3', shortSidePx: 768, width: 768, height: 1152, upscaleFactor: 2, steps: 28, cfg: 6.5, sampler: 'dpmpp_2m', scheduler: 'karras', seed: -1, seedPolicy: 'fixed', batchSize: 4, secondEnabled: true, secondSteps: 16, secondCfg: 5, secondSampler: 'dpmpp_2m_sde', secondScheduler: 'karras', denoise: 0.35 };
export function createProductionSeed(library = {}) {
  const projects = [
    { id: 'p01', name: '雨后街角', description: '街道、人物与光线的系列画面。', folderId: '', archived: false },
    { id: 'p02', name: '窗边日光', description: '自然光下的室内场景。', folderId: '', archived: false },
    { id: 'p03', name: '城市漫游', description: '用于检查文件夹与跨项目任务。', folderId: 'pf01', archived: false },
    { id: 'p04', name: '夏日留影', description: '已归档的作品，只保留结果供浏览与交付。', folderId: '', archived: true },
  ].map(p => ({ ...p, slug: { p01: 'rainy-street', p02: 'window-light', p03: 'city-walk', p04: 'summer-memory' }[p.id], checkpoint: 'illustration-v3.safetensors', params: { ...defaultParams }, presetIds: [], updatedAt: '2026-09-14 16:20' }));
  const sectionNames = ['街角远景', '人物与服饰', '窗边近景', '光线与细节', '雨后倒影', '傍晚的街道与远处亮起的窗灯'];
  const sections = projects.flatMap((p, pi) => sectionNames.map((name, index) => ({
    id: 's' + String(pi * 6 + index + 1).padStart(2, '0'), projectId: p.id, name,
    folderId: index > 3 ? 'sf-' + p.id : '', params: { ...defaultParams, seed: 42100 + index },
    prompt: ['a quiet street after rain, soft evening light, detailed illustration', 'a person wearing a green jacket, natural pose, soft light', 'sunlight through a window, warm interior, detailed illustration'][index % 3],
    negative: 'low quality, blurry, distorted', presetIds: library.presets?.slice(0, 1).map(x => x.id) || [],
    loras: [{ id: 'lora-detail', name: 'soft-light.safetensors', weight: 0.65, stage: 1 }], history: [],
  })));
  const folders = [{ id: 'pf01', name: '场景练习', parentId: '', scope: 'projects' }, { id: 'pf02', name: '室外', parentId: 'pf01', scope: 'projects' }, ...projects.map(p => ({ id: 'sf-' + p.id, name: '细节补充', parentId: '', scope: 'sections:' + p.id }))];
  const runs = sections.map((s, index) => ({
    id: 'r' + String(index + 1).padStart(2, '0'), projectId: s.projectId, sectionId: s.id,
    status: index === 3 ? 'running' : index === 4 ? 'unsubmitted' : index === 5 ? 'submitted' : index === 8 ? 'failed' : index === 9 ? 'paused' : index === 10 ? 'cancelled' : 'completed',
    progress: index === 3 ? 58 : [4, 5].includes(index) ? 0 : 100, batchSize: 4, createdAt: '2026-09-14T08:' + String(40 - index).padStart(2, '0') + ':00Z',
    error: index === 8 ? '加载模型时显存不足。降低分辨率后可从小节重新生成，或重试当前参数。' : '',
    checkpoint: 'illustration-v3.safetensors', params: { ...s.params }, prompt: s.prompt, negative: s.negative,
    loras: structuredClone(s.loras), elapsed: [4, 5].includes(index) ? 0 : index === 3 ? 24 : 42, seed: s.params.seed,
  }));
  for (const run of runs) {
    run.attempts = run.status === 'unsubmitted' ? [] : [{
      id: run.id + '-attempt-1', index: 1, status: run.status,
      startedAt: run.createdAt, finishedAt: ['completed', 'failed', 'cancelled'].includes(run.status) ? new Date(Date.parse(run.createdAt) + 42000).toISOString() : null,
      error: run.error, elapsedMs: run.elapsed * 1000,
      stages: run.status === 'completed' ? [{ name: '首次采样', durationMs: 27000 }, { name: '放大精修', durationMs: 15000 }] : [],
    }];
  }
  const images = runs.filter(r => r.status === 'completed').flatMap((r, ri) => Array.from({ length: 4 }, (_, index) => ({
    id: 'img-' + r.id + '-' + (index + 1), projectId: r.projectId, sectionId: r.sectionId, runId: r.id,
    name: sectionNames[sections.findIndex(s => s.id === r.sectionId) % 6] + ' ' + (index + 1),
    src: '../../media/context/scene-' + ((ri + index) % 6 + 1) + '.jpg',
    review: ri < 3 && index > 0 ? 'pending' : 'kept',
    tags: index === 0 ? (ri === 0 ? ['featured', 'cover'] : ['featured']) : index === 1 ? ['preview'] : [],
    trashed: ri === 4 && index === 3, width: 832, height: 1216, seed: r.seed + index,
  })));
  // Purpose flags always imply retention, including the initial illustrative data.
  images.forEach(image => { if (image.tags.length) image.review = 'kept'; });
  const completedCensor = images.filter(image => image.projectId === 'p02' && image.tags.length && !image.trashed);
  completedCensor.forEach(image => { image.censored = true; image.censorRegions = [{ x: .35, y: .4, width: .3, height: .2 }]; });
  return { version: 1, ...library, projects, sections, folders, runs, images,
    censorJobs: [{ id: 'c01', projectId: 'p02', name: '窗边日光 · 精选图片', status: 'completed', done: completedCensor.length, total: completedCensor.length, imageIds: completedCensor.map(i => i.id), failed: 0 }], exports: [], queuePaused: false,
  };
}

export function parseProductionRoute(key = '') {
  const value = key.replace(/^#\/?/, '') || 'production/tasks';
  const [path, search = ''] = value.split('?');
  const parts = path.split('/').filter(Boolean);
  return { key: value, module: parts[0] || 'production', segments: parts.slice(1), query: Object.fromEntries(new URLSearchParams(search)) };
}

export function resolveProductionRoute(key, data) {
  const route = parseProductionRoute(key);
  if (route.module !== 'production') return route;
  const [section, id, sub, childId] = route.segments;
  const fallback = message => ({ ...parseProductionRoute('production/' + (['projects', 'tasks', 'presets', 'templates'].includes(section) ? section : 'tasks')), notice: message });
  if (!['projects', 'tasks', 'presets', 'templates'].includes(section)) return fallback('已返回任务工作台。');
  if (section === 'projects' && id && id !== 'new') {
    if (!data.projects.some(p => p.id === id)) return fallback('这个项目已不存在，已返回项目列表。');
    if (sub === 'overview') return parseProductionRoute('production/projects/' + id);
    if (sub === 'sections' && childId && childId !== 'new' && !data.sections.some(s => s.id === childId && s.projectId === id)) return { ...parseProductionRoute('production/projects/' + id), notice: '这个小节已不存在，已返回所属项目。' };
  }
  if (section === 'tasks' && id && !data.runs.some(r => r.id === id)) return fallback('这次任务已不存在，已返回任务工作台。');
  return route;
}

export function advanceSimulation(data) {
  const next = structuredClone(data);
  if (!next.queuePaused) {
    const running = next.runs.find(r => r.status === 'running');
    if (running) {
      running.attempts ||= [];
      if (!running.attempts.length) running.attempts.push({ id: running.id + '-attempt-1', index: 1, status: 'running', startedAt: new Date().toISOString(), stages: [], elapsedMs: 0 });
      const attempt = running.attempts.at(-1);
      attempt.elapsedMs = (attempt.elapsedMs || 0) + 5000;
      running.progress = Math.min(100, (running.progress || 0) + 25);
      if (running.progress === 100) {
        running.status = 'completed';
        attempt.status = 'completed'; attempt.finishedAt = new Date().toISOString();
        attempt.stages = [{ name: '演示采样', durationMs: attempt.elapsedMs }];
        for (let i = 0; i < running.batchSize; i++) next.images.push({
          id: 'img-' + running.id + '-a' + attempt.index + '-' + (i + 1), projectId: running.projectId, sectionId: running.sectionId, runId: running.id,
          src: '../../media/context/scene-' + (i % 6 + 1) + '.jpg', name: '演示输出 ' + (i + 1), review: 'pending', tags: [], trashed: false,
        });
      }
    } else {
      const waiting = next.runs.find(r => ['unsubmitted', 'submitted'].includes(r.status));
      if (waiting && !next.projects.find(p => p.id === waiting.projectId)?.archived) {
        const submitted = waiting.status === 'submitted';
        waiting.status = 'running'; waiting.progress = 0; waiting.attempts ||= [];
        if (submitted && waiting.attempts.at(-1)?.status === 'submitted') waiting.attempts.at(-1).status = 'running';
        else {
          const index = waiting.attempts.length + 1;
          waiting.attempts.push({ id: waiting.id + '-attempt-' + index, index, status: 'running', startedAt: new Date().toISOString(), error: '', stages: [], elapsedMs: 0 });
        }
      }
    }
  }
  next.censorJobs.filter(j => j.status === 'running' && !j.pauseRequested).forEach(job => {
    const image = next.images.find(item => item.id === job.imageIds?.[job.done]);
    if (image) { image.censored = true; image.censorRegions = [{ x: .35, y: .4, width: .3, height: .2 }]; }
    job.done = Math.min(job.total, job.done + 1);
    if (job.done === job.total) job.status = 'completed';
  });
  return next;
}
