import {icon, toast} from './ui.js';
import * as tasks from './tasks.js';
import * as pages from './pages.js';

/* ---- 导航契约（R02-01／N-01／N-02／U-02）---- */

const NAV = {
  production: [
    {key:'tasks', label:'任务', icon:'tasks'},
    {key:'projects', label:'项目', icon:'folder'},
    {key:'presets', label:'预制', icon:'preset'},
    {key:'templates', label:'模板', icon:'template'}
  ],
  training: [
    {key:'tasks', label:'任务', icon:'tasks'},
    {key:'projects', label:'项目', icon:'folder'},
    {key:'presets', label:'预制', icon:'preset'},
    {key:'templates', label:'模板', icon:'template'}
  ],
  tools: [
    {key:'models', label:'模型', icon:'models'},
    {key:'monitor', label:'监控与日志', icon:'monitor'},
    {key:'settings', label:'设置', icon:'settings'}
  ]
};

const MODULES = {
  production: {label:'生产', icon:'image'},
  training: {label:'训练', icon:'flask'}
};

const THEME_KEY = 'app-prototype-theme';
const ROUTE_KEY = 'app-prototype-last-route';

/* ---- 状态 ---- */

let module = 'production'; // 工作模式上下文；全局工具页保留最近选择
let route = {group:'production', key:'tasks'};

let theme = localStorage.getItem(THEME_KEY);
if(!['system','light','dark'].includes(theme)) theme = 'system';
const systemLight = matchMedia('(prefers-color-scheme: light)');

function resolvedTheme(){
  return theme === 'system' ? (systemLight.matches ? 'light' : 'dark') : theme;
}

function applyTheme(){
  document.body.dataset.theme = resolvedTheme();
}

function setTheme(next){
  theme = next;
  localStorage.setItem(THEME_KEY, theme);
  applyTheme();
  render();
}

systemLight.addEventListener('change', () => {
  if(theme === 'system') applyTheme();
});

/* ---- 路由 ---- */

function parseHash(){
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if(parts.length < 2) return null;
  const [group, key] = parts;
  if((group === 'production' || group === 'training') && NAV[group].some(i => i.key === key)) return {group, key};
  if(group === 'tools' && NAV.tools.some(i => i.key === key)) return {group, key};
  return null;
}

function isValidRoute(r){
  if(!r) return false;
  if(r.group === 'tools') return NAV.tools.some(i => i.key === r.key);
  if(r.group === 'production' || r.group === 'training') return NAV[r.group].some(i => i.key === r.key);
  return false;
}

function defaultRoute(){
  const saved = localStorage.getItem(ROUTE_KEY);
  const r = saved ? {group:saved.split('/')[0], key:saved.split('/')[1]} : null;
  return isValidRoute(r) ? r : {group:'production', key:'tasks'};
}

function routePath(r){
  return `#/${r.group}/${r.key}`;
}

function navigate(r){
  if(location.hash === routePath(r)) return;
  location.hash = routePath(r);
}

function onHashChange(){
  const r = parseHash();
  if(!r){
    location.replace(routePath(defaultRoute()));
    return;
  }
  if(detail.open) tasks.closeDetail();
  if(toolsSheet.open) toolsSheet.close();
  if(r.group !== 'tools') module = r.group;
  route = r;
  localStorage.setItem(ROUTE_KEY, `${r.group}/${r.key}`);
  render();
}

/* ---- 渲染 ---- */

const app = document.querySelector('#app');
const detail = document.querySelector('#detail');
const toolsSheet = document.querySelector('#tools');

function isTools(){
  return route.group === 'tools';
}

function navItems(group, active){
  return NAV[group].map(i => {
    const current = active && i.key === route.key;
    return `<a href="#/${group}/${i.key}" class="nav-item ${current ? 'active' : ''}"${current ? ' aria-current="page"' : ''}>${icon(i.icon)}<span>${i.label}</span></a>`;
  }).join('');
}

function themeControl(){
  return `<div class="theme-switch" role="group" aria-label="外观">${[['system','跟随系统'],['light','浅色'],['dark','深色']].map(([value,label]) =>
    `<button type="button" data-theme-choice="${value}" aria-pressed="${theme === value}">${label}</button>`).join('')}</div>`;
}

function sidebar(){
  return `<aside class="sidebar">
    <div class="brand"><span class="brand-icon">${icon('layers')}</span><span>ComfyUI <strong>Manager</strong></span></div>
    <div class="mode-switch" role="group" aria-label="工作模式">${['production','training'].map(m =>
      `<button type="button" data-mode="${m}" aria-pressed="${module === m}">${icon(MODULES[m].icon)}<span>${MODULES[m].label}</span></button>`).join('')}</div>
    <nav class="sidebar-nav" aria-label="${MODULES[module].label}模块">${navItems(module, !isTools() && route.group === module)}</nav>
    <div class="nav-group">
      <div class="nav-group-label">全局工具</div>
      <nav class="sidebar-nav" aria-label="全局工具">${navItems('tools', isTools())}</nav>
    </div>
    <div class="sidebar-bottom">${themeControl()}</div>
  </aside>`;
}

function toolsSheetContent(){
  return `<div class="dialog-header"><h2>全局工具</h2><button type="button" class="button icon-only subtle" data-action="close-tools" aria-label="关闭全局工具">${icon('close')}</button></div>
    <div class="dialog-content"><nav class="sheet-nav" aria-label="全局工具">${navItems('tools', isTools())}</nav>${themeControl()}</div>`;
}

function bottomNav(){
  const other = module === 'production' ? 'training' : 'production';
  return `<nav class="bottom-nav" aria-label="主导航">
    <button type="button" class="nav-item mode-toggle" data-mode-toggle aria-label="当前模式：${MODULES[module].label}，点击切换到${MODULES[other].label}">${icon(MODULES[module].icon)}<span>${MODULES[module].label}</span></button>
    ${navItems(module, !isTools() && route.group === module)}
    <button type="button" class="nav-item ${isTools() ? 'active' : ''}" data-action="open-tools">${icon('grid')}<span>工具</span></button>
  </nav>`;
}

function pageTitle(){
  if(isTools()) return NAV.tools.find(i => i.key === route.key).label;
  return `${MODULES[route.group].label}${NAV[route.group].find(i => i.key === route.key).label}`;
}

function content(){
  let body, topRight = '';
  if(isTools()){
    body = pages.render(route.group, route.key, {themePreference: theme});
  } else if(route.key === 'tasks'){
    body = tasks.render(route.group === 'production' ? 'generation' : 'training');
    topRight = `<span class="connection"><span class="status-dot"></span>ComfyUI 已连接</span>`;
  } else {
    body = pages.render(route.group, route.key, {themePreference: theme});
  }
  const page = route.key === 'tasks' ? 'tasks' : 'light';
  return {body, topRight, page};
}

function render(){
  const {body, topRight, page} = content();
  toolsSheet.innerHTML = toolsSheetContent();
  app.innerHTML = `<div class="app-shell">${sidebar()}<main><header class="topbar"><h1>${pageTitle()}</h1>${topRight ? `<div class="topbar-right">${topRight}</div>` : ''}</header><div class="workspace" id="content" data-page="${page}">${body}</div></main></div>${bottomNav()}`;
}

/* ---- 事件 ---- */

document.addEventListener('click', e => {
  const modeButton = e.target.closest('[data-mode]');
  if(modeButton){
    navigate({group: modeButton.dataset.mode, key: 'tasks'});
    return;
  }
  const modeToggle = e.target.closest('[data-mode-toggle]');
  if(modeToggle){
    navigate({group: module === 'production' ? 'training' : 'production', key: 'tasks'});
    return;
  }
  const themeButton = e.target.closest('[data-theme-choice]');
  if(themeButton){
    setTheme(themeButton.dataset.themeChoice);
    return;
  }
  if(e.target.closest('[data-action="open-tools"]')){
    toolsSheet.showModal();
    return;
  }
  if(e.target.closest('[data-action="close-tools"]')){
    toolsSheet.close();
  }
});

toolsSheet.addEventListener('click', e => {
  if(e.target === toolsSheet){
    toolsSheet.close();
  }
});

window.addEventListener('hashchange', onHashChange);

/* ---- 启动（N-01：无有效导航时回到生产任务）---- */

applyTheme();
const initial = parseHash();
if(initial){
  if(initial.group !== 'tools') module = initial.group;
  route = initial;
  localStorage.setItem(ROUTE_KEY, `${initial.group}/${initial.key}`);
  render();
} else {
  location.replace(routePath(defaultRoute()));
}
