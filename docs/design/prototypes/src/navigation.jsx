import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { SelectButton } from 'primereact/selectbutton';
import { Toast } from 'primereact/toast';
import { PrototypeProvider } from './prototype-provider.jsx';
import { usePrototypePreference, themeOptions } from './use-prototype-preference.jsx';
import './prototype-layout.css';
import './navigation.css';

const storageKey = 'cm-navigation-preview-v1';
const sections = [
  { id: 'projects', label: '项目', icon: 'pi-folder' },
  { id: 'tasks', label: '任务', icon: 'pi-list' },
  { id: 'presets', label: '预制', icon: 'pi-sliders-h' },
  { id: 'templates', label: '模板', icon: 'pi-clone' },
];
const modules = [{ id: 'production', label: '生产', icon: 'pi pi-image' }, { id: 'training', label: '训练', icon: 'pi pi-microchip-ai' }];
const tools = [
  { id: 'models', label: '模型', icon: 'pi-box' },
  { id: 'monitoring', label: '监控与日志', icon: 'pi-desktop' },
  { id: 'settings', label: '设置', icon: 'pi-cog' },
];
const routes = [
  ...modules.flatMap(module => sections.map(section => ({ key: `${module.id}/${section.id}`, module: module.id, section: section.id, label: section.label, title: `${module.label} · ${section.label}` }))),
  ...tools.map(tool => ({ key: `global/${tool.id}`, section: tool.id, label: tool.label, title: tool.label })),
];
const routeFor = key => routes.find(route => route.key === key);
const defaultNavigation = () => ({ route: 'production/tasks', activeModule: 'production', last: { production: 'tasks', training: 'tasks' } });
function readNavigation() {
  let state = defaultNavigation();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && routeFor(saved.route) && modules.some(module => module.id === saved.activeModule)) {
      state = { ...state, route: saved.route, activeModule: saved.activeModule };
      for (const module of modules) if (sections.some(section => section.id === saved.last?.[module.id])) state.last[module.id] = saved.last[module.id];
    }
  } catch { /* Navigation remains usable when storage is unavailable. */ }
  if (location.hash) state.route = routeFor(location.hash.slice(1))?.key ?? 'production/tasks';
  const route = routeFor(state.route);
  if (route.module) { state.activeModule = route.module; state.last[route.module] = route.section; }
  return state;
}
function useMedia(query) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => { const media = matchMedia(query); const update = () => setMatches(media.matches); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, [query]);
  return matches;
}
function App() {
  const [navigation, setNavigation] = useState(readNavigation);
  const [manualCollapsed, setManualCollapsed] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const narrow = useMedia('(width < 1200px)');
  const collapsed = manualCollapsed ?? narrow;
  const { preference, updatePreference } = usePrototypePreference();
  const main = useRef(null);
  const toast = useRef(null);
  const route = routeFor(navigation.route);
  const moduleLabel = modules.find(module => module.id === navigation.activeModule).label;

  useEffect(() => {
    if (location.hash.slice(1) !== navigation.route) history.replaceState(null, '', `#${navigation.route}`);
    const onHashChange = () => {
      const next = routeFor(location.hash.slice(1)) ?? routeFor('production/tasks');
      if (location.hash.slice(1) !== next.key) history.replaceState(null, '', `#${next.key}`);
      setNavigation(current => ({ route: next.key, activeModule: next.module ?? current.activeModule, last: next.module ? { ...current.last, [next.module]: next.section } : current.last }));
      setMoreOpen(false);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(navigation)); } catch { /* Keep this session usable. */ } }, [navigation]);
  useEffect(() => { updatePreference('module', navigation.activeModule === 'production' ? 'image' : 'training'); }, [navigation.activeModule]);

  function navigate(key) { setMoreOpen(false); if (location.hash.slice(1) !== key) location.hash = key; }
  function resetVisit() {
    const initial = defaultNavigation();
    setNavigation(initial); setManualCollapsed(null); setMoreOpen(false); setPreviewOpen(false);
    history.replaceState(null, '', '#production/tasks');
    toast.current.show({ severity: 'info', summary: '已回到首次访问状态', detail: '默认进入生产任务。', life: 2600 });
  }
  function demonstrateLogout() {
    setMoreOpen(false);
    toast.current.show({ severity: 'info', summary: '退出登录入口', detail: '这是导航预览，未改变登录状态。', life: 3000 });
  }
  const moduleSwitch = (iconOnly = false) => <div className="nav-module-switch" role="group" aria-label="切换业务模块">{modules.map(module => <Button key={module.id} label={iconOnly ? undefined : module.label} icon={iconOnly ? module.icon : undefined} aria-label={module.label} title={iconOnly ? module.label : undefined} className="nav-module-button" text={navigation.activeModule !== module.id} plain={navigation.activeModule !== module.id} aria-pressed={navigation.activeModule === module.id} onClick={() => navigate(`${module.id}/${navigation.last[module.id]}`)} />)}</div>;
  function navigationLink(item, key, mobile = false) {
    const active = navigation.route === key;
    return <a key={key} href={`#${key}`} className={`${mobile ? 'nav-tab' : 'nav-item'}${active ? ' is-active' : ''}`} aria-label={item.label} aria-current={active ? 'page' : undefined} title={item.label} onClick={() => setMoreOpen(false)}>
      <i className={`pi ${item.icon}`} aria-hidden="true" /><span className="nav-item-label">{item.label}</span>{active && !mobile && <i className="pi pi-check nav-current-mark" aria-hidden="true" />}
    </a>;
  }
  const businessLinks = sections.map(section => navigationLink(section, `${navigation.activeModule}/${section.id}`));
  const globalLinks = tools.map(tool => navigationLink(tool, `global/${tool.id}`));

  return <div className="navigation-preview">
    <Toast ref={toast} position="bottom-center" />
    <a className="skip-link" href="#navigation-main" onClick={event => { event.preventDefault(); main.current?.focus(); }}>跳到主内容</a>
    <div className="nav-review-bar"><span>R02-01 · 导航外壳</span><a href="../../reviews/R02-01.md">任务说明</a><Button text icon="pi pi-sliders-h" aria-label="打开导航预览设置" aria-haspopup="dialog" onClick={() => setPreviewOpen(true)} /></div>
    <div className={`nav-layout${collapsed ? ' is-collapsed' : ''}`}>
      <aside className="nav-sidebar" id="desktop-sidebar-navigation" aria-label="应用侧栏">
        <div className="nav-brand" aria-label="ComfyUI Manager"><span className="nav-brand-full">ComfyUI <span>Manager</span></span><span className="nav-brand-short" aria-hidden="true">CM</span></div>
        {moduleSwitch(collapsed)}
        <nav className="nav-primary" aria-label={`${moduleLabel}主导航`}>{businessLinks}</nav>
        <div className="nav-sidebar-bottom"><span className="nav-group-label">全局工具</span><nav aria-label="全局工具">{globalLinks}</nav>
          <Button text className="nav-logout" icon="pi pi-sign-out" label={collapsed ? undefined : '退出登录'} aria-label="退出登录" title="退出登录" onClick={demonstrateLogout} />
          <div className="nav-collapse-row"><Button text icon={collapsed ? 'pi pi-angle-double-right' : 'pi pi-angle-double-left'} label={collapsed ? undefined : '收起侧栏'} aria-label={collapsed ? '展开侧栏' : '收起侧栏'} aria-expanded={!collapsed} aria-controls="desktop-sidebar-navigation" onClick={() => setManualCollapsed(!collapsed)} /></div>
        </div>
      </aside>
      <div className="nav-workspace">
        <header className="nav-mobile-header"><span className="nav-mobile-brand">ComfyUI</span>{moduleSwitch()}<Button text icon="pi pi-ellipsis-h" className={!route.module ? 'nav-more-active' : ''} aria-label="更多全局工具" aria-expanded={moreOpen} aria-haspopup="dialog" onClick={() => setMoreOpen(true)} /></header>
        <div className="nav-page-heading"><h1 aria-live="polite">{route.title}</h1>{!route.module && <span className="nav-global-label">全局工具</span>}<span className="nav-preview-label">导航预览</span></div>
        <main ref={main} id="navigation-main" className="nav-main" tabIndex={-1}>
          <section className="nav-content-placeholder" aria-label="业务内容占位"><div className="nav-placeholder-copy"><i className="pi pi-window-maximize" aria-hidden="true" /><h2>{route.title}内容区</h2><p>此处用于检查导航位置与可用空间。<br />业务内容将在对应任务中单独设计。</p></div></section>
        </main>
      </div>
    </div>
    <nav className="nav-mobile-tabs" aria-label={`${moduleLabel}底部导航`}>{sections.map(section => navigationLink(section, `${navigation.activeModule}/${section.id}`, true))}</nav>
    <Dialog visible={moreOpen} onHide={() => setMoreOpen(false)} position="right" header="更多" className="nav-more-sidebar" draggable={false} resizable={false} dismissableMask blockScroll>
      <p className="nav-more-description">全局工具</p><nav className="nav-more-links" aria-label="更多中的全局工具">{globalLinks}</nav><div className="nav-more-footer"><Button text icon="pi pi-sign-out" label="退出登录" onClick={demonstrateLogout} /></div>
    </Dialog>
    <Dialog header="导航预览设置" visible={previewOpen} onHide={() => setPreviewOpen(false)} className="nav-preview-dialog" draggable={false} blockScroll footer={<Button label="完成" onClick={() => setPreviewOpen(false)} />}>
      <div className="nav-preview-fields"><div><span id="nav-theme-label">主题</span><SelectButton value={preference.theme} options={themeOptions} onChange={event => updatePreference('theme', event.value)} aria-labelledby="nav-theme-label" allowEmpty={false} /></div><p>桌面侧栏可收放；窄屏默认收起。手机保留顶部模块切换与底部四入口。</p><Button outlined icon="pi pi-refresh" label="模拟首次访问" onClick={resetVisit} /><a href="../../ui-design-shared-plan.md">查看 R02-01 任务范围</a></div>
    </Dialog>
  </div>;
}
createRoot(document.getElementById('root')).render(<PrototypeProvider><App /></PrototypeProvider>);
