import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Toast } from 'primereact/toast';
import { PrototypeProvider } from './prototype-provider.jsx';
import { NavigationShell, navigationModules, resolveShellRoute } from './navigation-shell.jsx';

const storageKey = 'cm-navigation-preview-v1';
const routeFor = resolveShellRoute;
const defaultNavigation = () => ({ route: 'production/tasks', activeModule: 'production' });
function readNavigation() {
  let state = defaultNavigation();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && routeFor(saved.route) && navigationModules.some(module => module.id === saved.activeModule)) {
      state = { ...state, route: saved.route, activeModule: saved.activeModule };
    }
  } catch { /* Navigation remains usable when storage is unavailable. */ }
  if (location.hash) state.route = routeFor(location.hash.slice(1))?.key ?? 'production/tasks';
  const route = routeFor(state.route);
  if (route.module) state.activeModule = route.module;
  return state;
}
function App() {
  const [navigation, setNavigation] = useState(readNavigation);
  const toast = useRef(null);
  const route = routeFor(navigation.route);

  useEffect(() => {
    if (location.hash.slice(1) !== navigation.route) history.replaceState(null, '', `#${navigation.route}`);
    const onHashChange = () => {
      const next = routeFor(location.hash.slice(1)) ?? routeFor('production/tasks');
      if (location.hash.slice(1) !== next.key) history.replaceState(null, '', `#${next.key}`);
      setNavigation(current => ({ route: next.key, activeModule: next.module ?? current.activeModule }));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(navigation)); } catch { /* Keep this session usable. */ } }, [navigation]);
  function navigate(key, { originalEvent }) {
    originalEvent?.preventDefault();
    const next = routeFor(key);
    setNavigation(current => ({ route: next.key, activeModule: next.module ?? current.activeModule }));
    if (location.hash.slice(1) !== key) location.hash = key;
  }
  function resetVisit() {
    const initial = defaultNavigation();
    setNavigation(initial);
    history.replaceState(null, '', '#production/tasks');
    toast.current.show({ severity: 'info', summary: '已回到首次访问状态', detail: '默认进入生产任务。', life: 2600 });
  }
  return <><Toast ref={toast} position="bottom-center" /><NavigationShell route={route} activeModule={navigation.activeModule} onNavigate={navigate} onReset={resetVisit} /></>;
}
createRoot(document.getElementById('root')).render(<PrototypeProvider><App /></PrototypeProvider>);
