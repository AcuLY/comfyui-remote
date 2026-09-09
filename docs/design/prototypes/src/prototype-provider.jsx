import React from 'react';
import { PrimeReactProvider, addLocale, locale } from 'primereact/api';
import '@fontsource-variable/geist';
import '@fontsource-variable/noto-sans-sc';
import '@fontsource/ibm-plex-mono/latin-400.css';
import 'primeicons/primeicons.css';
import './tokens.css';
import './theme/primereact.css';

addLocale('zh-CN', { aria: {
  close: '关闭', selectAll: '选择全部', unselectAll: '取消全选',
  selectRow: '选择记录', unselectRow: '取消选择记录',
  firstPageLabel: '第一页', lastPageLabel: '最后一页',
  nextPageLabel: '下一页', prevPageLabel: '上一页',
  pageLabel: '第 {page} 页', rowsPerPageLabel: '每页条数',
} });
// DataTable's row selection labels read the global locale before Provider effects run.
locale('zh-CN');

// Use documented application-wide behavior; component-specific exceptions stay in props.
export const prototypeConfig = {
  ripple: false,
  locale: 'zh-CN',
  inputStyle: 'outlined',
  hideOverlaysOnDocumentScrolling: true,
  pt: {
    toast: { root: { style: { width: '360px', maxWidth: 'calc(100vw - 32px)' } } },
    // v10 shares Tag severity colors with filled buttons; keep status tags quiet via its public root slot.
    tag: {
      root: ({ props }) => {
        const severity = ['success', 'info', 'warning', 'danger'].includes(props.severity) ? props.severity : null;
        return { style: {
          background: severity ? `var(--${severity}-soft)` : 'var(--surface-secondary)',
          color: severity ? `var(--${severity})` : 'var(--text-secondary)',
          ...props.style,
        } };
      },
    },
  },
};

export function PrototypeProvider({ children }) {
  return <PrimeReactProvider value={prototypeConfig}>{children}</PrimeReactProvider>;
}
