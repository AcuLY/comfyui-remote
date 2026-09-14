import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { PrototypeProvider } from './prototype-provider.jsx';
import { NavigationShell } from './navigation-shell.jsx';
import { LegacyContextApp } from './project-context.jsx';
import { ProductionProjects } from './production-projects.jsx';
import { ProductionTasks } from './production-tasks.jsx';
import { ProductionLibraries, createLibrarySeed } from './production-libraries.jsx';
import { advanceSimulation, createProductionSeed, resolveProductionRoute, productionSessionKey } from './production-model.mjs';
import './production-app.css';

const makeSeed = () => createProductionSeed(createLibrarySeed());
const positionKey = productionSessionKey + ':positions';
const loadPositions = () => { try { return new Map(JSON.parse(sessionStorage.getItem(positionKey) || '[]')); } catch { return new Map(); } };
const loadData = () => {
  try { const saved = JSON.parse(sessionStorage.getItem(productionSessionKey)); if (saved?.version === 1 && ['projects', 'sections', 'runs', 'images', 'presets', 'templates'].every(key => Array.isArray(saved[key]))) return saved; } catch { /* A new session remains usable when storage is unavailable. */ }
  return makeSeed();
};

function ProductionApp({ rawKey }) {
  const [store, setStore] = useState(loadData);
  const toast = useRef(null);
  const route = resolveProductionRoute(rawKey, store);
  const locationMemory = useRef(loadPositions());
  const previousKey = useRef(route.key);
  const notify = useCallback((detail, severity = 'success') => toast.current?.show({ severity, detail, life: 3500 }), []);
  const updateStore = useCallback(mutate => setStore(current => { const draft = structuredClone(current); mutate(draft); return draft; }), []);
  const navigate = useCallback(key => {
    locationMemory.current.set(previousKey.current, { y: window.scrollY, focus: document.activeElement?.getAttribute('aria-label'), href: document.activeElement?.getAttribute('href') });
    try { sessionStorage.setItem(positionKey, JSON.stringify([...locationMemory.current])); } catch { /* Navigation is still usable without persistence. */ }
    if (window.location.hash.slice(1) !== key) window.location.hash = key;
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(productionSessionKey, JSON.stringify(store)); } catch { notify('浏览器空间不足，本次修改暂存在页面中。', 'warn'); }
  }, [store, notify]);
  useEffect(() => { if (rawKey !== route.key) history.replaceState(null, '', '#' + route.key); }, [rawKey, route.key]);
  useEffect(() => {
    const recordScroll = () => { const current = locationMemory.current.get(previousKey.current) || {}; locationMemory.current.set(previousKey.current, { ...current, y: window.scrollY }); };
    const persist = () => { recordScroll(); try { sessionStorage.setItem(positionKey, JSON.stringify([...locationMemory.current])); } catch {} };
    addEventListener('scroll', recordScroll, { passive: true }); addEventListener('pagehide', persist);
    return () => { persist(); removeEventListener('scroll', recordScroll); removeEventListener('pagehide', persist); };
  }, []);
  useLayoutEffect(() => {
    previousKey.current = route.key;
    const memory = locationMemory.current.get(route.key);
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: memory?.y || 0, behavior: 'instant' });
      const selector = memory?.href ? `a[href="${CSS.escape(memory.href)}"]` : memory?.focus ? `[aria-label="${CSS.escape(memory.focus)}"]` : '';
      if (selector) [...document.querySelectorAll(selector)].find(element => element.getClientRects().length)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [route.key]);
  const section = route.segments[0] || 'tasks';
  const labels = { tasks: '任务', projects: '项目', presets: '预制', templates: '模板' };
  const shellRoute = useMemo(() => ({ key: route.key, rootKey: 'production/' + section, module: 'production', section, title: labels[section] }), [route.key, section]);
  const props = { route, store, updateStore, notify, navigate };
  return <NavigationShell route={shellRoute} activeModule="production" onNavigate={(key, { originalEvent }) => { originalEvent?.preventDefault(); navigate(key); }} header={null}
    contentClassName="production-main" className="production-preview" reviewLabel="生产模块 · 交互原型" reviewHref="../../reviews/production-rebuild.md" taskHref="../../ui-design-production-plan.md"
    previewTitle="原型演示设置" previewControls={<><p>全部记录、图片及执行均为演示样本。修改保存在本浏览器会话，不调用真实生成服务。</p><Button outlined label="推进一步模拟执行" icon="pi pi-forward" onClick={() => { setStore(advanceSimulation); notify('已推进演示队列。'); }} /></>}
    onReset={() => { setStore(makeSeed()); navigate('production/tasks'); notify('已重置生产演示数据。'); }} resetLabel="重置生产演示数据">
    <Toast ref={toast}/><div className="production-surface">{route.notice && <Message severity="info" text={route.notice}/>}
      {section === 'projects' ? <ProductionProjects {...props}/> : section === 'tasks' ? <ProductionTasks {...props}/> : <ProductionLibraries {...props}/>}
    </div>
  </NavigationShell>;
}

function App() {
  const [rawKey, setKey] = useState(() => location.hash.slice(1) || 'production/tasks');
  useEffect(() => { const changed = () => setKey(location.hash.slice(1) || 'production/tasks'); addEventListener('hashchange', changed); return () => removeEventListener('hashchange', changed); }, []);
  return rawKey.startsWith('training/') || rawKey.startsWith('global/') ? <LegacyContextApp/> : <ProductionApp rawKey={rawKey}/>;
}
createRoot(document.getElementById('root')).render(<PrototypeProvider><App/></PrototypeProvider>);
