import React, { useEffect, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { TabMenu } from 'primereact/tabmenu';
import { usePrototypePreference, themeOptions } from './use-prototype-preference.jsx';
import './prototype-layout.css';
import './navigation.css';

export const navigationSections = [
  { id: 'tasks', label: '任务', icon: 'pi-list' },
  { id: 'projects', label: '项目', icon: 'pi-folder' },
  { id: 'presets', label: '预制', icon: 'pi-sliders-h' },
  { id: 'templates', label: '模板', icon: 'pi-clone' },
];
export const navigationModules = [{ id: 'production', label: '生产', icon: 'pi pi-image' }, { id: 'training', label: '训练', icon: 'pi pi-microchip-ai' }];
export const navigationTools = [
  { id: 'models', label: '模型', icon: 'pi-box' },
  { id: 'monitoring', label: '监控与日志', icon: 'pi-desktop' },
  { id: 'settings', label: '设置', icon: 'pi-cog' },
];
const shellRoutes = [
  ...navigationModules.flatMap(module => navigationSections.map(section => ({ key: `${module.id}/${section.id}`, module: module.id, section: section.id, label: section.label, title: `${module.label} · ${section.label}` }))),
  ...navigationTools.map(tool => ({ key: `global/${tool.id}`, section: tool.id, label: tool.label, title: tool.label })),
];
export const resolveShellRoute = key => shellRoutes.find(route => route.key === key);

function useMedia(query) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => { const media = matchMedia(query); const update = () => setMatches(media.matches); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, [query]);
  return matches;
}
function ChoiceRail({ label, value, options, onChange, iconOnly = false, vertical = iconOnly }) {
  return <div className={`nav-rail${iconOnly ? ' is-icon-rail' : ''}${vertical ? ' is-vertical' : ''}`} role="group" aria-label={label}>
    {options.map(option => <Button key={option.value} text plain className={`nav-rail-button${value === option.value ? ' is-active' : ''}`} label={iconOnly ? undefined : option.label} icon={iconOnly ? option.icon : undefined} aria-label={option.label} title={iconOnly ? option.label : undefined} aria-pressed={value === option.value} onClick={event => onChange(option.value, event)} />)}
  </div>;
}
const themeChoices = themeOptions.map(option => ({ ...option, icon: { light: 'pi pi-sun', dark: 'pi pi-moon' }[option.value] }));
const isPlainActivation = event => !event || (!event.defaultPrevented && (event.button == null || event.button === 0) && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey);

// The shell owns presentation and overlay state; callers own routing, history and persistence.
export function NavigationShell({
  route, activeModule, onNavigate, children, header, contentClassName = '', className = '',
  reviewLabel = 'R02-01 · 导航外壳', reviewHref = '../../reviews/R02-01.md',
  previewTitle = '导航预览设置', previewControls, onReset, resetLabel = '模拟首次访问',
  taskHref = '../../ui-design-shared-plan.md',
}) {
  const [manualCollapsed, setManualCollapsed] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const narrow = useMedia('(width < 1200px)');
  const collapsed = manualCollapsed ?? narrow;
  const { theme, updatePreference } = usePrototypePreference();
  const main = useRef(null);
  const moduleRouteChange = useRef(null);
  const rootKey = route.rootKey ?? route.key;
  const rootRoute = resolveShellRoute(rootKey) ?? route;
  const moduleLabel = navigationModules.find(module => module.id === activeModule).label;

  useEffect(() => {
    if (moduleRouteChange.current !== route.key) setMoreOpen(false);
    moduleRouteChange.current = null;
  }, [route.key]);
  useEffect(() => { setPreviewOpen(false); }, [route]);
  useEffect(() => { updatePreference('module', activeModule === 'production' ? 'image' : 'training'); }, [activeModule]);

  function requestNavigation(key, originalEvent, source = 'link') {
    if (!isPlainActivation(originalEvent)) return;
    moduleRouteChange.current = source === 'module' && key !== route.key ? key : null;
    if (source !== 'module') setMoreOpen(false);
    const accepted = onNavigate(key, { source, originalEvent });
    if (accepted === false) moduleRouteChange.current = null;
  }
  function resetVisit() {
    moduleRouteChange.current = null;
    setManualCollapsed(null); setMoreOpen(false); setPreviewOpen(false);
    onReset?.();
  }
  const themeAction = theme === 'dark' ? '切换到浅色' : '切换到深色';
  const sidebarButtonSlots = { icon: { className: 'nav-control-icon' }, label: { className: 'nav-expanding-label' } };
  const themeSwitch = () => <button type="button" className="nav-item nav-theme-toggle" aria-label={themeAction} title={themeAction} onClick={() => updatePreference('theme', theme === 'dark' ? 'light' : 'dark')}><i className={theme === 'dark' ? 'pi pi-sun' : 'pi pi-moon'} aria-hidden="true" /><span className="nav-item-label">{themeAction}</span></button>;
  const moduleSwitch = (iconOnly = false) => <ChoiceRail label="切换业务模块" value={activeModule} options={navigationModules.map(module => ({ ...module, value: module.id }))} iconOnly={iconOnly} onChange={(value, event) => requestNavigation(`${value}/tasks`, event, 'module')} />;
  const themeRail = (iconOnly = false) => <ChoiceRail iconOnly={iconOnly} vertical={false} label="主题" value={theme} options={themeChoices} onChange={value => updatePreference('theme', value)} />;
  function navigationLink(item, key) {
    const active = rootKey === key;
    return <a key={key} href={`#${key}`} className={`nav-item${active ? ' is-active' : ''}`} aria-label={item.label} aria-current={active ? 'page' : undefined} title={item.label} onClick={event => requestNavigation(key, event, event.detail === 0 ? 'keyboard' : 'link')}>
      <i className={`pi ${item.icon}`} aria-hidden="true" /><span className="nav-item-label">{item.label}</span>{active && <i className="pi pi-check nav-current-mark" aria-hidden="true" />}
    </a>;
  }
  const mobileItems = [
    ...navigationSections.map(section => ({ id: section.id, label: section.label, icon: `pi ${section.icon}`, url: `#${activeModule}/${section.id}` })),
    { id: 'more', label: '更多', icon: 'pi pi-ellipsis-h' },
  ];
  const mobileActiveIndex = rootRoute.module ? navigationSections.findIndex(section => section.id === rootRoute.section) : navigationSections.length;
  function changeMobileTab({ originalEvent, index }) {
    if (!isPlainActivation(originalEvent)) return;
    if (index === navigationSections.length) setMoreOpen(true);
    else requestNavigation(`${activeModule}/${navigationSections[index].id}`, originalEvent, originalEvent.type === 'keydown' ? 'keyboard' : 'link');
  }
  const mobileTabSlots = {
    menu: { className: 'nav-mobile-tab-list', 'aria-label': `${moduleLabel}导航入口`, style: { background: 'transparent', border: 0, padding: '10px 12px' } },
    menuitem: ({ context }) => ({ className: `nav-tab-item${context.index === mobileActiveIndex ? ' is-active' : ''}`, style: { margin: 0 } }),
    action: ({ context }) => ({ className: 'nav-tab', 'aria-current': context.index === mobileActiveIndex && context.index < navigationSections.length ? 'page' : undefined, 'aria-haspopup': context.index === navigationSections.length ? 'dialog' : undefined, 'aria-expanded': context.index === navigationSections.length ? moreOpen : undefined, style: { color: 'inherit', background: 'transparent', border: 0, padding: 0, margin: 0, fontSize: '12px', fontWeight: 500, borderRadius: 'var(--radius-control)' } }),
    icon: { className: 'nav-tab-icon', style: { color: 'inherit', margin: 0 } },
    label: { className: 'nav-tab-label', style: { color: 'inherit', fontWeight: 'inherit', lineHeight: '18px', transition: 'none' } },
  };
  const businessLinks = navigationSections.map(section => navigationLink(section, `${activeModule}/${section.id}`));
  const globalLinks = navigationTools.map(tool => navigationLink(tool, `global/${tool.id}`));

  return <div className={`navigation-preview${className ? ` ${className}` : ''}`}>
    <a className="skip-link" href="#navigation-main" onClick={event => { event.preventDefault(); main.current?.focus(); }}>跳到主内容</a>
    <div className="nav-review-bar"><span>{reviewLabel}</span><a href={reviewHref}>任务说明</a><Button text icon="pi pi-sliders-h" aria-label={`打开${previewTitle}`} aria-haspopup="dialog" onClick={() => setPreviewOpen(true)} /></div>
    <div className={`nav-layout${collapsed ? ' is-collapsed' : ''}`}>
      <aside className="nav-sidebar" id="desktop-sidebar-navigation" aria-label="应用侧栏">
        <div className="nav-brand" aria-label="ComfyUI Manager"><span className="nav-brand-full">ComfyUI <span>Manager</span></span><span className="nav-brand-short" aria-hidden="true">CM</span></div>
        <div className="nav-module-zone">
          <div className="nav-module-wide" aria-hidden={collapsed} inert={collapsed}>{moduleSwitch()}</div>
          <div className="nav-module-narrow" aria-hidden={!collapsed} inert={!collapsed}>{moduleSwitch(true)}</div>
        </div>
        <nav className="nav-primary" aria-label={`${moduleLabel}主导航`}>{businessLinks}</nav>
        <div className="nav-sidebar-bottom"><span className="nav-group-label">全局工具</span><nav aria-label="全局工具">{globalLinks}</nav>
          <div className="nav-utility-row">{themeSwitch()}</div>
          <div className="nav-collapse-row"><Button text icon={collapsed ? 'pi pi-angle-double-right' : 'pi pi-angle-double-left'} label={collapsed ? '展开侧栏' : '收起侧栏'} pt={sidebarButtonSlots} aria-label={collapsed ? '展开侧栏' : '收起侧栏'} aria-expanded={!collapsed} aria-controls="desktop-sidebar-navigation" onClick={() => setManualCollapsed(!collapsed)} /></div>
        </div>
      </aside>
      <div className="nav-workspace">
        {header === undefined ? <div className="nav-page-heading"><h1 aria-live="polite">{route.title}</h1>{!route.module && <span className="nav-global-label">全局工具</span>}<span className="nav-page-actions" aria-label="页面操作预留区">页面操作区</span></div> : header}
        <main ref={main} id="navigation-main" className={`nav-main${contentClassName ? ` ${contentClassName}` : ''}`} tabIndex={-1}>
          {children === undefined ? <section className="nav-content-placeholder" aria-label="业务内容占位"><div className="nav-placeholder-copy"><i className="pi pi-window-maximize" aria-hidden="true" /><h2>{route.title}内容区</h2><p>此处用于检查导航位置与可用空间。<br />业务内容将在对应任务中单独设计。</p></div></section> : children}
        </main>
      </div>
    </div>
    <nav className="nav-mobile-dock" aria-label={`${moduleLabel}底部导航`}>
      <TabMenu className="nav-mobile-tabs" model={mobileItems} activeIndex={mobileActiveIndex} onTabChange={changeMobileTab} pt={mobileTabSlots} />
    </nav>
    <Dialog visible={moreOpen} onHide={() => setMoreOpen(false)} position="bottom" showHeader={false} aria-label="更多导航与外观" className="nav-more-sheet" style={{ borderColor: 'var(--nav-border)' }} contentStyle={{ padding: 0, borderRadius: 'inherit' }} draggable={false} resizable={false} dismissableMask blockScroll>
      <div className="nav-more-content">
        <div className="nav-more-top">{moduleSwitch()}{themeRail(true)}<Button text plain className="nav-more-close" icon="pi pi-times" aria-label="关闭更多" onClick={() => setMoreOpen(false)} /></div>
        <nav className="nav-more-links" aria-label="全局工具">{globalLinks}</nav>
      </div>
    </Dialog>
    <Dialog header={previewTitle} visible={previewOpen} onHide={() => setPreviewOpen(false)} className="nav-preview-dialog" draggable={false} blockScroll footer={<Button label="完成" onClick={() => setPreviewOpen(false)} />}>
      <div className="nav-preview-fields"><div><span id="nav-theme-label">主题</span>{themeRail()}</div><p>桌面侧栏可收放；窄屏默认收起。手机全局导航集中在底部，顶部预留给页面操作。</p>{previewControls}{onReset && <Button outlined icon="pi pi-refresh" label={resetLabel} onClick={resetVisit} />}<a href={taskHref}>查看 {reviewLabel.split(' · ')[0]} 任务范围</a></div>
    </Dialog>
  </div>;
}
