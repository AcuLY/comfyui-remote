import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from 'primereact/button';
import { BreadCrumb } from 'primereact/breadcrumb';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { TabMenu } from 'primereact/tabmenu';
import { PrototypeProvider } from './prototype-provider.jsx';
import { NavigationShell } from './navigation-shell.jsx';
import { childrenFor, filterProjects, listKey, projectKey, projects, projectTabs, resolveContextRoute } from './project-context-model.mjs';
import './project-context.css';

const memoryKey = 'cm-project-context-preview-v1';
const moduleLabels = { production: '生产', training: '训练' };
const statusOptions = [{ label: '全部项目', value: 'all' }, { label: '进行中', value: 'active' }, { label: '已归档', value: 'archived' }];
function readMemory() {
  const initial = { current: '', activeModule: 'production', scroll: {}, expanded: {}, lastLists: {}, focus: {} };
  try {
    const saved = JSON.parse(sessionStorage.getItem(memoryKey) || '{}');
    return { ...initial, ...saved, scroll: saved.scroll || {}, expanded: saved.expanded || {}, lastLists: saved.lastLists || {}, focus: saved.focus || {} };
  } catch { return initial; }
}
function saveMemory(memory) {
  try { sessionStorage.setItem(memoryKey, JSON.stringify(memory)); } catch { /* The current navigation still works without storage. */ }
}
function plainActivation(event) {
  return !event.defaultPrevented && (event.button == null || event.button === 0) && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function useContextNavigation() {
  const [memory] = useState(readMemory);
  const [route, setRoute] = useState(() => resolveContextRoute(location.hash || memory.current));
  const current = useRef(route);
  const restoring = useRef(false);
  const previousRoute = useRef(null);
  const [expanded, setExpanded] = useState(memory.expanded);

  function captureScroll() {
    if (!restoring.current) memory.scroll[current.current.key] = window.scrollY;
    saveMemory(memory);
  }
  function apply(next) {
    restoring.current = true;
    current.current = next;
    memory.current = next.key;
    if (next.module) memory.activeModule = next.module;
    if (next.kind === 'list') memory.lastLists[next.rootKey] = next.key;
    saveMemory(memory);
    setRoute(next);
  }
  function go(key, { replace = false, focusProject } = {}) {
    if (focusProject) memory.focus[current.current.key] = focusProject;
    captureScroll();
    const next = resolveContextRoute(key);
    if (location.hash !== `#${next.key}`) history[replace ? 'replaceState' : 'pushState'](null, '', `#${next.key}`);
    apply(next);
  }
  function follow(event, key, options) {
    if (!plainActivation(event)) return;
    event.preventDefault();
    go(key, options);
  }
  function toggleExpanded(project) {
    const key = `${project.module}/${project.id}`;
    const next = { ...expanded, [key]: !expanded[key] };
    memory.expanded = next;
    saveMemory(memory);
    setExpanded(next);
  }
  function reset() {
    memory.scroll = {}; memory.expanded = {}; memory.lastLists = {}; memory.focus = {};
    setExpanded({});
    // Do not save the outgoing sample's scroll into a freshly reset store.
    const next = resolveContextRoute('production/projects');
    history.replaceState(null, '', `#${next.key}`);
    apply(next);
  }
  useLayoutEffect(() => {
    const next = current.current;
    if (location.hash !== `#${next.key}`) history.replaceState(null, '', `#${next.key}`);
    memory.current = next.key;
    if (next.module) memory.activeModule = next.module;
    if (next.kind === 'list') memory.lastLists[next.rootKey] = next.key;
    const top = Number(memory.scroll[next.key]) || 0;
    window.scrollTo({ top, behavior: 'instant' });
    restoring.current = false;
    const previous = previousRoute.current;
    if (next.kind === 'list' && (!previous || previous.kind !== 'list') && memory.focus[next.key]) {
      document.querySelector(`[data-project-link="${memory.focus[next.key]}"]`)?.focus({ preventScroll: true });
    }
    if (previous && next.project && next.project.id !== previous.project?.id) document.querySelector('.ctx-title-row h1')?.focus({ preventScroll: true });
    previousRoute.current = next;
    saveMemory(memory);
  }, [route]);
  useEffect(() => {
    const previousRestoration = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    const onHistory = () => {
      const next = resolveContextRoute(location.hash);
      if (next.key === current.current.key && !next.notice) return;
      captureScroll();
      apply(next);
    };
    window.addEventListener('popstate', onHistory);
    window.addEventListener('hashchange', onHistory);
    window.addEventListener('scroll', captureScroll, { passive: true });
    window.addEventListener('pagehide', captureScroll);
    return () => {
      window.removeEventListener('popstate', onHistory);
      window.removeEventListener('hashchange', onHistory);
      window.removeEventListener('scroll', captureScroll);
      window.removeEventListener('pagehide', captureScroll);
      history.scrollRestoration = previousRestoration;
    };
  }, []);
  return { route, memory, expanded, go, follow, toggleExpanded, reset };
}

function SourceList({ navigation }) {
  const { route, go, follow, expanded, toggleExpanded } = navigation;
  const [query, setQuery] = useState(route.filters.q);
  useEffect(() => { setQuery(route.filters.q); }, [route.key]);
  const matches = filterProjects(route.module, route.filters);
  const isTasks = route.section === 'tasks';
  function applyFilters(event) {
    event.preventDefault();
    go(listKey(route.module, route.section, { ...route.filters, q: query }), { replace: true });
  }
  return <section className="ctx-source" aria-label={isTasks ? '任务来源样本' : '项目来源样本'}>
    <div className="ctx-list-heading"><p>导航样本 · 模拟数据</p><span>{matches.length} 个{isTasks ? '任务来源' : '项目'}</span></div>
    <form className="ctx-filters" onSubmit={applyFilters} aria-label="筛选导航样本">
      <div className="ctx-search"><InputText value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索项目名称" aria-label="搜索项目名称" /><Button type="submit" icon="pi pi-search" aria-label="搜索" /></div>
      <Dropdown value={route.filters.status} options={statusOptions} onChange={event => go(listKey(route.module, route.section, { q: query, status: event.value }), { replace: true })} aria-label="项目状态" />
      {(route.filters.q || route.filters.status !== 'all') && <Button type="button" text label="清除筛选" onClick={() => { setQuery(''); go(listKey(route.module, route.section), { replace: true }); }} />}
    </form>
    {matches.length ? <ul className="ctx-records">{matches.map((project, index) => {
      const key = `${project.module}/${project.id}`;
      const open = !!expanded[key];
      const href = projectKey(project, isTasks ? 'tasks' : 'overview', route.key);
      return <li key={key} className="ctx-record">
        <div className="ctx-record-row">
          <span className="ctx-record-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <a className="ctx-project-link" href={`#${href}`} data-project-link={project.id} onClick={event => follow(event, href, { focusProject: project.id })}><strong>{project.name}</strong><span>{isTasks ? '查看所属项目的任务视图' : project.summary}</span></a>
          <span className="ctx-record-state">{project.state === 'archived' ? '已归档' : '进行中'}</span>
          <Button text plain icon={open ? 'pi pi-angle-up' : 'pi pi-angle-down'} aria-label={`${open ? '收起' : '展开'} ${project.name} 的摘要`} aria-expanded={open} aria-controls={`summary-${project.id}`} onClick={() => toggleExpanded(project)} />
        </div>
        {open && <div className="ctx-record-summary" id={`summary-${project.id}`}>{projectTabs[project.module].map(tab => tab.label).join(' · ')}</div>}
      </li>;
    })}</ul> : <div className="ctx-empty"><p>没有匹配的导航样本</p><Button text label="清除筛选" onClick={() => { setQuery(''); go(listKey(route.module, route.section), { replace: true }); }} /></div>}
    <p className="ctx-footnote">列表仅用于检查进入、返回和位置恢复，业务列表在对应任务中设计。</p>
  </section>;
}

function ProjectView({ navigation }) {
  const { route, go, follow } = navigation;
  const tabs = projectTabs[route.module];
  const index = tabs.findIndex(tab => tab.id === route.tab);
  const tabLabel = tabs[index].label;
  const childTab = route.module === 'production' ? 'sections' : 'compositions';
  const items = tabs.map(tab => ({ id: tab.id, label: tab.label, url: `#${projectKey(route.project, tab.id, route.from)}` }));
  function changeTab({ originalEvent, index: nextIndex }) {
    if (!plainActivation(originalEvent)) return;
    originalEvent.preventDefault();
    go(projectKey(route.project, tabs[nextIndex].id, route.from));
  }
  return <section className={`ctx-project-view ctx-${route.module}`} aria-label="项目上下文">
    <TabMenu className="ctx-tabs" model={items} activeIndex={index} onTabChange={changeTab} pt={{
      menu: { className: 'ctx-tab-list', 'aria-label': `${moduleLabels[route.module]}项目页签`, style: { background: 'transparent', padding: 0 } },
      action: ({ context }) => ({ 'aria-current': context.index === index ? 'page' : undefined, style: { padding: '12px 16px', minHeight: '44px', fontWeight: 500, justifyContent: 'center', background: 'transparent', color: context.index === index ? 'var(--accent)' : 'var(--nav-secondary)', borderColor: context.index === index ? 'var(--accent)' : 'var(--nav-border)', transition: 'color var(--duration-quick) var(--ease-out), border-color var(--duration-quick) var(--ease-out)' } }),
      label: { style: { whiteSpace: 'nowrap' } },
    }} />
    <div className="ctx-view-body">
      {route.kind === 'child' ? <><a className="ctx-inline-back" href={`#${projectKey(route.project, childTab, route.from)}`} onClick={event => follow(event, projectKey(route.project, childTab, route.from))}><i className="pi pi-arrow-left" aria-hidden="true" />返回{tabLabel}</a><div className="ctx-placeholder"><i className="pi pi-window-maximize" aria-hidden="true" /><h2>{route.child.name}</h2><p>此处保留{route.module === 'production' ? '小节' : '构图'}内容的位置。</p></div></> : <>
        <div className="ctx-view-heading"><h2>{tabLabel}</h2>{route.tab === 'tasks' && <span>仅当前项目</span>}</div>
        {route.tab === childTab ? <ul className="ctx-child-list">{childrenFor(route.project).map(child => { const href = projectKey(route.project, childTab, route.from, child.id); return <li key={child.id}><a href={`#${href}`} onClick={event => follow(event, href)}><i className={route.module === 'production' ? 'pi pi-folder' : 'pi pi-image'} aria-hidden="true" /><span>{child.name}</span><i className="pi pi-angle-right" aria-hidden="true" /></a></li>; })}</ul> : <div className="ctx-placeholder"><i className="pi pi-window-maximize" aria-hidden="true" /><p>{route.project.name} · {tabLabel}</p><small>本轮只设计导航与上下文，业务内容将在对应任务中展开。</small></div>}
      </>}
    </div>
  </section>;
}

function App() {
  const navigation = useContextNavigation();
  const { route, memory, go, follow, reset } = navigation;
  const activeModule = route.module || memory.activeModule;
  const project = route.project;
  const returnKey = project ? route.from || listKey(route.module) : null;
  const returnIsTasks = returnKey && resolveContextRoute(returnKey).section === 'tasks';
  const projectListKey = project ? memory.lastLists[`${route.module}/projects`] || listKey(route.module) : null;
  const crumbs = project ? [
    { label: moduleLabels[route.module], url: `#${route.module}/tasks`, command: ({ originalEvent }) => follow(originalEvent, `${route.module}/tasks`) },
    { label: '项目', url: `#${projectListKey}`, command: ({ originalEvent }) => follow(originalEvent, projectListKey) },
    { label: project.name, url: `#${projectKey(project, 'overview', route.from)}`, command: ({ originalEvent }) => follow(originalEvent, projectKey(project, 'overview', route.from)) },
    ...(route.child ? [{ label: route.child.name }] : []),
  ] : [];
  function shellNavigate(key, { originalEvent, source }) {
    originalEvent?.preventDefault();
    go(source !== 'module' ? memory.lastLists[key] || key : key);
  }
  const demoProject = project || projects.find(item => item.module === activeModule);
  const demoSource = route.from || (route.kind === 'list' ? route.key : listKey(activeModule));
  const demoPrefix = `${activeModule}/projects/${demoProject.id}`;
  const header = <header className="ctx-page-header">
    {project && <BreadCrumb model={crumbs} className="ctx-breadcrumb" aria-label="项目层级" pt={{ root: { style: { padding: 0, border: 0, background: 'transparent' } }, menu: { style: { flexWrap: 'wrap', rowGap: '8px' } }, label: { style: { display: 'block', maxWidth: '28ch', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } } }} />}
    <div className="ctx-title-row"><div><h1 tabIndex={-1}>{project ? route.child?.name || project.name : route.title}</h1>{project && <p>{moduleLabels[route.module]}项目{route.child ? ` · ${project.name}` : ''}</p>}</div>
      {project && <a className="ctx-return" href={`#${returnKey}`} onClick={event => follow(event, returnKey)}><i className="pi pi-arrow-left" aria-hidden="true" /><span>返回{returnIsTasks ? '任务' : '项目'}列表</span></a>}
    </div>
  </header>;
  const previewControls = <div className="ctx-preview-cases"><span>失效导航样本</span>
    <a href={`#${demoPrefix}/unavailable?from=${encodeURIComponent(demoSource)}`} onClick={event => follow(event, `${demoPrefix}/unavailable?from=${encodeURIComponent(demoSource)}`)}>无效页签 → 项目概览</a>
    <a href={`#${demoPrefix}/${activeModule === 'production' ? 'sections' : 'compositions'}/missing?from=${encodeURIComponent(demoSource)}`} onClick={event => follow(event, `${demoPrefix}/${activeModule === 'production' ? 'sections' : 'compositions'}/missing?from=${encodeURIComponent(demoSource)}`)}>无效{activeModule === 'production' ? '小节' : '构图'} → 所属项目</a>
    <a href={`#${activeModule}/projects/missing/overview?from=${encodeURIComponent(demoSource)}`} onClick={event => follow(event, `${activeModule}/projects/missing/overview?from=${encodeURIComponent(demoSource)}`)}>无效项目 → 同模块项目列表</a>
  </div>;
  return <NavigationShell route={route} activeModule={activeModule} onNavigate={shellNavigate} header={header} className="project-context-preview" contentClassName="ctx-main" reviewLabel="R02-02 · 项目上下文" reviewHref="../../reviews/R02-02.md" previewTitle="项目导航预览设置" previewControls={previewControls} onReset={reset} resetLabel="重置导航样本">
    {route.notice && <div className="ctx-route-notice"><Message severity="warn" text={route.notice} /></div>}
    {route.kind === 'list' ? <SourceList navigation={navigation} /> : project ? <ProjectView navigation={navigation} /> : <section className="ctx-empty"><h2>{route.title}</h2><p>此入口保留全局导航位置，内容不在本轮设计范围。</p><a href={`#${listKey(activeModule)}`} onClick={event => follow(event, listKey(activeModule))}>打开项目导航样本</a></section>}
  </NavigationShell>;
}

createRoot(document.getElementById('root')).render(<PrototypeProvider><App /></PrototypeProvider>);
