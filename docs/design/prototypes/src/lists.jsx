import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { Paginator } from 'primereact/paginator';
import { SelectButton } from 'primereact/selectbutton';
import { Skeleton } from 'primereact/skeleton';
import { Tag } from 'primereact/tag';
import { Toolbar } from 'primereact/toolbar';
import { Toast } from 'primereact/toast';
import { usePrototypePreference, themeOptions } from './use-prototype-preference.jsx';
import { PrototypeProvider } from './prototype-provider.jsx';
import './prototype-layout.css';
import './lists.css';

const moduleOptions = [{ label: '生产', value: 'image' }, { label: '训练', value: 'training' }];
const categoryOptions = ['全部分类', '人像', '场景', '细节'];
const stateOptions = [{ label: '内容', value: 'content' }, { label: '加载', value: 'loading' }, { label: '无数据', value: 'empty' }, { label: '失败', value: 'error' }];
const sortOptions = [{ label: '最近更新', value: 'updatedAt:-1' }, { label: '最早更新', value: 'updatedAt:1' }, { label: '名称升序', value: 'name:1' }, { label: '名称降序', value: 'name:-1' }];
const records = [
  ['晨光人像', '人像', '柔和侧光，保留自然肤色与发丝细节。'],
  ['雨后街角', '场景', '湿润路面、商店橱窗与远处的行人。'],
  ['织物与金属', '细节', '比较不同材质在相同光线下的质感。'],
  ['窗边阅读', '人像', '侧面构图，重点保留手部与书页关系。'],
  ['午后的温室', '场景', '自然采光与层叠绿植。'],
  ['衣褶与配饰', '细节', '小范围细节观察，背景保持简洁。'],
  ['海风中的长发', '人像', '发丝方向与人物姿态保持一致。'],
  ['山间车站', '场景', '用远近层次区分站台、轨道和山林。'],
  ['玻璃器皿', '细节', '保留透明边缘与折射。'],
  ['逆光半身像', '人像', '面部亮度与轮廓光的平衡。'],
  ['夏夜小巷', '场景', '低照度环境中的暖色光源。'],
  ['旧书与纸张', '细节', '磨损边角、纹理与纸页的微小阴影。'],
  ['长名称样本：海边傍晚的双人构图与远景环境细节对照', '人像', '名称可以换行，重要内容不会藏在省略号或悬停提示里。'],
  ['森林中的小屋', '场景', '前景枝叶与建筑主体的视觉分离。'],
  ['手绘陶瓷', '细节', '观察釉面与手工纹样。'],
  ['日常服装参考', '人像', '简单站姿，服装轮廓清楚。'],
  ['清晨的厨房', '场景', '低对比环境，保留工作台上的生活细节。'],
  ['细节说明为空的样本', '细节', ''],
].map(([name, category, note], index) => ({ id: `sample-${index + 1}`, name, category, note, updatedAt: `2026-09-${String(8 - Math.floor(index / 3)).padStart(2, '0')} ${String(16 - index % 3).padStart(2, '0')}:30` }));

function ListSkeleton({ className, header = false }) {
  return <Skeleton className={className} pt={header ? { root: { style: { backgroundColor: 'var(--border)' } } } : undefined} width="var(--skeleton-width, 100%)" height="var(--skeleton-height, 12px)" />;
}

function ListLoading({ count }) {
  return <div className="list-loading" role="status" aria-label="正在加载列表">
    <span className="visually-hidden">正在加载列表</span>
    <div className="list-desktop" aria-hidden="true">
      <DataTable value={Array.from({ length: count }, (_, id) => ({ id }))} dataKey="id" className="list-data-table" tableStyle={{ tableLayout: 'fixed', width: '100%' }}>
        {['select', 'name', 'category', 'note', 'date', 'action'].map((column) => <Column key={column} headerClassName={`list-${column}-column`} bodyClassName={`list-${column}-column`} header={<span className="list-skeleton-header"><ListSkeleton header className={`list-skeleton-${column}`} /></span>} body={() => <span className="list-skeleton-cell"><ListSkeleton className={`list-skeleton-${column}`} /></span>} />)}
      </DataTable>
    </div>
    <div className="list-mobile" aria-hidden="true">
      <div className="list-skeleton-mobile-header"><ListSkeleton className="list-skeleton-check" /><ListSkeleton className="list-skeleton-name" /></div>
      <div className="list-skeleton-cards">{Array.from({ length: count }, (_, index) => <div className="list-skeleton-card" key={index}><div className="list-skeleton-card-heading"><ListSkeleton className="list-skeleton-check" /><ListSkeleton className="list-skeleton-name" /></div><ListSkeleton className="list-skeleton-note" /><div className="list-skeleton-card-meta"><ListSkeleton className="list-skeleton-category" /><ListSkeleton className="list-skeleton-date" /><ListSkeleton className="list-skeleton-action" /></div></div>)}</div>
    </div>
  </div>;
}

function App() {
  const { preference, theme, updatePreference } = usePrototypePreference();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部分类');
  const [sortField, setSortField] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState(-1);
  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(5);
  const [selected, setSelected] = useState([]);
  const [previewState, setPreviewState] = useState('content');
  const [previewControlsOpen, setPreviewControlsOpen] = useState(false);
  const [copyFallback, setCopyFallback] = useState('');
  const retryTimer = useRef(null);
  const toast = useRef(null);
  useEffect(() => () => clearTimeout(retryTimer.current), []);

  const search = query.trim().toLocaleLowerCase('zh-CN');
  const filtered = records.filter((record) => (category === '全部分类' || record.category === category)
    && `${record.name} ${record.note}`.toLocaleLowerCase('zh-CN').includes(search))
    .sort((a, b) => a[sortField].localeCompare(b[sortField], 'zh-CN', { numeric: true }) * sortOrder);
  const page = filtered.slice(first, first + rows);
  const hasFilter = query !== '' || category !== '全部分类';
  const contentAvailable = previewState === 'content';

  function clearSelection() { setSelected([]); toast.current?.clear(); setCopyFallback(''); }
  function changeFilter(setValue, value) { setValue(value); setFirst(0); clearSelection(); }
  function resetFilters() { setQuery(''); setCategory('全部分类'); setFirst(0); clearSelection(); }
  function changeState(value) {
    if (!value) return;
    clearTimeout(retryTimer.current); clearSelection(); setPreviewState(value);
  }
  function retry() {
    changeState('loading');
    retryTimer.current = setTimeout(() => setPreviewState('content'), 650);
  }
  async function copyText(text, summary) {
    setCopyFallback('');
    try { await navigator.clipboard.writeText(text); toast.current.replace({ severity: 'success', summary, life: 3200 }); }
    catch {
      setCopyFallback(text);
      toast.current.replace({ severity: 'warn', summary: '浏览器未允许自动复制', sticky: true,
        detail: <a className="list-copy-fallback-link" href="#copy-fallback" onClick={() => toast.current.clear()}>查看可手动复制的文本<i className="pi pi-arrow-down" aria-hidden="true" /></a> });
    }
  }
  function toggleRecord(record, checked) {
    setSelected((current) => checked ? [...current.filter((item) => item.id !== record.id), record] : current.filter((item) => item.id !== record.id));
    toast.current?.clear(); setCopyFallback('');
  }

  const toolbarStart = <div className="list-filter-fields">
    <div className="list-search"><label htmlFor="list-search">搜索</label><div className="list-search-row"><IconField className="list-search-input" iconPosition="left"><InputIcon className="pi pi-search" aria-hidden="true" /><InputText id="list-search" value={query} onChange={(event) => changeFilter(setQuery, event.target.value)} className="list-search-control" placeholder="搜索名称或备注" disabled={!contentAvailable} /></IconField><Button className="list-mobile-reset" text icon="pi pi-filter-slash" aria-label="重置筛选" disabled={!hasFilter || !contentAvailable} onClick={resetFilters} /></div></div>
    <div className="list-category"><label htmlFor="list-category">分类</label><Dropdown className="list-filter-control" inputId="list-category" value={category} options={categoryOptions} onChange={(event) => changeFilter(setCategory, event.value)} disabled={!contentAvailable} /></div>
    <div className="list-sort"><label htmlFor="list-sort">排序</label><Dropdown className="list-filter-control" inputId="list-sort" value={`${sortField}:${sortOrder}`} options={sortOptions} onChange={(event) => { const [field, order] = event.value.split(':'); changeFilter(setSortField, field); setSortOrder(Number(order)); }} disabled={!contentAvailable} /></div>
  </div>;
  const nameCell = (record) => <span className="list-record-name">{record.name}</span>;
  const noteCell = (record) => <span className="list-record-note">{record.note || '未填写备注'}</span>;
  const copyCell = (record) => <Button className="list-copy-button" text icon="pi pi-copy" aria-label={`复制名称：${record.name}`} onClick={() => copyText(record.name, '已复制名称。')} />;
  const table = <DataTable value={page} dataKey="id" selectionMode="checkbox" selection={selected} onSelectionChange={(event) => { setSelected(event.value); toast.current?.clear(); setCopyFallback(''); }}
    selectionPageOnly selectionAriaLabel="name" sortField={sortField} sortOrder={sortOrder} onSort={(event) => { setSortField(event.sortField); setSortOrder(event.sortOrder); setFirst(0); clearSelection(); }}
    className="list-data-table" rowHover tableStyle={{ tableLayout: 'fixed', width: '100%' }} pt={{ table: { 'aria-label': '列表样本' } }}>
    <Column selectionMode="multiple" headerClassName="list-select-column" bodyClassName="list-select-column" pt={{ headerCheckbox: { root: { 'aria-label': selected.length === page.length ? '取消本页全部选择' : '选择本页全部记录' }, input: { 'aria-label': selected.length === page.length ? '取消本页全部选择' : '选择本页全部记录' } } }} />
    <Column field="name" header="名称" sortable body={nameCell} headerClassName="list-name-column" bodyClassName="list-name-column" />
    <Column field="category" header="分类" body={(record) => <Tag value={record.category} />} headerClassName="list-category-column" bodyClassName="list-category-column" />
    <Column field="note" header="备注" body={noteCell} headerClassName="list-note-column" bodyClassName="list-note-column" />
    <Column field="updatedAt" header="更新于" sortable body={(record) => <time className="list-date" dateTime={record.updatedAt.replace(' ', 'T')}><span>{record.updatedAt.split(' ')[0]}</span><span>{record.updatedAt.split(' ')[1]}</span></time>} headerClassName="list-date-column" bodyClassName="list-date-column" />
    <Column header="操作" body={copyCell} headerClassName="list-action-column" bodyClassName="list-action-column" />
  </DataTable>;

  return <PrototypeProvider><div className="list-page">
    <Toast ref={toast} position="bottom-center" className="list-copy-toast" />
    <a className="skip-link" href="#list-main">跳到列表内容</a>
    <header className="app-header"><a href="../../foundations/" className="wordmark">ComfyUI <span>Manager</span></a><span className="header-context">组件组合</span><span className="review-status"><span className="review-dot" />R01-01 · 已确认</span>
      <div className="header-controls"><SelectButton value={preference.module} options={moduleOptions} onChange={(event) => updatePreference('module', event.value)} aria-label="模块色" allowEmpty={false} /><SelectButton value={preference.theme} options={themeOptions} onChange={(event) => updatePreference('theme', event.value)} aria-label="主题偏好" allowEmpty={false} /></div>
      <Button className="list-preview-toggle" text label="预览" icon="pi pi-sliders-h" aria-label="打开预览设置" aria-haspopup="dialog" onClick={() => setPreviewControlsOpen(true)} />
    </header>
    <main id="list-main" className="list-main" tabIndex={-1}>
      <nav className="list-demo-nav" aria-label="设计原型"><a href="../../foundations/">基础规范</a><span aria-hidden="true">/</span><span aria-current="page">列表与分页</span><a className="list-review-link" href="../../reviews/R01.md">审核记录<i className="pi pi-arrow-up-right" aria-hidden="true" /></a></nav>
      <div className="list-page-heading"><h1>列表、筛选与分页</h1><p>搜索、筛选、选择与分页的可操作样本。</p></div>
      <div id="list-preview-controls" className="list-preview-controls">
        <div><span id="preview-state-label">预览状态</span><SelectButton value={previewState} options={stateOptions} onChange={(event) => changeState(event.value)} aria-labelledby="preview-state-label" allowEmpty={false} /></div>
      </div>
      <section className="list-surface" aria-labelledby="list-title">
        <div className="list-title-row"><h2 id="list-title">列表样本</h2><span>18 条模拟记录</span></div>
        <Toolbar className="list-toolbar" pt={{ start: { className: 'list-toolbar-start' }, center: { style: { display: 'none' } }, end: { className: 'list-toolbar-end' } }} aria-label="列表筛选工具栏" start={toolbarStart} end={<Button text label="重置筛选" icon="pi pi-filter-slash" disabled={!hasFilter || !contentAvailable} onClick={resetFilters} />} />
        <div className={`list-selection-bar${selected.length ? ' has-selection' : ''}`}>
          <div aria-live="polite">{selected.length ? <><strong>已选 {selected.length} 项</strong><span>仅当前页</span></> : <span>{contentAvailable ? `共 ${filtered.length} 条${hasFilter ? '匹配记录' : '记录'} · 勾选后批量操作` : previewState === 'loading' ? '正在获取记录…' : previewState === 'empty' ? '暂无记录' : '记录暂不可用'}</span>}</div>
          {selected.length ? <div className="list-selection-actions"><Button label="复制名称" onClick={() => copyText(selected.map((record) => record.name).join('\n'), `已复制 ${selected.length} 个名称。`)} /><Button text label="取消选择" onClick={clearSelection} /></div> : null}
        </div>
        <div className="list-content" aria-busy={previewState === 'loading'}>
          {previewState === 'loading' ? <ListLoading count={page.length || rows} /> : previewState === 'error' ? <div className="list-empty" role="alert"><i className="pi pi-exclamation-circle" aria-hidden="true" /><h3>列表加载失败</h3><p>暂时无法获取记录，搜索和筛选条件已保留。</p><div><Button label="重试" icon="pi pi-refresh" onClick={retry} /><Button text label="复制错误" onClick={() => copyText('示例错误：列表请求超时。原型模拟场景，无真实接口请求。', '已复制错误详情。')} /></div></div>
            : previewState === 'empty' ? <div className="list-empty"><i className="pi pi-inbox" aria-hidden="true" /><h3>还没有记录</h3><p>有内容后，名称、分类与更新信息会显示在这里。</p><Button outlined label="载入示例记录" onClick={() => { resetFilters(); changeState('content'); }} /></div>
              : filtered.length === 0 ? <div className="list-empty"><i className="pi pi-search" aria-hidden="true" /><h3>没有匹配的记录</h3><p>试试更短的关键词，或取消分类限制。</p><Button outlined label="清空筛选" onClick={resetFilters} /></div>
                : <><div className="list-desktop">{table}</div><div className="list-mobile"><div className="list-mobile-select"><Checkbox inputId="mobile-all" checked={selected.length === page.length} onChange={(event) => { setSelected(event.checked ? page : []); toast.current?.clear(); setCopyFallback(''); }} /><label htmlFor="mobile-all">{selected.length && selected.length !== page.length ? `已选 ${selected.length} / ${page.length} 项` : '选择本页全部'}</label></div>
                  <ul className="list-mobile-records" aria-label="列表样本">{page.map((record) => <li key={record.id} className={selected.some((item) => item.id === record.id) ? 'is-selected' : ''}><div className="list-mobile-heading"><Checkbox inputId={`mobile-${record.id}`} checked={selected.some((item) => item.id === record.id)} onChange={(event) => toggleRecord(record, event.checked)} /><label htmlFor={`mobile-${record.id}`}>{record.name}</label></div><p>{record.note || '未填写备注'}</p><div className="list-mobile-meta"><Tag value={record.category} /><time dateTime={record.updatedAt.replace(' ', 'T')}>{record.updatedAt}</time>{copyCell(record)}</div></li>)}</ul>
                </div></>}
        </div>
        <div className="list-pagination"><span className="list-page-report" aria-live="polite">{contentAvailable && filtered.length ? `${first + 1}–${Math.min(first + rows, filtered.length)} / ${filtered.length} 条` : '—'}</span>
          <Paginator first={first} rows={rows} totalRecords={contentAvailable ? filtered.length : 0} pageLinkSize={3} className="list-paginator" template="PrevPageLink PageLinks NextPageLink" onPageChange={(event) => { setFirst(event.first); clearSelection(); }} />
          <div className="list-page-size"><label htmlFor="page-size">每页</label><Dropdown className="list-filter-control" inputId="page-size" value={rows} options={[5, 10, 20]} onChange={(event) => { setRows(event.value); setFirst(0); clearSelection(); }} disabled={!contentAvailable} /><span>条</span></div>
        </div>
      </section>
      {copyFallback ? <section className="list-feedback" aria-label="手动复制"><p>自动复制未完成，请手动选择以下文本。</p><pre id="copy-fallback" tabIndex={0} aria-label="可手动复制的文本">{copyFallback}</pre></section> : null}
      <div className="list-review-notes"><p><i className="pi pi-info-circle" aria-hidden="true" />选择仅作用于当前页；搜索、筛选、排序或翻页会清空选择。</p><p>窄屏使用卡片，名称与主要操作完整保留。<a href="../organization/">下一项：层级与排序</a></p></div>
      <footer className="page-footer"><span>R01-01 · 已确认组件组合 · 固定模拟数据</span><span>{theme === 'dark' ? '深色' : '浅色'}主题 · {preference.theme === 'system' ? '实时跟随系统' : '手动选择，可切回系统'}</span></footer>
    </main>
    <Dialog header="预览设置" visible={previewControlsOpen} onHide={() => setPreviewControlsOpen(false)} className="list-preview-dialog" draggable={false} blockScroll footer={<Button label="完成" onClick={() => setPreviewControlsOpen(false)} />}>
      <div className="list-settings-fields"><div><span id="list-settings-module">模块色</span><SelectButton value={preference.module} options={moduleOptions} onChange={(event) => updatePreference('module', event.value)} aria-labelledby="list-settings-module" allowEmpty={false} /></div><div><span id="list-settings-theme">主题</span><SelectButton value={preference.theme} options={themeOptions} onChange={(event) => updatePreference('theme', event.value)} aria-labelledby="list-settings-theme" allowEmpty={false} /></div><div><span id="list-settings-state">预览状态</span><SelectButton value={previewState} options={stateOptions} onChange={(event) => changeState(event.value)} aria-labelledby="list-settings-state" allowEmpty={false} /></div></div>
    </Dialog>
  </div></PrototypeProvider>;
}

createRoot(document.getElementById('root')).render(<App />);
