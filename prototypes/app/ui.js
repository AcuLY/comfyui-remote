export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  tasks:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m8 9 1 1 2-2m2 1h3m-8 6 1 1 2-2m2 1h3"/>',
  flask:'<path d="M9 3h6m-5 0v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3M8 15h8"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon:'<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>',
  auto:'<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17Z"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  pause:'<path d="M8 5v14M16 5v14"/>', play:'<path d="m8 4 12 8-12 8V4Z"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>', chevron:'<path d="m9 5 7 7-7 7"/>',
  check:'<path d="m5 12 4 4L19 6"/>', retry:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
  copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  arrow:'<path d="M19 12H5m6-6-6 6 6 6"/>', spinner:'<path d="M21 12a9 9 0 1 1-9-9"/>', image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
  folder:'<path d="M3 7V4h6l2 3h10v13H3V7Z"/>',
  preset:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M8 7h8"/>',
  template:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>',
  models:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  monitor:'<path d="M3 12h4l2.5-6 5 12 2.5-6h4"/>',
  settings:'<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.5m0 14v2.5M2.5 12H5m14 0h2.5M5 5l1.8 1.8m10.4 10.4L19 19M19 5l-1.8 1.8M6.8 17.2 5 19"/>',
  grid:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'
};
export const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.tasks}</svg>`;
export const button = (label, action, name, tone='', extra='') => `<button type="button" class="button ${tone}" data-action="${action}" ${extra}>${name ? icon(name):''}<span>${label}</span></button>`;
export const states = {running:'执行中',done:'已完成',failed:'失败',paused:'已暂停',queued:'未提交',submitted:'已提交',cancelled:'已取消'};
export const badge = state => `<span class="badge ${state}"><span class="status-dot" aria-hidden="true"></span>${states[state]}</span>`;
export const progress = (value, label) => `<div class="progress-label"><span>${label}</span><span class="mono">${value}%</span></div><div class="progress-track" role="progressbar" aria-label="任务进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"><span class="progress-fill" style="width:${value}%"></span></div>`;
let toastTimer;
export function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true;},3500);}
