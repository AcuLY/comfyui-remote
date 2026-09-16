import {button,badge,progress,icon} from './ui.js';
const THEME_KEY = 'app-prototype-theme';
function resolveTheme(){
  const stored = localStorage.getItem(THEME_KEY);
  if(stored === 'light' || stored === 'dark') return stored;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
document.body.dataset.theme = resolveTheme();
document.querySelector('#components').innerHTML=`<div class="components-grid">
<section class="panel component-section"><h2>按钮</h2><div class="sample-row">${button('继续生成','feedback','play','primary')}${button('暂停','feedback','pause')}${button('取消任务','dialog','close','danger')}${button('复制参数','feedback','copy','subtle')}</div><div class="sample-row">${button('小尺寸','feedback',null,'small')}${button('正在提交','', 'spinner','', 'disabled aria-busy="true"')}${button('不可用','',null,'','disabled')}<button class="button icon-only" aria-label="下载输入快照" data-action="feedback">${icon('download')}</button></div></section>
<section class="panel component-section"><h2>任务状态</h2><div class="sample-row">${Object.keys({running:1,queued:1,submitted:1,paused:1,done:1,failed:1,cancelled:1}).map(badge).join('')}</div></section>
<section class="panel component-section"><h2>输入与选择</h2><div class="field"><label for="name">任务名称</label><input id="name" placeholder="输入任务名称"></div><div class="field"><label for="project">所属项目</label><select id="project"><option>城市漫游</option><option>植物手记</option><option>海岸线</option></select></div><div class="field"><label for="invalid">生成数量</label><input id="invalid" type="number" value="0" min="1" max="100" aria-invalid="true" aria-describedby="number-error"><span class="field-error" id="number-error">生成数量须为 1–100 的整数</span></div><div class="sample-row"><label class="check-label"><input type="checkbox" checked>选择任务</label><label class="check-label"><input type="checkbox" disabled>不可选择</label></div></section>
<section class="panel component-section"><h2>进度与反馈</h2>${progress(62,'采样 24 / 30 步')}<div class="notice error"><h3>模型加载失败</h3><p>显存不足，请释放其他程序占用后重试。</p>${button('重试','feedback','retry','small')}</div><div class="notice">恢复后会从头执行本次任务。</div>${button('显示操作反馈','feedback',null,'subtle')}</section>
<section class="panel component-section"><h2>分段选择</h2><div class="mode-switch" role="group" aria-label="任务类型"><button class="button active" aria-pressed="true">全部</button><button class="button" aria-pressed="false">素材生成</button><button class="button" aria-pressed="false">LoRA 训练</button></div><div class="field"><label class="check-label"><input id="switch" type="checkbox" role="switch" checked>显示执行记录</label></div><div class="sample-record">${icon('clock')} 14:32 开始执行</div></section>
<section class="panel component-section"><h2>对话框与空状态</h2>${button('打开取消确认','dialog','close')}<div class="empty-state compact">${icon('search')}<h3>没有匹配的任务</h3><p class="muted">试试其他名称，或清除筛选条件。</p>${button('清除筛选','feedback',null,'subtle')}</div></section>
<section class="panel component-section palette-section"><h2>颜色与文字</h2><div class="swatches"><div class="swatch" style="--swatch:var(--accent)"><span>主要操作</span></div><div class="swatch" style="--swatch:var(--pink)"><span>训练</span></div><div class="swatch" style="--swatch:var(--amber)"><span>等待</span></div><div class="swatch" style="--swatch:var(--red)"><span>错误</span></div></div><div class="sample-row"><h3>任务名称</h3><span>正文与控件</span><span class="muted">项目与来源</span><span class="mono">02:18 / 62%</span></div></section></div>`;
document.querySelector('#theme').onclick=()=>{
  const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  document.body.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);
};
let timer;
document.addEventListener('click',e=>{
  const buttonEl = e.target.closest('[data-action]');
  if(!buttonEl) return;
  if(buttonEl.dataset.action === 'dialog') document.querySelector('#sample-dialog').showModal();
  if(buttonEl.dataset.action === 'feedback'){
    const toast = document.querySelector('#toast');
    toast.textContent = '操作已完成';
    toast.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => toast.hidden = true, 2500);
  }
});
document.querySelectorAll('.mode-switch button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.mode-switch button').forEach(x => {
    x.classList.toggle('active', x === b);
    x.setAttribute('aria-pressed', String(x === b));
  });
});
document.querySelector('#switch').onchange = e => document.querySelector('.sample-record').hidden = !e.target.checked;
document.querySelector('#invalid').oninput = e => {
  const valid = e.target.validity.valid && e.target.value !== '';
  e.target.setAttribute('aria-invalid', String(!valid));
  document.querySelector('#number-error').hidden = valid;
};
