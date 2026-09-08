import { useEffect, useState } from 'react';

export const themeOptions = [{ label: '系统', value: 'system' }, { label: '浅色', value: 'light' }, { label: '深色', value: 'dark' }];
const preferenceKey = 'cm-prototype-preference-v1';

function readPreference() {
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey) || '{}');
    return {
      theme: ['light', 'dark'].includes(saved.theme) ? saved.theme : 'system',
      module: saved.module === 'training' ? 'training' : 'image',
    };
  } catch { return { theme: 'system', module: 'image' }; }
}

export function usePrototypePreference() {
  const [preference, setPreference] = useState(readPreference);
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = preference.theme === 'system' ? (systemDark ? 'dark' : 'light') : preference.theme;
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const change = () => setSystemDark(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.module = preference.module;
    root.dataset.density = 'standard';
    try { localStorage.setItem(preferenceKey, JSON.stringify(preference)); } catch { /* 存储不可用时仍可预览。 */ }
  }, [preference, theme]);
  function updatePreference(key, value) {
    if (value) setPreference((old) => ({ ...old, [key]: value }));
  }
  return { preference, theme, updatePreference };
}
