import {icon, escapeHtml as esc} from './ui.js';
import {productionProjects, trainingProjects, productionPresets, trainingPresets, productionTemplates, trainingTemplates, models, monitorStatus, logEntries} from './data.js';

function heading(title){
  return `<div class="section-heading"><h2>${title}</h2></div>`;
}

function table(head, rows){
  return `<div class="history-table"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function dlGrid(items){
  return `<dl class="dl-grid">${items.map(([label,value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}

export function projects(module){
  const list = module === 'production' ? productionProjects : trainingProjects;
  const head = module === 'production' ? ['项目','最近更新','活动任务','待审图片'] : ['项目','最近更新','活动任务'];
  const rows = list.map(p => {
    const cells = [
      `<span class="row-title">${esc(p.name)}</span>${p.archived ? ' <span class="badge">归档</span>' : ''}`,
      `<span class="muted">${esc(p.updated)}</span>`,
      `<span class="mono">${p.active}</span>`
    ];
    if(module === 'production') cells.push(`<span class="mono">${p.review}</span>`);
    return cells;
  });
  return `<section class="panel">${heading(`项目 <span class="muted">${list.length}</span>`)}${table(head, rows)}</section>`;
}

export function presets(module){
  const list = module === 'production' ? productionPresets : trainingPresets;
  const head = ['名称','所属组','更新时间'];
  const rows = list.map(p => [
    `<span class="row-title">${esc(p.name)}</span>`,
    `<span class="muted">${esc(p.group)}</span>`,
    `<span class="muted">${esc(p.updated)}</span>`
  ]);
  return `<section class="panel">${heading(`预制 <span class="muted">${list.length}</span>`)}${table(head, rows)}</section>`;
}

export function templates(module){
  const list = module === 'production' ? productionTemplates : trainingTemplates;
  const head = ['名称','来源','更新时间'];
  const rows = list.map(t => [
    `<span class="row-title">${esc(t.name)}</span>`,
    `<span class="muted">${esc(t.source)}</span>`,
    `<span class="muted">${esc(t.updated)}</span>`
  ]);
  return `<section class="panel">${heading(`模板 <span class="muted">${list.length}</span>`)}${table(head, rows)}</section>`;
}

export function modelsPage(){
  const head = ['名称','类型','大小','状态'];
  const rows = models.map(m => [
    `<span class="row-title">${esc(m.name)}</span>`,
    `<span class="muted">${esc(m.type)}</span>`,
    `<span class="mono">${esc(m.size)}</span>`,
    `<span class="badge ${m.missing ? 'failed' : 'done'}"><span class="status-dot" aria-hidden="true"></span>${m.missing ? '缺失' : '已登记'}</span>`
  ]);
  return `<section class="panel">${heading(`模型 <span class="muted">${models.length}</span>`)}${table(head, rows)}</section>`;
}

export function monitor(){
  const status = dlGrid([
    ['检查时间', `<span class="mono">${monitorStatus.checkedAt}</span>`],
    ['ComfyUI', `<span class="connection"><span class="status-dot"></span>${monitorStatus.comfy}</span>`],
    ['GPU 使用', `<span class="mono">${monitorStatus.gpu}</span>`],
    ['运行中任务', `<span class="mono">${monitorStatus.running}</span>`],
    ['已提交任务', `<span class="mono">${monitorStatus.submitted}</span>`]
  ]);
  const logHead = ['时间','级别','事件','目标'];
  const logRows = logEntries.map(l => [
    `<span class="mono">${l.time}</span>`,
    l.level === 'error' ? '<span class="badge failed"><span class="status-dot" aria-hidden="true"></span>错误</span>' : '<span class="badge">信息</span>',
    `<span>${esc(l.message)}</span>`,
    `<span class="muted">${esc(l.target)}</span>`
  ]);
  return `<section class="panel">${heading('当前执行状态')}${status}</section><section class="panel">${heading(`最近日志 <span class="muted">${logEntries.length}</span>`)}${table(logHead, logRows)}</section>`;
}

export function settings(ctx){
  const themeLabel = ctx.themePreference === 'system' ? '跟随系统' : ctx.themePreference === 'light' ? '浅色' : '深色';
  const groups = [
    ['共享', [
      ['外观', themeLabel],
      ['唯一执行目标', '本机']
    ]],
    ['生产', [
      ['ComfyUI API 地址', '<span class="mono">http://127.0.0.1:8188</span>'],
      ['数据根', '<span class="mono">D:\\ComfyUI</span>'],
      ['导出目录', '<span class="mono">D:\\Exports</span>']
    ]],
    ['训练', [
      ['Python 路径', '<span class="mono">C:\\Python311\\python.exe</span>'],
      ['训练数据根', '<span class="mono">D:\\TrainingData</span>'],
      ['计算精度', '<span class="mono">bf16</span>']
    ]]
  ];
  return groups.map(([title, items]) => `<section class="panel">${heading(title)}${dlGrid(items)}</section>`).join('');
}

export function render(group, key, ctx = {}){
  if(group === 'tools'){
    if(key === 'models') return modelsPage();
    if(key === 'monitor') return monitor();
    if(key === 'settings') return settings(ctx);
  }
  if(key === 'projects') return projects(group);
  if(key === 'presets') return presets(group);
  if(key === 'templates') return templates(group);
  return `<section class="panel"><div class="empty-state">${icon('search')}<h3>页面不存在</h3></div></section>`;
}
