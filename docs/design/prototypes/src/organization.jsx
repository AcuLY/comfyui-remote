import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from 'primereact/button';
import { FilterService } from 'primereact/api';
import { Checkbox } from 'primereact/checkbox';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { ListBox } from 'primereact/listbox';
import { Message } from 'primereact/message';
import { OrderList } from 'primereact/orderlist';
import { SelectButton } from 'primereact/selectbutton';
import { Skeleton } from 'primereact/skeleton';
import { Toast } from 'primereact/toast';
import { Tree } from 'primereact/tree';
import { PrototypeProvider } from './prototype-provider.jsx';
import { usePrototypePreference, themeOptions } from './use-prototype-preference.jsx';
import './prototype-layout.css';
import './lists.css';
import './organization.css';

const moduleOptions = [{ label: '生产', value: 'image' }, { label: '训练', value: 'training' }];
const stateOptions = [{ label: '内容', value: 'content' }, { label: '加载', value: 'loading' }, { label: '无数据', value: 'empty' }, { label: '失败', value: 'error' }, { label: '只读', value: 'readonly' }];
const sampleFolders = [
  { key: 'root', label: '示例资源', parent: null },
  { key: 'portrait', label: '人像', parent: 'root' },
  { key: 'studio', label: '室内', parent: 'portrait' },
  { key: 'window', label: '窗边与自然光', parent: 'studio' },
  { key: 'outdoor', label: '户外', parent: 'portrait' },
  { key: 'scene', label: '场景', parent: 'root' },
  { key: 'city', label: '城市街景与建筑空间参考', parent: 'scene' },
  { key: 'detail', label: '细节', parent: 'root' },
  { key: 'empty', label: '待整理', parent: 'root' },
];
const treeNodes = (folders, parent = null) => folders.filter(f => f.parent === parent).map(f => ({ key: f.key, label: f.label, icon: 'pi pi-folder', children: treeNodes(folders, f.key) }));
const sampleGroups = {
  root: [{ id: 'r1', name: '尚未分类的参考', note: '可移动到任意示例文件夹。' }],
  portrait: [
    { id: 'p1', name: '晨光人像', note: '柔和侧光与自然肤色。' },
    { id: 'p2', name: '窗边阅读', note: '人物、书页与手部的关系。' },
    { id: 'p3', name: '海风中的长发', note: '保留发丝方向与姿态。' },
    { id: 'p4', name: '长名称样本：海边傍晚的双人构图与远景环境细节对照', note: '完整名称换行显示。' },
    { id: 'p5', name: '日常服装参考', note: '清晰的服装轮廓。' },
  ],
  studio: [{ id: 's1', name: '室内柔光', note: '低对比度的光线参考。' }],
  window: [{ id: 'w1', name: '午后窗边', note: '三级文件夹中的内容。' }],
  outdoor: [],
  scene: [{ id: 'c1', name: '雨后街角', note: '湿润路面与远处行人。' }, { id: 'c2', name: '山间车站', note: '站台、轨道和山林。' }],
  city: [{ id: 'c3', name: '转角的书店', note: '建筑与街道的层次。' }],
  detail: [{ id: 'd1', name: '织物与金属', note: '不同材质的质感对照。' }],
  empty: [],
};
function LoadingRows({ tree = false }) {
  return <div className={tree ? 'org-tree-loading' : 'org-loading'} role="status" aria-label={tree ? '正在加载文件夹' : '正在加载内容'}>
    <span className="visually-hidden">正在加载{tree ? '文件夹' : '内容'}</span>
    {Array.from({ length: tree ? 5 : 4 }, (_, i) => <div className="org-skeleton-row" key={i} aria-hidden="true"><Skeleton width="22px" height="22px" /><div><Skeleton width={i % 2 ? '70%' : '50%'} height="14px" />{!tree && <Skeleton width="80%" height="12px" />}</div></div>)}
  </div>;
}
function App({ snapshot }) {
  const folders = snapshot?.folders ?? sampleFolders;
  const initialGroups = snapshot?.groups ?? sampleGroups;
  const initialFolder = snapshot ? (folders.find(f => f.label === 'checkpoints' && initialGroups[f.key]?.length)?.key ?? folders.find(f => initialGroups[f.key]?.length > 1)?.key ?? 'root') : 'portrait';
  const nodes = useMemo(() => treeNodes(folders), [folders]);
  const expandedDefault = useMemo(() => snapshot ? { root: true } : { root: true, portrait: true, studio: true, scene: true }, [snapshot]);
  function folderName(key) { return folders.find(f => f.key === key)?.label || ''; }
  function folderPath(key) {
    const folder = folders.find(f => f.key === key);
    return folder ? [...(folder.parent ? folderPath(folder.parent) : []), folder.label] : [];
  }

  const { preference, theme, updatePreference } = usePrototypePreference();
  const [groups, setGroups] = useState(initialGroups);
  const [folder, setFolder] = useState(initialFolder);
  const [expanded, setExpanded] = useState(expandedDefault);
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState('');
  const [previewState, setPreviewState] = useState('content');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [draftOrder, setDraftOrder] = useState([]);
  const [moveOpen, setMoveOpen] = useState(false);
  const [target, setTarget] = useState(null);
  const [targetExpanded, setTargetExpanded] = useState(expandedDefault);
  const [moveError, setMoveError] = useState(false);
  const [moveFailure, setMoveFailure] = useState(false);
  const [moving, setMoving] = useState(false);
  const toast = useRef(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const items = previewState === 'empty' ? [] : groups[folder];
  const available = previewState === 'content' || previewState === 'readonly';
  const editable = previewState === 'content';
  const orderChanged = draftOrder.map(x => x.id).join() !== items.map(x => x.id).join();
  const visibleItems = FilterService.filter(items, ['name', 'note'], query.trim(), 'contains');
  function chooseFolder(key) {
    if (!key) return;
    setFolder(key); setSelected([]); setQuery('');
    if (!folders.some(f => f.parent === key)) setFoldersOpen(false);
  }
  function toggleRow(event, setKeys) {
    if (!event.node.children?.length || moving) return;
    setKeys(current => {
      const next = { ...current };
      if (next[event.node.key]) delete next[event.node.key];
      else next[event.node.key] = true;
      return next;
    });
  }
  function changeState(value) {
    if (!value) return;
    clearTimeout(timer.current); setPreviewState(value); setSelected([]); setQuery(''); setMoveOpen(false); setOrderOpen(false); setMoving(false);
  }
  function retry() { changeState('loading'); timer.current = setTimeout(() => setPreviewState('content'), 550); }
  function resetSample() { setGroups(initialGroups); setFolder(initialFolder); setExpanded(expandedDefault); setTargetExpanded(expandedDefault); changeState('content'); toast.current?.clear(); }
  function openOrder() { setDraftOrder([...items]); setOrderOpen(true); }
  function applyOrder() {
    setGroups(current => ({ ...current, [folder]: draftOrder })); setSelected([]); setOrderOpen(false);
    toast.current.show({ severity: 'success', summary: '顺序已更新', detail: `已应用到「${folderName(folder)}」的预览内容。`, life: 3000 });
  }
  function openMove() { setTarget(null); setMoveError(false); setMoveOpen(true); }
  function closeMove() { if (!moving) setMoveOpen(false); }
  function moveItems() {
    if (!editable || moving || !target || target === folder || !selected.length) return;
    setMoving(true); setMoveError(false);
    timer.current = setTimeout(() => {
      setMoving(false);
      if (moveFailure) { setMoveFailure(false); setMoveError(true); return; }
      const moved = items.filter(item => selected.some(value => value.id === item.id));
      setGroups(current => ({ ...current, [folder]: current[folder].filter(item => !moved.some(value => value.id === item.id)), [target]: [...current[target], ...moved] }));
      setMoveOpen(false); setSelected([]); setQuery('');
      toast.current.show({ severity: 'success', summary: `已移动 ${moved.length} 项至「${folderName(target)}」`, detail: '按原有顺序追加到目标文件夹末尾。', life: 4000 });
    }, 550);
  }
  const folderTree = <Tree className="org-tree" value={nodes} selectionMode="single" selectionKeys={folder} onSelectionChange={e => chooseFolder(e.value)} expandedKeys={expanded} onToggle={e => setExpanded(e.value)} onNodeClick={e => toggleRow(e, setExpanded)} ariaLabel="文件夹目录" nodeTemplate={node => <span className="org-folder-name">{node.label}</span>} />;
  const recordTemplate = item => <div className="org-record"><i className={`pi ${selected.some(x => x.id === item.id) ? 'pi-check-circle' : 'pi-file'}`} aria-hidden="true" /><div><strong>{item.name}</strong><span>{item.note}</span></div></div>;
  const orderTemplate = item => <div className="org-order-record"><span className="org-order-number">{draftOrder.findIndex(x => x.id === item.id) + 1}</span><strong>{item.name}</strong></div>;
  return <div className="list-page org-page">
    <Toast ref={toast} position="bottom-center" />
    <a className="skip-link" href="#organization-main">跳到内容</a>
    <header className="app-header"><a href="../../foundations/" className="wordmark">ComfyUI <span>Manager</span></a><span className="header-context">组件组合</span><span className="review-status"><span className="review-dot" />R01-02 · 待审核</span>
      <div className="header-controls"><SelectButton value={preference.module} options={moduleOptions} onChange={e => updatePreference('module', e.value)} aria-label="模块色" allowEmpty={false} /><SelectButton value={preference.theme} options={themeOptions} onChange={e => updatePreference('theme', e.value)} aria-label="主题偏好" allowEmpty={false} /></div>
      <Button className="list-preview-toggle" text label="预览" icon="pi pi-sliders-h" aria-label="打开预览设置" aria-haspopup="dialog" onClick={() => setSettingsOpen(true)} />
    </header>
    <main id="organization-main" className="list-main org-main" tabIndex={-1}>
      <nav className="list-demo-nav" aria-label="设计原型"><a href="../lists/">列表与分页</a><span aria-hidden="true">/</span><span aria-current="page">层级与排序</span><a className="list-review-link" href="../../reviews/R01-02.md">审核记录<i className="pi pi-arrow-up-right" aria-hidden="true" /></a></nav>
      <div className="list-page-heading"><h1>层级、排序与移动</h1><p>在文件夹中定位内容，调整展示顺序或移动到其他位置。</p></div>
      <div className="org-preview-row"><div className="list-preview-controls"><div><span>预览状态</span><SelectButton value={previewState} options={stateOptions} onChange={e => changeState(e.value)} allowEmpty={false} aria-label="预览状态" /></div></div><Button className="org-desktop-settings" text label="更多预览设置" icon="pi pi-cog" onClick={() => setSettingsOpen(true)} /></div>
      <section className="org-workspace" aria-label="层级与内容样本">
        <aside className="org-folders"><h2>文件夹</h2><p>选择一个位置查看其中内容。</p>{previewState === 'loading' ? <LoadingRows tree /> : folderTree}</aside>
        <div className="org-panel">
          <div className="org-location"><div><p className="org-path">{folderPath(folder).slice(0, -1).join(' / ')}</p><h2>{folderName(folder)}</h2></div><Button className="org-folder-toggle" outlined icon="pi pi-folder-open" label="文件夹" onClick={() => setFoldersOpen(true)} disabled={previewState === 'loading'} aria-haspopup="dialog" /></div>
          <div className="org-actions"><span>{available ? `${items.length} 项内容` : previewState === 'loading' ? '正在获取内容…' : previewState === 'empty' ? '暂无内容' : '内容暂不可用'}</span><Button outlined icon="pi pi-sort-alt" label="调整顺序" onClick={openOrder} disabled={!editable || items.length < 2} /></div>
          {previewState === 'readonly' && <div className="org-notice"><Message severity="info" text="当前位置为只读，可以浏览，不能排序或移动。" /></div>}
          {editable && items.length > 0 && <div className="org-selection-bar"><span aria-live="polite">{selected.length ? `已选 ${selected.length} 项` : '点选内容，可多选'}</span><div>{selected.length > 0 && <Button text label="取消选择" onClick={() => setSelected([])} />}<Button label="移动到" icon="pi pi-folder-open" disabled={!selected.length} onClick={openMove} /></div></div>}
          <div className="org-content" aria-busy={previewState === 'loading'}>
            {previewState === 'loading' ? <LoadingRows /> : previewState === 'error' ? <div className="org-empty" role="alert"><i className="pi pi-exclamation-circle" aria-hidden="true" /><h3>内容加载失败</h3><p>文件夹位置已保留，可以重试。</p><Button label="重试" icon="pi pi-refresh" onClick={retry} /></div>
              : !items.length ? <div className="org-empty"><i className="pi pi-folder-open" aria-hidden="true" /><h3>这个文件夹还是空的</h3><p>可以从其他文件夹选择内容，再移动到这里。</p><Button outlined label="返回初始文件夹" onClick={() => { chooseFolder(initialFolder); changeState('content'); }} /></div>
                : <ListBox className="org-content-list" options={items} value={selected} onChange={e => { if (editable) setSelected(e.value || []); }} optionLabel="name" dataKey="id" multiple metaKeySelection={false} pt={{ list: { 'aria-readonly': !editable }, filterContainer: { style: { maxWidth: '400px' } } }} itemTemplate={recordTemplate} aria-label="当前文件夹内容" listStyle={{ maxHeight: 'min(64dvh, 720px)' }} filter filterBy="name,note" filterValue={query} onFilterValueChange={e => { setQuery(e.value); setSelected([]); }} filterPlaceholder="搜索当前文件夹" filterInputProps={{ 'aria-label': '搜索当前文件夹' }} emptyFilterMessage="没有匹配的内容，试试其他关键词。" />}
          </div>
          {query && <p className="org-filter-report" aria-live="polite">当前匹配 {visibleItems.length} 项；排序作用于文件夹全部内容。</p>}
        </div>
      </section>
      <div className="list-review-notes"><p><i className="pi pi-info-circle" aria-hidden="true" />排序只改变当前文件夹内的顺序；移动后追加到目标末尾。</p><p>{snapshot ? `本机目录快照 · ${folders.length} 个文件夹 · ${Object.values(initialGroups).reduce((sum, group) => sum + group.length, 0)} 个文件；操作仅影响当前预览。` : '内置模拟数据，刷新恢复初始内容。'}<a href="../../ui-design-roadmap.md">查看设计路线</a></p></div>
      <footer className="page-footer"><span>R01-02 · 组件组合待审核</span><span>{theme === 'dark' ? '深色' : '浅色'} · {preference.module === 'training' ? '训练' : '生产'}</span></footer>
    </main>
    <Dialog header="选择文件夹" visible={foldersOpen} onHide={() => setFoldersOpen(false)} className="org-folder-dialog" draggable={false} blockScroll footer={<Button label="查看此文件夹" onClick={() => setFoldersOpen(false)} />}>{folderTree}</Dialog>
    <Dialog header="调整顺序" visible={orderOpen} onHide={() => setOrderOpen(false)} className="org-order-dialog" draggable={false} blockScroll footer={<div className="org-dialog-actions"><Button text label="取消" onClick={() => setOrderOpen(false)} /><Button label="应用顺序" disabled={!orderChanged} onClick={applyOrder} /></div>}>
      <div className="org-dialog-intro"><p>{folderPath(folder).join(' / ')} · {items.length} 项</p><p>选中后使用顺序按钮，也可以拖动调整。应用后生效。</p></div>
      {orderOpen && <OrderList value={draftOrder} onChange={e => setDraftOrder(e.value)} dataKey="id" itemTemplate={orderTemplate} dragdrop ariaLabel="待排序内容" breakpoint="960px" listStyle={{ maxHeight: 'min(45dvh, 420px)' }} />}
    </Dialog>
    <Dialog header={`移动 ${selected.length} 项内容`} visible={moveOpen} onHide={closeMove} closable={!moving} closeOnEscape={!moving} className="org-move-dialog" draggable={false} blockScroll footer={<div className="org-dialog-actions"><Button text label="取消" disabled={moving} onClick={closeMove} /><Button label={moveError ? '重试移动' : '移动到此处'} icon="pi pi-folder-open" loading={moving} disabled={!target || target === folder || !selected.length} onClick={moveItems} /></div>}>
      <div className="org-dialog-intro"><p>从「{folderName(folder)}」移动到：</p><p className="org-destination" aria-live="polite">{target ? folderPath(target).join(' / ') : '请选择目标文件夹'}</p></div>
      <Tree className="org-tree org-target-tree" value={nodes} selectionMode="single" selectionKeys={target} onSelectionChange={e => { setTarget(e.value); setMoveError(false); }} expandedKeys={targetExpanded} onToggle={e => setTargetExpanded(e.value)} onNodeClick={e => toggleRow(e, setTargetExpanded)} disabled={moving} ariaLabel="目标文件夹" nodeTemplate={node => <span className="org-folder-name">{node.label}{node.key === folder ? '（当前位置）' : ''}</span>} />
      {target === folder && <Message severity="warn" text="所选内容已在此处，请选择其他文件夹。" />}
      {moveError && <Message severity="error" text="移动未完成，内容仍在原位置。目标与选择已保留，可以重试。" />}
    </Dialog>
    <Dialog header="预览设置" visible={settingsOpen} onHide={() => setSettingsOpen(false)} className="list-preview-dialog" draggable={false} blockScroll footer={<Button label="完成" onClick={() => setSettingsOpen(false)} />}>
      <div className="list-settings-fields"><div><span id="org-module">模块色</span><SelectButton value={preference.module} options={moduleOptions} onChange={e => updatePreference('module', e.value)} aria-labelledby="org-module" allowEmpty={false} /></div><div><span id="org-theme">主题</span><SelectButton value={preference.theme} options={themeOptions} onChange={e => updatePreference('theme', e.value)} aria-labelledby="org-theme" allowEmpty={false} /></div><div><label htmlFor="org-state">预览状态</label><Dropdown inputId="org-state" value={previewState} options={stateOptions} onChange={e => changeState(e.value)} /></div><div className="org-failure-option"><Checkbox inputId="org-move-failure" checked={moveFailure} onChange={e => setMoveFailure(e.checked)} /><label htmlFor="org-move-failure">模拟下一次移动失败</label></div><Button outlined label="重置预览数据" icon="pi pi-refresh" onClick={resetSample} /></div>
    </Dialog>
  </div>;
}
async function start() {
  let snapshot = null;
  try {
    const response = await fetch(new URL('../../local-mocks/organization.json', document.baseURI), { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      if (data.version === 1 && Array.isArray(data.folders) && data.folders.some(f => f.key === 'root') && data.folders.every(f => typeof f.key === 'string' && Array.isArray(data.groups?.[f.key]))) snapshot = data;
    }
  } catch { /* A checkout without the private snapshot uses the built-in sample. */ }
  createRoot(document.getElementById('root')).render(<PrototypeProvider><App snapshot={snapshot} /></PrototypeProvider>);
}
start();
