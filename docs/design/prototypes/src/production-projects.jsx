import React, { useEffect, useRef, useState } from 'react';
import { Button as PrimeButton } from 'primereact/button';
import { BreadCrumb } from 'primereact/breadcrumb';
import { Checkbox } from 'primereact/checkbox';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Menu } from 'primereact/menu';
import { Paginator } from 'primereact/paginator';
import { SelectButton } from 'primereact/selectbutton';
import { TabMenu } from 'primereact/tabmenu';
import { Tag } from 'primereact/tag';
import { ProductionImageBoard } from './production-tasks.jsx';
import { ProductionExportDialog } from './production-export.jsx';
import { boundVariants, compileSection, inheritedSectionLoras, manualPromptBlocks, resolveProductionVariant, resolvedSectionBindings } from './production-domain.mjs';
import './production-projects.css';

function Button(props) { return <PrimeButton type="button" {...props}/>; }

const uid = prefix => `${prefix}-${crypto.randomUUID()}`;
const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const hasActiveWork = (store, projectIds) => store.runs.some(run => projectIds.includes(run.projectId) && !['completed', 'failed', 'cancelled'].includes(run.status)) || (store.censorJobs || []).some(job => projectIds.includes(job.projectId) && !['completed', 'failed', 'cancelled'].includes(job.status));
const hasActiveSections = (store, sectionIds) => store.runs.some(run => sectionIds.includes(run.sectionId) && !['completed', 'failed', 'cancelled'].includes(run.status));
function deleteProjects(draft, ids) {
  draft.projects = draft.projects.filter(item => !ids.includes(item.id));
  for (const key of ['sections', 'runs', 'images', 'censorJobs']) draft[key] = (draft[key] || []).filter(item => !ids.includes(item.projectId));
  draft.folders = draft.folders.filter(item => !ids.some(id => item.scope === 'sections:' + id));
}
function archiveAction(project, store, updateStore, notify) {
  return { title: '永久归档项目', confirmLabel: '永久归档', blocked: hasActiveWork(store, [project.id]), description: `“${project.name}”归档后永久只读，不能恢复编辑。保留项目配置、任务记录、正常图片与打码版本和导出文件；清理回收站图片和临时下载缓存。`, run: () => { updateStore(draft => { draft.projects.find(item => item.id === project.id).archived = true; draft.images = draft.images.filter(item => item.projectId !== project.id || !item.trashed); }); notify('项目已永久归档'); } };
}
const path = (suffix = '') => `production/projects${suffix ? '/' + suffix : ''}`;
const withQuery = (key, query = {}) => {
  const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  return key + (params.size ? '?' + params.toString() : '');
};
const allParams = {
  aspectRatio: '2:3', shortSidePx: 768, width: 768, height: 1152, upscaleFactor: 2,
  batchSize: 2, steps: 28, cfg: 7, sampler: 'euler_ancestral', scheduler: 'normal', seed: -1,
  seedPolicy: 'random', secondEnabled: true, secondSteps: 18, secondCfg: 5.5,
  secondSampler: 'dpmpp_2m_sde', secondScheduler: 'karras', denoise: .5,
};
const ratios = ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'];
const samplers = ['euler', 'euler_ancestral', 'heun', 'dpmpp_2m', 'dpmpp_2m_sde', 'dpmpp_3m_sde'];
const schedulers = ['normal', 'karras', 'exponential', 'simple', 'sgm_uniform'];
const seedPolicies = [{ label: '随机', value: 'random' }, { label: '固定', value: 'fixed' }, { label: '递增', value: 'increment' }];
const normalizeParams = value => ({ ...allParams, ...Object.fromEntries(Object.entries(value || {}).filter(([, item]) => item != null)), upscaleFactor: value?.upscaleFactor ?? value?.upscale ?? allParams.upscaleFactor, secondEnabled: value?.secondEnabled ?? value?.twoStage ?? true });
const imageFor = (store, predicate) => store.images.filter(image => !image.trashed && predicate(image));
function groupBindings(group, store, seen = new Set()) {
  if (!group || seen.has(group.id)) return [];
  const visited = new Set([...seen, group.id]);
  return (group.members || []).flatMap(member => member.subGroupId ? groupBindings((store.groups || []).find(item => item.id === member.subGroupId), store, visited) : member.presetId ? [{ presetId: member.presetId, variantId: member.variantId }] : []);
}
const isPlainClick = event => !event.defaultPrevented && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
function useProjectListOrigin(project, from) {
  const key = 'production-project-origin:' + project.id;
  const [origin, setOrigin] = useState(() => { try { return from || sessionStorage.getItem(key); } catch { return from; } });
  useEffect(() => { if (!from) return; setOrigin(from); try { sessionStorage.setItem(key, from); } catch {} }, [key, from]);
  return origin || withQuery(path(), { folder: project.folderId });
}
function Link({ navigate, to, children, ...props }) {
  return <a {...props} href={'#' + to} draggable={false} onClick={event => { if (isPlainClick(event)) { event.preventDefault(); navigate(to); } }}>{children}</a>;
}
function Actions({ name, items }) {
  const menu = useRef(null);
  return <><Button text plain icon="pi pi-ellipsis-h" aria-label={name + '的操作'} aria-haspopup="menu" onClick={event => menu.current.toggle(event)} /><Menu ref={menu} popup model={items} /></>;
}
function PageHead({ title, detail, children, back, navigate }) {
  return <header className="pp-head"><div className="pp-head-title">{back && <Button text plain icon="pi pi-arrow-left" aria-label={back.label} onClick={() => navigate(back.to)} />}<div><h1>{title}</h1>{detail && <p>{detail}</p>}</div></div><div className="pp-actions">{children}</div></header>;
}
function Field({ label, children, wide = false, hint }) {
  return <div className={'pp-field' + (wide ? ' is-wide' : '')}><span className="pp-field-label">{label}</span>{children}{hint && <small>{hint}</small>}</div>;
}
function Group({ title, detail, children, actions }) {
  return <section className="pp-group"><header><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{actions}</header>{children}</section>;
}
function Empty({ title = '暂无内容', children }) {
  return <div className="pp-empty"><i className="pi pi-images" aria-hidden="true"/><strong>{title}</strong>{children && <p>{children}</p>}</div>;
}
function ImageStrip({ images, navigate, to, label }) {
  const content = images.length ? images.slice(0, 12).map(image => <img key={image.id} src={image.src} alt="" width="96" height="112" loading="lazy" draggable={false}/>) : <span className="pp-strip-empty"><i className="pi pi-image" aria-hidden="true"/>暂无结果</span>;
  return <Link navigate={navigate} to={to} className="pp-image-strip" aria-label={label}>{content}{images.length > 12 && <span className="pp-image-overflow">+{images.length - 12}</span>}</Link>;
}
function folderTrail(folders, folderId) {
  const result = [], seen = new Set();
  let current = folderId;
  while (current && !seen.has(current)) { seen.add(current); const folder = folders.find(item => item.id === current); if (!folder) break; result.unshift(folder); current = folder.parentId; }
  return result;
}
function descendantIds(folders, folderId) {
  const ids = new Set([folderId]);
  for (let count = 0; count <= folders.length; count++) for (const folder of folders) if (ids.has(folder.parentId)) ids.add(folder.id);
  return ids;
}
function ConfirmAction({ action, close }) {
  return <Dialog visible={Boolean(action)} header={action?.title} onHide={close} style={{ width: '460px', maxWidth: 'calc(100vw - 24px)' }} footer={<><Button text plain label="取消" onClick={close}/><Button severity="danger" label={action?.confirmLabel || '确认删除'} disabled={action?.blocked} onClick={() => { action.run(); close(); }}/></>}><p>{action?.description}</p>{action?.blocked && <p className="pp-blocked" role="alert">仍有非终态任务。请先在任务页取消相关任务，再执行此操作。</p>}</Dialog>;
}

function Collection({ store, updateStore, notify, navigate, records, scope, currentFolder, goFolder, title, project, children, route }) {
  const folders = store.folders.filter(folder => folder.scope === scope);
  const [selected, setSelected] = useState([]), [folderDraft, setFolderDraft] = useState(null), [moveOpen, setMoveOpen] = useState(false), [moveTarget, setMoveTarget] = useState(''), [confirm, setConfirm] = useState(null), [drag, setDrag] = useState(null);
  const readOnly = Boolean(project?.archived), collection = project ? 'sections' : 'projects';
  const visibleFolders = folders.filter(folder => (folder.parentId || '') === currentFolder);
  const visible = records.filter(record => (record.folderId || '') === currentFolder);
  useEffect(() => setSelected([]), [currentFolder, scope, route.query.q, route.query.archived]);
  const trail = folderTrail(folders, currentFolder);
  function toggle(id) { setSelected(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]); }
  function move(ids, target) {
    if (readOnly) return;
    const movingFolders = ids.filter(id => folders.some(folder => folder.id === id));
    if (movingFolders.some(id => descendantIds(folders, id).has(target))) { notify('文件夹不能移动到自身或子文件夹中', 'warn'); return; }
    updateStore(draft => {
      for (const item of draft[collection]) if (ids.includes(item.id) && !item.archived) item.folderId = target || '';
      for (const folder of draft.folders) if (movingFolders.includes(folder.id)) folder.parentId = target || '';
    }); setSelected([]); setMoveOpen(false); notify('已移动到' + (folders.find(folder => folder.id === target)?.name || '根目录'));
  }
  function reorder(fromId, targetId) {
    if (readOnly || fromId === targetId) return;
    if (!project && !folders.some(folder => folder.id === fromId)) return;
    updateStore(draft => {
      const key = folders.some(folder => folder.id === fromId) ? 'folders' : collection;
      const from = draft[key].findIndex(item => item.id === fromId), to = draft[key].findIndex(item => item.id === targetId);
      if (from < 0 || to < 0) return;
      draft[key].splice(to, 0, draft[key].splice(from, 1)[0]);
    });
  }
  function dragProps(record, isFolder = false) {
    return {
      draggable: !readOnly && !record.archived,
      onDragStart: event => { if (event.target.closest('input,button,a')) { event.preventDefault(); return; } const ids = selected.includes(record.id) ? selected : [record.id]; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-production-resources', JSON.stringify({ scope, ids })); setDrag(record.id); },
      onDragEnd: () => setDrag(null),
      onDragOver: event => { if (drag) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } },
      onDrop: event => { event.preventDefault(); try { const payload = JSON.parse(event.dataTransfer.getData('application/x-production-resources')); if (payload.scope !== scope) return; isFolder ? move(payload.ids, record.id) : reorder(payload.ids[0], record.id); } catch {} setDrag(null); },
      onKeyDown: event => { if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault(); const items = isFolder ? visibleFolders : visible; const index = items.findIndex(item => item.id === record.id); const target = items[index + (event.key === 'ArrowUp' ? -1 : 1)]; if (target) reorder(record.id, target.id); },
    };
  }
  const folderItems = visibleFolders.map(folder => {
    const ids = descendantIds(folders, folder.id), contained = records.filter(record => ids.has(record.folderId));
    const recordIds = new Set(contained.map(record => record.id));
    const images = imageFor(store, image => recordIds.has(project ? image.sectionId : image.projectId));
    const target = withQuery(project ? path(project.id) : path(), { ...route.query, folder: folder.id });
    return <article key={folder.id} className={'pp-resource is-folder' + (!images.length ? ' is-compact-folder' : '') + (selected.includes(folder.id) ? ' is-selected' : '') + (drag === folder.id ? ' is-dragging' : '')} {...dragProps(folder, true)} tabIndex={readOnly ? undefined : 0} aria-label={'文件夹：' + folder.name}>
      <div className="pp-resource-controls"><Checkbox aria-label={'选择文件夹：' + folder.name} checked={selected.includes(folder.id)} disabled={readOnly} onChange={() => toggle(folder.id)}/><span className="pp-grip" title="拖动移动；Alt + 上下键排序"><i className="pi pi-bars" aria-hidden="true"/></span></div>
      <div className="pp-resource-content"><div className="pp-resource-title"><Link navigate={navigate} to={target}><i className="pi pi-folder" aria-hidden="true"/><strong>{folder.name}</strong><span>{contained.length} {project ? '小节' : '项目'}</span></Link><Actions name={folder.name} items={[
        { label: '重命名', icon: 'pi pi-pencil', disabled: readOnly, command: () => setFolderDraft({ ...folder }) },
        { label: '移至文件夹', icon: 'pi pi-folder-open', disabled: readOnly, command: () => { setSelected([folder.id]); setMoveOpen(true); } },
        { label: '上移', icon: 'pi pi-arrow-up', disabled: readOnly || visibleFolders[0]?.id === folder.id, command: () => reorder(folder.id, visibleFolders[visibleFolders.indexOf(folder) - 1]?.id) },
        { label: '下移', icon: 'pi pi-arrow-down', disabled: readOnly || visibleFolders.at(-1)?.id === folder.id, command: () => reorder(folder.id, visibleFolders[visibleFolders.indexOf(folder) + 1]?.id) },
        { separator: true }, { label: '删除文件夹', icon: 'pi pi-trash', disabled: readOnly, command: () => { const affected = contained.map(item => item.id); setConfirm({ title: '删除文件夹及全部内容', blocked: project ? hasActiveSections(store, affected) : hasActiveWork(store, affected), description: `永久删除“${folder.name}”、${Math.max(0, ids.size - 1)} 个子文件夹和 ${contained.length} 个${project ? '小节' : '项目'}。相关任务和受管图片一并删除，交付文件保留。`, run: () => { updateStore(draft => { if (project) { draft.sections = draft.sections.filter(item => !affected.includes(item.id)); draft.images = draft.images.filter(item => !affected.includes(item.sectionId)); draft.runs = draft.runs.filter(item => !affected.includes(item.sectionId)); } else deleteProjects(draft, affected); draft.folders = draft.folders.filter(item => !ids.has(item.id)); }); notify('文件夹及内容已删除'); } }); } },
      ]}/></div>{images.length > 0 && <ImageStrip images={images} navigate={navigate} to={target} label={'打开文件夹：' + folder.name}/>}{ids.size > 1 && <div className="pp-resource-meta"><span>{ids.size - 1} 个子文件夹</span></div>}</div>
    </article>;
  });
  return <section className="pp-collection" aria-label={title}>
    <div className="pp-folder-bar"><BreadCrumb home={{ label: '根目录', command: () => goFolder('') }} model={trail.map(folder => ({ label: folder.name, command: () => goFolder(folder.id) }))} pt={{ root: { style: { border: 0, background: 'transparent', padding: 0 } }, menu: { style: { flexWrap: 'wrap' } } }}/><div className="pp-actions"><Button text plain icon="pi pi-folder-plus" label="新建文件夹" disabled={readOnly} onClick={() => setFolderDraft({ name: '' })}/><Checkbox inputId={'pp-select-' + scope} checked={Boolean(visible.length + visibleFolders.length) && selected.length === visible.filter(item => !item.archived).length + visibleFolders.length} disabled={readOnly || !visible.length && !visibleFolders.length} onChange={event => setSelected(event.checked ? [...visibleFolders.map(folder => folder.id), ...visible.filter(item => !item.archived).map(item => item.id)] : [])}/><label htmlFor={'pp-select-' + scope}>全选</label></div></div>
    {folderDraft && <form className="pp-inline-form" onSubmit={event => { event.preventDefault(); const name = folderDraft.name.trim(); if (!name) return; updateStore(draft => { if (folderDraft.id) draft.folders.find(folder => folder.id === folderDraft.id).name = name; else draft.folders.push({ id: uid('folder'), name, scope, parentId: currentFolder }); }); setFolderDraft(null); notify('文件夹已保存'); }}><i className="pi pi-folder" aria-hidden="true"/><InputText aria-label="文件夹名称" autoFocus value={folderDraft.name} onChange={event => setFolderDraft({ ...folderDraft, name: event.target.value })}/><Button type="submit" icon="pi pi-check" label="保存" disabled={!folderDraft.name.trim()}/><Button type="button" text plain icon="pi pi-times" aria-label="取消编辑文件夹" onClick={() => setFolderDraft(null)}/></form>}
    {selected.length > 0 && <div className="pp-selection"><strong>已选 {selected.length} 项</strong><Button text plain label="取消选择" onClick={() => setSelected([])}/><Button outlined icon="pi pi-folder-open" label="移动" onClick={() => { setMoveTarget(currentFolder); setMoveOpen(true); }}/>{project && <><Button icon="pi pi-play" label="生成所选小节" disabled={!visible.some(item => selected.includes(item.id))} onClick={() => visible.filter(item => selected.includes(item.id)).forEach(section => createRun(section, project, section.params?.batchSize, updateStore, notify, store))}/><Button outlined severity="danger" icon="pi pi-trash" label="删除所选小节" disabled={!visible.some(item => selected.includes(item.id))} onClick={() => { const ids = visible.filter(item => selected.includes(item.id)).map(item => item.id); setConfirm({ title: '删除所选小节', description: `永久删除 ${ids.length} 个小节及其任务和图片。`, blocked: hasActiveSections(store, ids), run: () => { updateStore(draft => { draft.sections = draft.sections.filter(item => !ids.includes(item.id)); draft.runs = draft.runs.filter(item => !ids.includes(item.sectionId)); draft.images = draft.images.filter(item => !ids.includes(item.sectionId)); }); setSelected([]); notify('所选小节已删除'); } }); }}/></>}</div>}
    {folderItems.length > 0 && <div className="pp-resource-grid pp-folder-grid">{folderItems}</div>}
    <div className="pp-resource-grid">{children({ visible, selected, toggle, dragProps, reorder, setConfirm, openMove: id => { setSelected([id]); setMoveTarget(currentFolder); setMoveOpen(true); } })}</div>
    {!visible.length && !visibleFolders.length && <Empty title={currentFolder ? '此文件夹为空' : `暂无${project ? '小节' : '项目'}`}>创建内容，或将其他文件夹的内容移到这里。</Empty>}
    <Dialog visible={moveOpen} header="移动到文件夹" onHide={() => setMoveOpen(false)} style={{ width: '420px', maxWidth: 'calc(100vw - 24px)' }} footer={<><Button text plain label="取消" onClick={() => setMoveOpen(false)}/><Button label="移动到这里" onClick={() => move(selected, moveTarget)}/></>}><Field label="目标位置"><Dropdown aria-label="目标文件夹" placeholder="根目录" value={moveTarget} options={[{ label: '根目录', value: '' }, ...folders.filter(folder => !selected.some(id => folders.some(item => item.id === id) && descendantIds(folders, id).has(folder.id))).map(folder => ({ label: folderTrail(folders, folder.id).map(item => item.name).join(' / '), value: folder.id }))]} onChange={event => setMoveTarget(event.value)}/></Field></Dialog>
    <ConfirmAction action={confirm} close={() => setConfirm(null)}/>
  </section>;
}

function ProjectsList(props) {
  const { route, store, updateStore, navigate, notify } = props;
  const query = route.query.q || '', archived = route.query.archived === '1';
  const folder = route.query.folder || '';
  const records = store.projects.filter(project => (archived || !project.archived) && project.name.toLowerCase().includes(query.toLowerCase()));
  return <div className="pp-page"><PageHead title="项目" detail={`${store.projects.length} 个项目`}><Button icon="pi pi-plus" label="新建项目" onClick={() => navigate(withQuery(path('new'), { folder, from: route.key }))}/></PageHead>
    <div className="pp-list-tools"><InputText aria-label="搜索项目" placeholder="搜索项目" value={query} onChange={event => navigate(withQuery(path(), { ...route.query, q: event.target.value }))}/><label className="pp-check-label"><Checkbox checked={archived} onChange={event => navigate(withQuery(path(), { ...route.query, archived: event.checked ? '1' : '' }))}/>显示归档</label></div>
    <Collection {...props} records={records} scope="projects" currentFolder={folder} goFolder={id => navigate(withQuery(path(), { ...route.query, folder: id }))} title="项目文件夹管理">{({ visible, selected, toggle, dragProps, openMove, setConfirm, reorder }) => visible.map(project => {
      const sections = store.sections.filter(section => section.projectId === project.id), images = imageFor(store, image => image.projectId === project.id);
      const href = withQuery(path(project.id), { from: route.key });
      return <article className={'pp-resource' + (selected.includes(project.id) ? ' is-selected' : '')} key={project.id} {...dragProps(project)} tabIndex={project.archived ? undefined : 0} aria-label={'项目：' + project.name}>
        <div className="pp-resource-controls"><Checkbox aria-label={'选择项目：' + project.name} checked={selected.includes(project.id)} disabled={project.archived} onChange={() => toggle(project.id)}/><span className="pp-grip" title="拖动移动；Alt + 上下键排序"><i className="pi pi-bars" aria-hidden="true"/></span></div>
        <div className="pp-resource-content"><div className="pp-resource-title"><Link navigate={navigate} to={href}><strong>{project.name}</strong><span>{sections.length} 小节</span></Link><Actions name={project.name} items={[
          { label: '编辑项目', icon: 'pi pi-pencil', disabled: project.archived, command: () => navigate(path(project.id + '/edit')) },
          { label: '移至文件夹', icon: 'pi pi-folder-open', disabled: project.archived, command: () => openMove(project.id) },
          { label: '永久归档项目', icon: 'pi pi-inbox', disabled: project.archived, command: () => setConfirm(archiveAction(project, store, updateStore, notify)) },
          { separator: true }, { label: '彻底删除项目', icon: 'pi pi-trash', command: () => setConfirm({ title: '彻底删除项目', blocked: hasActiveWork(store, [project.id]), description: `删除“${project.name}”及其全部小节、任务与工作流快照、正常图片、打码版和回收站图片。已导出的交付文件保留。`, run: () => { updateStore(draft => deleteProjects(draft, [project.id])); notify('项目已删除'); } }) },
        ]}/></div><ImageStrip images={images} navigate={navigate} to={href} label={'打开项目最近结果：' + project.name}/><div className="pp-resource-meta"><span>{images.length} 张结果 · 更新 {project.updatedAt || '今天'}</span><Tag value={project.archived ? '已归档' : '正常'}/></div></div>
      </article>;
    })}</Collection>
  </div>;
}

function ParameterFields({ value, onChange, disabled = false, checkpoint, onCheckpoint, store, inherit = false, projectCheckpoint }) {
  const params = normalizeParams(value);
  function set(key, next) {
    const changed = { ...params, [key]: next };
    if (['aspectRatio', 'shortSidePx'].includes(key)) { const [width, height] = changed.aspectRatio.split(':').map(Number); const short = changed.shortSidePx || 768; changed.width = Math.round(width >= height ? short * width / height : short); changed.height = Math.round(height >= width ? short * height / width : short); }
    if (key === 'upscaleFactor') changed.secondEnabled = next > 1;
    onChange(changed);
  }
  const modelOptions = [...new Set([checkpoint, ...store.projects.map(item => item.checkpoint), ...((store.models || []).filter(item => item.type === 'checkpoint').map(item => item.name))].filter(Boolean))];
  return <>
    <Group title="图像输出"><div className="pp-form-grid">
      <Field label="画幅比例" wide><SelectButton aria-label="画幅比例" options={ratios} value={params.aspectRatio} allowEmpty={false} onChange={event => set('aspectRatio', event.value)} disabled={disabled}/></Field>
      <details className="pp-extra-ratios"><summary>多比例生成{params.aspectRatios?.length ? ` · 另选 ${params.aspectRatios.length} 个画幅` : ''}</summary><Field label="额外画幅（可多选）" hint="运行时分别生成所选画幅；不选则只使用上方画幅。"><SelectButton aria-label="额外画幅" options={ratios.filter(ratio => ratio !== params.aspectRatio)} value={params.aspectRatios || []} multiple onChange={event => set('aspectRatios', event.value)} disabled={disabled}/></Field></details>
      <Field label="短边像素"><InputNumber inputStyle={{ width: '100%', minWidth: 0 }} aria-label="短边像素" value={params.shortSidePx} min={256} max={4096} step={64} useGrouping={false} onValueChange={event => set('shortSidePx', event.value)} disabled={disabled}/></Field>
      <Field label="批量数"><InputNumber inputStyle={{ width: '100%', minWidth: 0 }} aria-label="批量数" value={params.batchSize} min={1} max={100} useGrouping={false} onValueChange={event => set('batchSize', event.value)} disabled={disabled}/></Field>
      <Field label="放大倍数"><Dropdown aria-label="放大倍数" value={params.upscaleFactor} options={[1, 1.5, 2, 2.5, 3, 4].map(number => ({ label: number + '×', value: number }))} onChange={event => set('upscaleFactor', event.value)} disabled={disabled}/></Field>
      <Field label="输出尺寸"><output className="pp-dimensions">{params.width} × {params.height}<span>→ {Math.round(params.width * params.upscaleFactor)} × {Math.round(params.height * params.upscaleFactor)}</span></output></Field>
      {onCheckpoint && <Field label="Checkpoint" wide><Dropdown aria-label="Checkpoint" value={checkpoint || '__inherit__'} options={[{ label: inherit ? `继承项目 · ${projectCheckpoint || '默认模型'}` : '使用默认模型', value: '__inherit__' }, ...modelOptions.map(name => ({ label: name, value: name }))]} onChange={event => onCheckpoint(event.value === '__inherit__' ? '' : event.value)} disabled={disabled}/></Field>}
    </div></Group>
    <Group title="采样器" detail="首次生成与放大精修分别配置。1× 时跳过第二阶段并保留原配置。"><div className="pp-sampler-grid">{[false, ...(params.secondEnabled ? [true] : [])].map(second => <fieldset className="pp-sampler" key={String(second)} disabled={disabled}><legend>KSampler {second ? '2 · 放大精修' : '1 · 首次生成'}</legend><div className="pp-form-grid">
      <Field label="Steps"><InputNumber inputStyle={{ width: '100%', minWidth: 0 }} aria-label={(second ? '第二' : '第一') + '阶段 Steps'} value={second ? params.secondSteps : params.steps} min={1} max={150} useGrouping={false} onValueChange={event => set(second ? 'secondSteps' : 'steps', event.value)}/></Field>
      <Field label="CFG"><InputNumber inputStyle={{ width: '100%', minWidth: 0 }} aria-label={(second ? '第二' : '第一') + '阶段 CFG'} value={second ? params.secondCfg : params.cfg} min={0} max={30} step={.5} maxFractionDigits={2} onValueChange={event => set(second ? 'secondCfg' : 'cfg', event.value)}/></Field>
      <Field label="Sampler"><Dropdown aria-label={(second ? '第二' : '第一') + '阶段 Sampler'} value={second ? params.secondSampler : params.sampler} options={samplers} onChange={event => set(second ? 'secondSampler' : 'sampler', event.value)} disabled={disabled}/></Field>
      <Field label="Scheduler"><Dropdown aria-label={(second ? '第二' : '第一') + '阶段 Scheduler'} value={second ? params.secondScheduler : params.scheduler} options={schedulers} onChange={event => set(second ? 'secondScheduler' : 'scheduler', event.value)} disabled={disabled}/></Field>
      <Field label={second ? 'Denoise' : 'Seed 策略'}>{second ? <InputNumber inputStyle={{ width: '100%', minWidth: 0 }} aria-label="Denoise" value={params.denoise} min={0} max={1} step={.05} maxFractionDigits={2} onValueChange={event => set('denoise', event.value)}/> : <Dropdown aria-label="Seed 策略" value={params.seedPolicy} options={seedPolicies} onChange={event => set('seedPolicy', event.value)} disabled={disabled}/>}</Field>
      {!second && params.seedPolicy !== 'random' && <Field label="Seed"><InputNumber inputStyle={{ width: '100%', minWidth: 0 }} aria-label="Seed" value={params.seed < 0 ? 0 : params.seed} min={0} max={2147483647} useGrouping={false} onValueChange={event => set('seed', event.value)}/></Field>}
    </div></fieldset>)}</div></Group>
  </>;
}

function PresetBindings({ store, value = [], variants = {}, onChange, onVariants, onDetach, readOnly = false }) {
  const [importing, setImporting] = useState(false), [query, setQuery] = useState(''), [category, setCategory] = useState('');
  const presets = store.presets || [], categories = store.categories || [];
  return <Group title="预制绑定" detail={`${value.length} 项`} actions={<Button outlined icon="pi pi-plus" label={importing ? '收起导入' : '导入预制'} disabled={readOnly} onClick={() => setImporting(!importing)}/> }>
    {importing && <div className="pp-import-browser"><div className="pp-actions"><Dropdown aria-label="预制分类" placeholder="全部分类" value={category} options={[{ label: '全部分类', value: '' }, ...categories.map(item => ({ label: item.name, value: item.id }))]} onChange={event => setCategory(event.value)}/><InputText aria-label="搜索预制" placeholder="搜索预制或组" value={query} onChange={event => setQuery(event.target.value)}/></div><div className="pp-import-rows">{presets.filter(item => (!category || item.categoryId === category) && item.name.toLowerCase().includes(query.toLowerCase())).map(item => <div className="pp-binding-row" key={item.id}><span><strong>{item.name}</strong><small>{categories.find(cat => cat.id === item.categoryId)?.name} · {item.variants?.length || 1} 个变体</small></span><Button outlined label={value.includes(item.id) ? '已导入' : '导入'} disabled={value.includes(item.id)} onClick={() => onChange([...value, item.id])}/></div>)}{(store.groups || []).filter(item => (!category || item.categoryId === category) && item.name.toLowerCase().includes(query.toLowerCase())).map(group => { const members = groupBindings(group, store); return <div className="pp-binding-row" key={group.id}><span><strong>{group.name}</strong><small>预制组 · {members.length} 个成员，导入后独立绑定</small></span><Button outlined label="导入组" disabled={!members.length} onClick={() => { onChange([...new Set([...value, ...members.map(item => item.presetId)])]); onVariants?.({ ...variants, ...Object.fromEntries(members.map(item => [item.presetId, item.variantId])) }); }}/></div>; })}</div></div>}
    {value.length === 0 ? <p className="pp-muted">未绑定预制</p> : <div className="pp-bindings">{value.map(id => {
      const preset = presets.find(item => item.id === id); if (!preset) return null;
      const options = (preset.variants || []).map(item => ({ label: item.name, value: item.id }));
      return <div className="pp-binding-row" key={id}><span><strong>{preset.name}</strong><small>{categories.find(item => item.id === preset.categoryId)?.name || '预制'} · 跟随来源更新</small></span><Dropdown aria-label={preset.name + '的变体'} options={options} value={variants[id] || options[0]?.value} disabled={readOnly} onChange={event => onVariants?.({ ...variants, [id]: event.value })}/>{onDetach && <Button text plain icon="pi pi-link" title="转为自定义，保留当前文本与 LoRA" aria-label={'转为自定义：' + preset.name} disabled={readOnly} onClick={() => onDetach(id)}/>}<Button text plain icon="pi pi-trash" aria-label={'移除绑定：' + preset.name} disabled={readOnly} onClick={() => onChange(value.filter(item => item !== id))}/></div>;
    })}</div>}
  </Group>;
}

function sectionFromTemplate(seed, projectId, folderId = '') {
  return { id: uid('section'), projectId, name: seed.name || '新小节', folderId, checkpoint: seed.checkpoint || '', params: normalizeParams(seed.params), prompt: seed.prompt || '', negative: seed.negative || '', presetIds: [...(seed.presetIds || [])], presetVariants: copy(seed.presetVariants || {}), bindings: copy(seed.bindings || []), loras: copy(seed.loras || []), promptBlocks: copy(seed.promptBlocks || []), history: [] };
}
function importTemplateStructure(draft, template, project, currentFolder = '') {
  const folderIds = Object.fromEntries((template.folders || []).map(folder => [folder.id, uid('folder')]));
  for (const folder of template.folders || []) draft.folders.push({ ...copy(folder), id: folderIds[folder.id], scope: 'sections:' + project.id, parentId: folderIds[folder.parentId] || currentFolder });
  for (const seed of template.sections || []) draft.sections.push(sectionFromTemplate({ ...seed, params: { ...project.params, ...Object.fromEntries(Object.entries(seed.params || {}).filter(([, value]) => value != null)) } }, project.id, folderIds[seed.folderId] || currentFolder));
}
function ProjectForm(props) {
  const { project, store, updateStore, notify, navigate, route } = props, edit = Boolean(project);
  const [draft, setDraft] = useState(() => copy(project || { name: '', slug: '', description: '', folderId: route.query.folder || '', checkpoint: store.projects[0]?.checkpoint || '', params: normalizeParams(), presetIds: [], presetVariants: {} }));
  const [templateId, setTemplateId] = useState(''), [applyFields, setApplyFields] = useState([]), [dirty, setDirty] = useState(false);
  const readOnly = Boolean(project?.archived);
  const slugError = !draft.slug ? '请输入英文标识' : !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug) ? '只允许小写字母、数字和连字符' : store.projects.some(item => item.id !== project?.id && item.slug === draft.slug) ? '英文标识已被使用' : '';
  function set(key, value) { setDraft(current => ({ ...current, [key]: value })); setDirty(true); }
  useEffect(() => { const block = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', block); return () => window.removeEventListener('beforeunload', block); }, [dirty]);
  function save(event) {
    event.preventDefault(); if (readOnly || !draft.name.trim() || slugError) return;
    const id = project?.id || uid('project');
    updateStore(next => {
      const value = { ...draft, name: draft.name.trim(), id, archived: draft.archived || false, updatedAt: '今天' };
      if (edit) { next.projects[next.projects.findIndex(item => item.id === id)] = value; next.sections.filter(item => item.projectId === id).forEach(item => { for (const field of applyFields) { if (field === 'checkpoint') item.checkpoint = value.checkpoint; else if (field === 'presets') { item.presetIds = [...value.presetIds]; item.presetVariants = copy(value.presetVariants || {}); } else item.params = { ...item.params, [field]: copy(value.params[field]) }; } }); }
      else { next.projects.push(value); const template = (next.templates || []).find(item => item.id === templateId); if (template) importTemplateStructure(next, template, value); }
    }); setDirty(false); notify(edit ? '项目已保存' : '项目已创建'); navigate(path(id));
  }
  return <form className="pp-page" onSubmit={save}><PageHead title={edit ? '编辑项目' : '创建新项目'} back={{ to: project ? path(project.id) : withQuery(path(), { folder: route.query.folder }), label: '返回项目' }} navigate={navigate}><Button type="button" text plain label="取消" onClick={() => navigate(project ? path(project.id) : path())}/><Button type="submit" icon="pi pi-check" label={edit ? '保存' : '创建项目'} disabled={!draft.name.trim() || Boolean(slugError) || readOnly}/></PageHead>
    <div className="pp-editor-form"><Group title="基础信息"><div className="pp-form-grid"><Field label="项目名称"><InputText aria-label="项目名称" value={draft.name} onChange={event => set('name', event.target.value)} disabled={readOnly} required/></Field><Field label="英文标识 slug" hint={draft.slug ? slugError || '用于导出文件夹，项目间不能重复。' : '小写字母、数字与连字符，例如 rainy-street。'}><InputText aria-label="英文标识 slug" value={draft.slug || ''} onChange={event => set('slug', event.target.value)} invalid={Boolean(draft.slug && slugError)} disabled={readOnly} required/></Field><Field label="所在文件夹" wide><Dropdown aria-label="所在文件夹" placeholder="根目录" value={draft.folderId || ''} options={[{ label: '根目录', value: '' }, ...store.folders.filter(folder => folder.scope === 'projects').map(folder => ({ label: folderTrail(store.folders, folder.id).map(item => item.name).join(' / '), value: folder.id }))]} disabled={readOnly} onChange={event => set('folderId', event.value)}/></Field><Field label="备注" wide><InputTextarea aria-label="备注" value={draft.description || ''} rows={3} autoResize onChange={event => set('description', event.target.value)} disabled={readOnly}/></Field></div></Group>
      {!edit && <Group title="初始模板"><Field label="选择模板" hint="选择后预填默认参数，创建时深复制全部文件夹与小节。"><Dropdown aria-label="选择项目模板" placeholder="空白项目（不使用模板）" value={templateId} options={[{ label: '空白项目', value: '' }, ...(store.templates || []).map(item => ({ label: `${item.name} · ${item.sections.length} 个小节`, value: item.id }))]} onChange={event => { setTemplateId(event.value); const template = store.templates?.find(item => item.id === event.value); if (template) { set('checkpoint', template.checkpoint || ''); if (template.sections[0]) set('params', normalizeParams(template.sections[0].params)); } }}/></Field></Group>}
      <PresetBindings store={store} value={draft.presetIds} variants={draft.presetVariants} onChange={value => set('presetIds', value)} onVariants={value => set('presetVariants', value)} readOnly={readOnly}/>
      <ParameterFields value={draft.params} onChange={value => set('params', value)} checkpoint={draft.checkpoint} onCheckpoint={value => set('checkpoint', value)} store={store} disabled={readOnly}/>
      {edit && <Group title="应用到已有小节" detail={`默认仅影响以后新建的小节。勾选的字段会覆盖全部 ${store.sections.filter(item => item.projectId === project.id).length} 个图片小节。`}><div className="pp-apply-fields">{[{ value: 'checkpoint', label: 'Checkpoint' }, { value: 'presets', label: '预制绑定' }, { value: 'batchSize', label: '批量数' }, { value: 'width', label: '宽度' }, { value: 'height', label: '高度' }, { value: 'steps', label: 'Steps' }, { value: 'cfg', label: 'CFG' }, { value: 'upscaleFactor', label: '放大倍数' }].map(field => <label className="pp-check-label" key={field.value}><Checkbox checked={applyFields.includes(field.value)} disabled={readOnly} onChange={event => setApplyFields(current => event.checked ? [...current, field.value] : current.filter(item => item !== field.value))}/>{field.label}</label>)}</div></Group>}
    </div>
  </form>;
}

function createRun(section, project, batchSize, updateStore, notify, store) {
  if (project.archived) return;
  let compiled;
  try { compiled = compileSection(section, store); } catch (error) { notify(error.message, 'error'); return; }
  const params = normalizeParams(section.params), selections = [...new Set([params.aspectRatio, ...(params.aspectRatios || [])])];
  const created = selections.map(ratio => { const [a, b] = ratio.split(':').map(Number), short = params.shortSidePx; return { id: uid('run'), projectId: project.id, sectionId: section.id, status: 'unsubmitted', progress: 0, batchSize: batchSize || params.batchSize || 2, createdAt: new Date().toISOString(), checkpoint: section.checkpoint || project.checkpoint, params: { ...copy(params), aspectRatio: ratio, width: Math.round(a >= b ? short * a / b : short), height: Math.round(b >= a ? short * b / a : short) }, ...copy(compiled), error: '' }; });
  updateStore(draft => { draft.runs.unshift(...created); }); notify(`“${section.name}”已加入 ${created.length} 个待提交任务，批量 ${created[0].batchSize}`);
}
function downloadCurrentWorkflow(section, project, store, format, notify) {
  try {
    const payload = { source: 'production-prototype', synthetic: true, format, scope: 'current-section', project: { id: project.id, name: project.name }, section: { id: section.id, name: section.name }, checkpoint: section.checkpoint || project.checkpoint, params: section.params, ...compileSection(section, store), ...(format === 'debug' ? { debug: { projectDefaults: project.params, presetIds: section.presetIds, presetVariants: section.presetVariants || {} } } : {}) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `${section.name}-${format}-prototype.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); notify('已下载当前小节的演示工作流 JSON');
  } catch { notify('下载失败，请重试', 'error'); }
}
function SectionCard({ section, project, store, updateStore, notify, navigate, selected, toggle, dragProps, openMove, setConfirm, reorder, sections }) {
  const [batch, setBatch] = useState(section.params?.batchSize || 2), readonly = project.archived;
  const images = imageFor(store, image => image.sectionId === section.id), runs = store.runs.filter(run => run.sectionId === section.id), last = runs[0];
  const href = path(project.id + '/sections/' + section.id);
  return <article className={'pp-section-card' + (selected ? ' is-selected' : '')} {...dragProps(section)} tabIndex={readonly ? undefined : 0} aria-label={'小节：' + section.name} id={'pp-section-' + section.id}>
    <div className="pp-section-header"><Checkbox aria-label={'选择小节：' + section.name} checked={selected} disabled={readonly} onChange={() => toggle(section.id)}/><Link navigate={navigate} to={href}><span>{sections.indexOf(section) + 1}</span><strong>{section.name}</strong></Link><Actions name={section.name} items={[
      { label: '复制小节', icon: 'pi pi-copy', disabled: readonly, command: () => { updateStore(draft => draft.sections.splice(draft.sections.findIndex(item => item.id === section.id) + 1, 0, { ...sectionFromTemplate(section, project.id, section.folderId), name: section.name + '（副本）' })); notify('小节已复制到来源之后'); } },
      { label: '移至文件夹', icon: 'pi pi-folder-open', disabled: readonly, command: () => openMove(section.id) },
      { label: '上移', icon: 'pi pi-arrow-up', disabled: readonly || sections[0]?.id === section.id, command: () => reorder(section.id, sections[sections.indexOf(section) - 1]?.id) },
      { label: '下移', icon: 'pi pi-arrow-down', disabled: readonly || sections.at(-1)?.id === section.id, command: () => reorder(section.id, sections[sections.indexOf(section) + 1]?.id) },
      { separator: true }, { label: '删除小节', icon: 'pi pi-trash', disabled: readonly, command: () => setConfirm({ title: '删除小节', blocked: hasActiveSections(store, [section.id]), description: `删除“${section.name}”及其任务和模拟结果。`, run: () => { updateStore(draft => { draft.sections = draft.sections.filter(item => item.id !== section.id); draft.runs = draft.runs.filter(item => item.sectionId !== section.id); draft.images = draft.images.filter(item => item.sectionId !== section.id); }); notify('小节已删除'); } }) },
    ]}/></div><ImageStrip images={images} navigate={navigate} to={href} label={'打开小节最近结果：' + section.name}/><div className="pp-section-actions"><span>{last ? '最后运行：' + new Date(last.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '尚未运行'}</span><div className="pp-run-controls"><SelectButton pt={{ button: { style: { paddingInline: '9px' } } }} value={batch} options={[1, 2, 4, 8, 16]} aria-label={section.name + '运行批量'} allowEmpty={false} onChange={event => { setBatch(event.value); updateStore(draft => { draft.sections.find(item => item.id === section.id).params.batchSize = event.value; }); }} disabled={readonly}/><Button icon="pi pi-play" aria-label={'运行小节：' + section.name} disabled={readonly} onClick={() => createRun(section, project, batch, updateStore, notify, store)}/></div></div>
  </article>;
}

function SectionRail({ sections, project, navigate, active, editor = false }) {
  return <aside className="pp-section-rail"><h2>小节导航 <span>{sections.length}</span></h2><nav aria-label="小节导航">{sections.map((section, index) => <Link key={section.id} className={active === section.id ? 'is-active' : ''} navigate={editor ? navigate : () => document.getElementById('pp-section-' + section.id)?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })} to={path(project.id + '/sections/' + section.id)}><span>{index + 1}</span><strong>{section.name}</strong></Link>)}</nav></aside>;
}

function ProjectDetail(props) {
  const { project, route, store, updateStore, notify, navigate } = props;
  const listOrigin = useProjectListOrigin(project, route.query.from);
  const sections = store.sections.filter(section => section.projectId === project.id), folder = route.query.folder || '', view = route.segments[2] === 'results' ? 'results' : 'sections';
  const [templateOpen, setTemplateOpen] = useState(false), [template, setTemplate] = useState(''), [confirm, setConfirm] = useState(null), [operation, setOperation] = useState('');
  function addSection() {
    if (project.archived) return;
    const section = sectionFromTemplate({ name: '新小节 ' + (sections.length + 1), params: project.params, presetIds: project.presetIds }, project.id, folder);
    updateStore(draft => draft.sections.push(section)); navigate(path(project.id + '/sections/' + section.id));
  }
  return <div className="pp-page"><PageHead title={project.name} detail={`${sections.length} 个小节${project.archived ? ' · 已归档，只读' : ''}`} back={{ to: listOrigin, label: '返回项目列表' }} navigate={navigate}>
    <Button outlined icon="pi pi-plus" label="新建小节" disabled={project.archived} onClick={addSection}/><Button icon="pi pi-play" label="生成全部" disabled={project.archived || !sections.length} onClick={() => sections.forEach(section => createRun(section, project, section.params?.batchSize, updateStore, notify, store))}/><Actions name={project.name} items={[
      { label: '编辑项目', icon: 'pi pi-pencil', disabled: project.archived, command: () => navigate(path(project.id + '/edit')) },
      { label: '导入模板', icon: 'pi pi-download', disabled: project.archived, command: () => setTemplateOpen(true) },
      { label: '同步变体分配', icon: 'pi pi-sync', disabled: project.archived, command: () => setOperation('sync') },
      { label: '替换预制引用', icon: 'pi pi-refresh', disabled: project.archived, command: () => setOperation('replace') },
      { label: '精选图片批量打码', icon: 'pi pi-eye-slash', disabled: project.archived, command: () => setOperation('censor') },
      { label: '导出项目图片', icon: 'pi pi-upload', command: () => setOperation('export') },
      { label: '另存为模板', icon: 'pi pi-clone', disabled: project.archived, command: () => setOperation('template') },
      { label: '查看项目任务', icon: 'pi pi-list', command: () => navigate(withQuery('production/tasks', { project: project.id })) },
      { label: '永久归档项目', icon: 'pi pi-inbox', disabled: project.archived, command: () => setConfirm(archiveAction(project, store, updateStore, notify)) },
    ]}/></PageHead>
    <TabMenu activeIndex={view === 'results' ? 1 : 0} model={[{ label: '小节', icon: 'pi pi-th-large', command: () => navigate(withQuery(path(project.id), { folder })) }, { label: '结果', icon: 'pi pi-images', command: () => navigate(path(project.id + '/results')) }]}/>
    <div className="pp-with-rail"><div className="pp-detail-main">{view === 'sections' ? <Collection {...props} scope={'sections:' + project.id} currentFolder={folder} goFolder={id => navigate(withQuery(path(project.id), { folder: id }))} records={sections} title="项目小节与文件夹">{controls => controls.visible.map(section => <SectionCard key={section.id} {...props} {...controls} section={section} selected={controls.selected.includes(section.id)} sections={controls.visible}/>)}</Collection> : <div className="pp-result-groups">{sections.map((section, index) => <section key={section.id} id={'pp-section-' + section.id} className="pp-result-group"><div className="pp-result-heading"><Link navigate={navigate} to={path(project.id + '/sections/' + section.id)}><span>{index + 1}</span><h2>{section.name}</h2></Link><span>{imageFor(store, image => image.sectionId === section.id).length} 张图片</span></div><ProductionImageBoard images={store.images.filter(image => image.sectionId === section.id)} store={store} updateStore={updateStore} notify={notify} readOnly={project.archived}/></section>)}</div>}</div><SectionRail sections={sections} project={project} navigate={navigate}/></div>
    <Dialog visible={templateOpen} header="导入模板" onHide={() => setTemplateOpen(false)} style={{ width: '460px', maxWidth: 'calc(100vw - 24px)' }} footer={<><Button text plain label="取消" onClick={() => setTemplateOpen(false)}/><Button label="导入小节" disabled={!template} onClick={() => { const target = store.templates.find(item => item.id === template); updateStore(draft => importTemplateStructure(draft, target, project, folder)); setTemplateOpen(false); notify(`已导入 ${target.sections.length} 个小节及完整文件夹结构`); }}/></>}><Field label="选择模板"><Dropdown aria-label="导入的模板" placeholder="选择模板" value={template} options={(store.templates || []).map(item => ({ label: `${item.name} · ${item.sections.length} 小节`, value: item.id }))} onChange={event => setTemplate(event.value)}/></Field><p className="pp-muted">深复制全部文件夹层级、小节和配置，追加到当前文件夹。保留现有内容。</p></Dialog>
    <ProjectOperationDialog key={operation} {...props} operation={operation} close={() => setOperation('')}/>
    <ProductionExportDialog {...props} visible={operation === 'export'} onHide={() => setOperation('')}/>
    <ConfirmAction action={confirm} close={() => setConfirm(null)}/>
  </div>;
}

function ProjectOperationDialog({ project, store, updateStore, notify, navigate, operation, close }) {
  const [source, setSource] = useState(''), [category, setCategory] = useState(''), [target, setTarget] = useState(''), [name, setName] = useState(project.name + '模板'), [description, setDescription] = useState(project.description || '');
  const sections = store.sections.filter(item => item.projectId === project.id), presets = store.presets || [];
  const candidates = store.images.filter(image => image.projectId === project.id && !image.trashed && (image.tags || []).some(tag => ['featured', 'preview', 'cover'].includes(tag)));
  const remaining = candidates.filter(image => !image.censored);
  const sourceSections = store.sections.filter(item => item.projectId === source);
  const syncRows = source && category ? sections.flatMap(section => {
    const matches = sourceSections.filter(item => item.name === section.name); if (matches.length !== 1) return [];
    const fromSection = matches[0], fromPreset = presets.find(item => item.categoryId === category && fromSection.presetIds?.includes(item.id)), toPreset = presets.find(item => item.categoryId === category && section.presetIds?.includes(item.id));
    if (!fromPreset || !toPreset) return [];
    const fromVariant = fromPreset.variants?.find(item => item.id === fromSection.presetVariants?.[fromPreset.id]) || fromPreset.variants?.[0];
    const targetVariant = toPreset.variants?.find(item => item.name === fromVariant?.name); if (!targetVariant) return [];
    const oldVariant = toPreset.variants?.find(item => item.id === section.presetVariants?.[toPreset.id]) || toPreset.variants?.[0];
    return [{ sectionId: section.id, name: section.name, presetId: toPreset.id, variantId: targetVariant.id, before: oldVariant?.name, after: targetVariant.name, changed: oldVariant?.id !== targetVariant.id }];
  }) : [];
  const changed = syncRows.filter(item => item.changed), sourcePreset = presets.find(item => item.id === source), affected = sections.filter(section => section.presetIds?.includes(source));
  const visible = ['sync', 'censor', 'template', 'replace'].includes(operation);
  const title = { sync: '同步变体分配', censor: '精选图片批量打码', template: '另存为模板', replace: '替换预制引用' }[operation];
  const disabled = project.archived || (operation === 'sync' ? !changed.length : operation === 'censor' ? !remaining.length : operation === 'template' ? !name.trim() : !source || !target || !affected.length);
  function apply() {
    if (disabled) return;
    if (operation === 'censor') {
      updateStore(draft => { draft.censorJobs.push({ id: uid('censor'), projectId: project.id, name: project.name + ' · 精选图片', status: 'running', done: 0, total: remaining.length, failed: 0, imageIds: remaining.map(image => image.id), createdAt: new Date().toISOString() }); }); notify(`已创建打码任务，共 ${remaining.length} 张`);
    } else if (operation === 'sync') {
      updateStore(draft => changed.forEach(row => { const section = draft.sections.find(item => item.id === row.sectionId); section.presetVariants = { ...section.presetVariants, [row.presetId]: row.variantId }; })); notify(`已同步 ${changed.length} 个小节的变体分配`);
    } else if (operation === 'replace') {
      updateStore(draft => { const owners = [draft.projects.find(item => item.id === project.id), ...draft.sections.filter(item => item.projectId === project.id)]; for (const owner of owners) if (owner.presetIds?.includes(source)) { owner.presetIds = [...new Set(owner.presetIds.map(id => id === source ? target : id))]; const { [source]: removed, ...rest } = owner.presetVariants || {}; owner.presetVariants = { ...rest, [target]: presets.find(item => item.id === target)?.variants?.[0]?.id }; } }); notify('当前项目的预制引用已替换');
    } else {
      const id = uid('template'), ownFolders = store.folders.filter(folder => folder.scope === 'sections:' + project.id);
      const folderMap = Object.fromEntries(ownFolders.map(folder => [folder.id, uid('template-folder')]));
      updateStore(draft => draft.templates.push({ id, name: name.trim(), description, checkpoint: project.checkpoint, updatedAt: new Date().toLocaleDateString('zh-CN'), folders: ownFolders.map(folder => ({ id: folderMap[folder.id], name: folder.name, parentId: folderMap[folder.parentId] || null })), sections: sections.map(section => { const item = sectionFromTemplate(section, undefined, folderMap[section.folderId] || null); delete item.projectId; delete item.history; return item; }) })); notify('已另存为模板'); close(); navigate('production/templates/' + id + '/edit'); return;
    }
    close();
  }
  return <Dialog visible={visible} header={title} onHide={close} style={{ width: '580px', maxWidth: 'calc(100vw - 24px)' }} footer={<><Button text plain label="取消" onClick={close}/><Button label={{ sync: '应用变体分配', censor: '创建打码任务', template: '另存模板', replace: '替换引用' }[operation]} disabled={disabled} onClick={apply}/></>}><div className="pp-dialog-content">
    {operation === 'censor' && <><p>处理 P站、预览与封面用途图片，重复用途只计一次。</p><dl className="pp-summary-counts"><div><dt>精选图片</dt><dd>{candidates.length}</dd></div><div><dt>已有打码，跳过</dt><dd>{candidates.length - remaining.length}</dd></div><div><dt>本次处理</dt><dd>{remaining.length}</dd></div></dl>{!remaining.length && <p className="pp-muted">没有待处理图片。</p>}<p className="pp-muted">创建后可在任务工作台暂停、恢复或取消。本地演示只模拟处理状态。</p></>}
    {operation === 'template' && <><Field label="模板名称"><InputText aria-label="另存模板名称" value={name} onChange={event => setName(event.target.value)}/></Field><Field label="描述"><InputTextarea aria-label="另存模板描述" value={description} rows={2} onChange={event => setDescription(event.target.value)}/></Field><p className="pp-muted">复制全部文件夹与 {sections.length} 个小节的配置、提示词片段、预制绑定和 LoRA，不复制任务、图片、slug 或导出文件。</p></>}
    {operation === 'sync' && <><div className="pp-form-grid"><Field label="来源项目"><Dropdown aria-label="同步来源项目" placeholder="选择来源项目" value={source} options={store.projects.filter(item => item.id !== project.id).map(item => ({ label: item.name, value: item.id }))} onChange={event => setSource(event.value)}/></Field><Field label="预制分类"><Dropdown aria-label="同步预制分类" placeholder="选择预制分类" value={category} options={(store.categories || []).filter(item => item.type !== 'group').map(item => ({ label: item.name, value: item.id }))} onChange={event => setCategory(event.value)}/></Field></div><p className="pp-muted">按小节名称精确匹配，仅同步当前分类的同名变体。其他分类保持原样。</p>{source && category && <><p>将改变 {changed.length} 个小节 · 未匹配 {sections.length - syncRows.length} 个</p><div className="pp-sync-rows">{changed.map(row => <div key={row.sectionId}><strong>{row.name}</strong><span>{row.before} → {row.after}</span></div>)}</div>{!changed.length && <p className="pp-muted">当前没有可应用的变化。</p>}</>}</>}
    {operation === 'replace' && <><Field label="原预制"><Dropdown aria-label="要替换的原预制" placeholder="选择原预制" value={source} options={presets.map(item => ({ label: item.name, value: item.id }))} onChange={event => { setSource(event.value); setTarget(''); }}/></Field><Field label="替换为同分类预制"><Dropdown aria-label="替换目标预制" placeholder="选择同分类目标预制" value={target} options={presets.filter(item => item.categoryId === sourcePreset?.categoryId && item.id !== source).map(item => ({ label: item.name, value: item.id }))} onChange={event => setTarget(event.value)}/></Field><p className="pp-muted">影响当前项目内 {affected.length} 个小节的绑定。新引用使用目标默认变体，其他分类保持原样。</p></>}
  </div></Dialog>;
}

function PromptEditor({ section, update, readOnly, store, onDetach }) {
  const [drag, setDrag] = useState(null);
  const blocks = manualPromptBlocks(section);
  let sources = [], preview = { prompt: '', negative: '' }, error = '';
  try { sources = resolvedSectionBindings(section, store); preview = compileSection(section, store); } catch (reason) { error = reason.message; }
  function save(next, title) { update({ promptBlocks: next, prompt: next.map(item => item.positive || '').filter(Boolean).join(', '), negative: next.map(item => item.negative || '').filter(Boolean).join(', ') }, 'prompt', title); }
  function reorder(id, delta) { const next = copy(blocks), index = next.findIndex(item => item.id === id), to = index + delta; if (to < 0 || to >= next.length) return; next.splice(to, 0, next.splice(index, 1)[0]); save(next, '调整提示词块顺序'); }
  return <Group title="提示词块" detail="正向与负向并排编辑，按块顺序合并。" actions={<Button outlined label="新增提示词块" icon="pi pi-plus" disabled={readOnly} onClick={() => save([...blocks, { id: uid('block'), name: '自定义块', positive: '', negative: '' }], '新增提示词块')}/>}>
    {error && <p className="pp-blocked" role="alert">{error}</p>}
    {sources.map(({ preset, variant, bindingId, resolved }) => <section key={bindingId} className="pp-bound-prompt"><header><div><strong>{preset.name} / {variant.name}</strong><span>跟随预制内容</span></div><Button outlined label="转为自定义" disabled={readOnly} onClick={() => onDetach(preset.id)}/></header><div className="pp-prompt-pair"><div><h3>正向</h3><p>{resolved.prompt || '未填写'}</p></div><div><h3>负向</h3><p>{resolved.negative || '未填写'}</p></div></div></section>)}
    <div className="pp-prompt-blocks">{blocks.map((block, index) => <section className="pp-prompt-block" key={block.id} draggable={!readOnly} onDragStart={event => { if (event.target.closest('input,textarea,button')) { event.preventDefault(); return; } setDrag(block.id); }} onDragOver={event => event.preventDefault()} onDrop={() => { if (drag) reorder(drag, index - blocks.findIndex(item => item.id === drag)); setDrag(null); }}><header><strong>{block.name || `提示词块 ${index + 1}`}</strong><div className="pp-actions"><Button text plain icon="pi pi-arrow-up" aria-label="上移提示词块" disabled={readOnly || index === 0} onClick={() => reorder(block.id, -1)}/><Button text plain icon="pi pi-arrow-down" aria-label="下移提示词块" disabled={readOnly || index === blocks.length - 1} onClick={() => reorder(block.id, 1)}/><Button text plain icon="pi pi-trash" aria-label="删除提示词块" disabled={readOnly} onClick={() => save(blocks.filter(item => item.id !== block.id), '删除提示词块')}/></div></header><div className="pp-prompt-pair">{['positive', 'negative'].map(column => <Field label={column === 'positive' ? '正向' : '负向'} key={column}><InputTextarea aria-label={(column === 'positive' ? '正向' : '负向') + '提示词：' + block.name} autoResize rows={4} value={block[column] || ''} disabled={readOnly} onChange={event => save(blocks.map(item => item.id === block.id ? { ...item, [column]: event.target.value } : item), '编辑提示词块')}/></Field>)}</div></section>)}</div>
    <details className="pp-compiled"><summary>查看合并后的提示词</summary><h3>正向</h3><p>{preview.prompt || '未填写'}</p><h3>负向</h3><p>{preview.negative || '未填写'}</p></details>
  </Group>;
}

function LoraEditor({ section, update, readOnly, store }) {
  const entries = (section.loras || []).filter(item => !item.bindingId && !item.presetId);
  const options = [...new Set(entries.map(item => item.path || item.name).concat((store.presets || []).flatMap(preset => (preset.variants || []).flatMap(variant => (variant.loras || []).map(item => item.path)))))].filter(Boolean);
  let inherited = [], error = '';
  try { inherited = inheritedSectionLoras(section, store); } catch (reason) { error = reason.message; }
  const disabledSources = section.disabledPresetLoras || [];
  const save = (next, label) => update({ loras: next }, 'lora', label);
  const change = (id, patch) => save(entries.map(item => item.id === id ? { ...item, ...patch } : item), '更新 LoRA 配置');
  return <Group title="LoRA 配置" detail="从已登记模型选择。预制来源可在当前小节停用，或转为手动后编辑。">{error && <p className="pp-blocked" role="alert">{error}</p>}<div className="pp-lora-pair">{[1, ...(normalizeParams(section.params).secondEnabled ? [2] : [])].map(stage => <section className="pp-lora-stage" key={stage}>
    <header><h3>LoRA {stage}</h3><Button outlined label="添加" icon="pi pi-plus" disabled={readOnly || !options.length} onClick={() => save([...entries, { id: uid('lora'), path: options[0], weight: 1, stage, enabled: true }], '添加 LoRA')}/></header>
    {inherited.filter(item => (item.stage || 1) === stage).map(item => <div className="pp-lora-entry pp-bound-lora" key={item.id}><label className="pp-check-label"><Checkbox checked={!disabledSources.includes(item.id)} disabled={readOnly} onChange={event => update({ disabledPresetLoras: event.checked ? disabledSources.filter(id => id !== item.id) : [...disabledSources, item.id] }, 'lora', '切换预制 LoRA 启用')}/>来自 {item.source}</label><strong>{item.path}</strong><div className="pp-actions"><span className="pp-muted">权重 {item.weight}</span><Button text plain label="转为手动" disabled={readOnly} onClick={() => update({ loras: [...entries, { ...item, id: uid('lora'), enabled: true, source: 'manual', presetId: undefined, bindingId: undefined, categoryId: undefined }], disabledPresetLoras: [...new Set([...disabledSources, item.id])] }, 'lora', '预制 LoRA 转为手动')}/></div></div>)}
    {entries.filter(item => (item.stage || 1) === stage).map((item, index, list) => <div className="pp-lora-entry" key={item.id}><div className="pp-lora-title"><label className="pp-check-label"><Checkbox checked={item.enabled !== false} disabled={readOnly} onChange={event => change(item.id, { enabled: event.checked })}/>手动 LoRA</label><Actions name={'LoRA ' + (index + 1)} items={[{ label: '上移', icon: 'pi pi-arrow-up', disabled: readOnly || index === 0, command: () => { const next = copy(entries), from = next.findIndex(entry => entry.id === item.id), to = next.findIndex(entry => entry.id === list[index - 1].id); next.splice(to, 0, next.splice(from, 1)[0]); save(next, '调整 LoRA 顺序'); } }, { label: '移除', icon: 'pi pi-trash', disabled: readOnly, command: () => save(entries.filter(entry => entry.id !== item.id), '移除 LoRA') }]}/></div><Field label="模型"><Dropdown aria-label={`LoRA ${stage} 模型 ${index + 1}`} value={item.path || item.name || ''} options={options} disabled={readOnly} onChange={event => change(item.id, { path: event.value })}/></Field><Field label="权重"><InputNumber inputStyle={{ width: '100%', minWidth: 0 }} aria-label={`LoRA ${stage} 权重 ${index + 1}`} value={item.weight ?? 1} min={-2} max={2} step={.05} maxFractionDigits={2} disabled={readOnly || item.enabled === false} onValueChange={event => change(item.id, { weight: event.value })}/></Field>{item.trigger && <div className="pp-trigger-row"><span>{item.trigger}</span><Button text plain icon="pi pi-copy" aria-label="复制触发词" onClick={() => navigator.clipboard.writeText(item.trigger)}/></div>}</div>)}
    {!entries.some(item => (item.stage || 1) === stage) && !inherited.some(item => (item.stage || 1) === stage) && <p className="pp-muted">未配置 LoRA</p>}
  </section>)}</div></Group>;
}

function SectionEditor(props) {
  const { project, section, store, updateStore, notify, navigate, route } = props;
  const tabs = [{ id: 'params', label: '参数' }, { id: 'presets', label: '预制' }, { id: 'prompts', label: '提示词' }, { id: 'lora', label: 'LoRA' }, { id: 'history', label: '历史' }, { id: 'results', label: '结果' }];
  const tab = tabs.find(item => item.id === route.query.tab)?.id || 'params', sections = store.sections.filter(item => item.projectId === project.id), index = sections.findIndex(item => item.id === section.id), readOnly = project.archived;
  const [historyFilter, setHistoryFilter] = useState('all'), [historyPage, setHistoryPage] = useState(0), [restore, setRestore] = useState(null);
  function update(patch, dimension = 'params', title = '调整运行参数') {
    if (readOnly) return;
    updateStore(draft => {
      const item = draft.sections.find(record => record.id === section.id), before = Object.fromEntries(Object.keys(patch).map(key => [key, item[key]]));
      Object.assign(item, patch);
      const history = item.history || []; const last = history[0];
      if (last?.title === title && Date.now() - new Date(last.timestamp).getTime() < 4000) last.after = copy(patch);
      else history.unshift({ id: uid('change'), timestamp: new Date().toISOString(), dimension, title, before, after: copy(patch) });
      item.history = history;
    });
  }
  function detach(id) {
    try {
      const matches = resolvedSectionBindings(section, store).filter(item => item.preset.id === id); if (!matches.length) return;
      const loras = inheritedSectionLoras(section, store).filter(item => item.presetId === id && !(section.disabledPresetLoras || []).includes(item.id) && !(section.disabledPresetLoras || []).includes(item.legacyId));
      update({ presetIds: section.presetIds.filter(item => item !== id), bindings: (section.bindings || []).filter(item => item.presetId !== id), promptBlocks: [...manualPromptBlocks(section), ...matches.map(match => ({ id: uid('block'), name: match.preset.name + ' / ' + match.variant.name, positive: match.resolved.prompt, negative: match.resolved.negative }))], loras: [...(section.loras || []).filter(item => !item.bindingId && !item.presetId), ...copy(loras).map(item => ({ ...item, id: uid('lora'), presetId: undefined, bindingId: undefined, categoryId: undefined, source: 'manual' }))] }, 'preset', '预制转为自定义');
    } catch (error) { notify(error.message, 'error'); }
  }
  useEffect(() => {
    const onKey = event => { if (event.target.closest('input,textarea,select,[contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey) return; const next = event.key === '[' ? sections[index - 1] : event.key === ']' ? sections[index + 1] : null; if (next) { event.preventDefault(); navigate(withQuery(path(project.id + '/sections/' + next.id), { tab })); } };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [index, tab, project.id]);
  const history = (section.history || []).filter(item => historyFilter === 'all' || item.dimension === historyFilter);
  const runs = store.runs.filter(run => run.sectionId === section.id);
  return <div className="pp-page"><PageHead title={section.name} detail={`${project.name} · 第 ${index + 1} / ${sections.length} 小节${readOnly ? ' · 已归档，只读' : ''}`} back={{ to: withQuery(path(project.id), { folder: section.folderId }), label: '返回小节列表' }} navigate={navigate}><Button outlined icon="pi pi-angle-left" aria-label="上一小节" disabled={index <= 0} onClick={() => navigate(withQuery(path(project.id + '/sections/' + sections[index - 1].id), { tab }))}/><Button outlined icon="pi pi-angle-right" aria-label="下一小节" disabled={index >= sections.length - 1} onClick={() => navigate(withQuery(path(project.id + '/sections/' + sections[index + 1].id), { tab }))}/><Button icon="pi pi-play" label="运行" disabled={readOnly} onClick={() => createRun(section, project, section.params?.batchSize, updateStore, notify, store)}/><Actions name="当前小节" items={[{ label: "下载原始工作流（演示）", icon: "pi pi-download", command: () => downloadCurrentWorkflow(section, project, store, "original", notify) }, { label: "下载调试工作流（演示）", icon: "pi pi-code", command: () => downloadCurrentWorkflow(section, project, store, "debug", notify) }]}/></PageHead>
    <div className="pp-editor-tabs"><TabMenu pt={{ root: { style: { overflowX: "auto" } }, menu: { style: { flexWrap: "nowrap" } }, menuitem: { style: { flex: "0 0 auto" } }, action: { style: { padding: "10px 12px" } }, label: { style: { whiteSpace: "nowrap" } } }} activeIndex={tabs.findIndex(item => item.id === tab)} model={tabs.map(item => ({ label: item.label, command: () => navigate(withQuery(path(project.id + '/sections/' + section.id), { tab: item.id })) }))}/><span className="pp-save-state">{readOnly ? '只读' : '改动自动保存'}</span></div>
    <div className="pp-with-rail"><div className="pp-editor-main">
      {tab === 'params' && <><Group title="小节信息"><Field label="小节名称"><InputText aria-label="小节名称" value={section.name} disabled={readOnly} onChange={event => update({ name: event.target.value }, 'params', '重命名小节')}/></Field></Group><ParameterFields value={section.params} onChange={params => update({ params })} store={store} disabled={readOnly} checkpoint={section.checkpoint || ''} projectCheckpoint={project.checkpoint} onCheckpoint={checkpoint => update({ checkpoint }, 'params', '调整 Checkpoint')} inherit/></>}
      {tab === 'presets' && <PresetBindings store={store} value={section.presetIds} variants={{ ...Object.fromEntries((section.bindings || []).map(binding => [binding.presetId, binding.variantId])), ...section.presetVariants }} onChange={presetIds => update({ presetIds }, 'preset', '更新预制绑定')} onVariants={presetVariants => update({ presetVariants }, 'preset', '切换预制变体')} onDetach={detach} readOnly={readOnly}/>}
      {tab === 'prompts' && <PromptEditor section={section} update={update} readOnly={readOnly} store={store} onDetach={detach}/>}
      {tab === 'lora' && <LoraEditor section={section} update={update} readOnly={readOnly} store={store}/>}
      {tab === 'history' && <Group title="变更记录" actions={<Dropdown aria-label="历史类型" value={historyFilter} options={[{ label: '全部', value: 'all' }, ...tabs.filter(item => ['params', 'presets', 'prompts', 'lora'].includes(item.id)).map(item => ({ label: item.label, value: { presets: 'preset', prompts: 'prompt' }[item.id] || item.id }))]} onChange={event => { setHistoryFilter(event.value); setHistoryPage(0); }}/>}>{history.slice(historyPage, historyPage + 10).map(item => <details className="pp-history" key={item.id}><summary><strong>{item.title || '更新配置'}</strong><span>{new Date(item.timestamp || item.createdAt).toLocaleString('zh-CN')} · 当前用户</span></summary><div className="pp-history-diff"><div><h3>修改前</h3><pre>{JSON.stringify(item.before, null, 2)}</pre></div><div><h3>修改后</h3><pre>{JSON.stringify(item.after, null, 2)}</pre></div></div><Button outlined label="恢复此范围到修改前" disabled={readOnly} onClick={() => setRestore(item)}/></details>)}{!history.length && <Empty title="暂无变更记录">调整参数、预制、提示词或 LoRA 后，变更会记录在这里。</Empty>}{history.length > 10 && <Paginator first={historyPage} rows={10} totalRecords={history.length} onPageChange={event => setHistoryPage(event.first)}/>}</Group>}
      {tab === 'results' && <div className="pp-result-groups">{runs.map((run, runIndex) => <section className="pp-result-group" key={run.id}><header className="pp-result-heading"><h2>Run #{runs.length - runIndex}</h2><span>{new Date(run.createdAt).toLocaleString('zh-CN')}</span><Button text plain label="查看任务" onClick={() => navigate('production/tasks/' + run.id)}/></header><ProductionImageBoard images={store.images.filter(image => image.runId === run.id)} store={store} updateStore={updateStore} notify={notify} readOnly={readOnly}/></section>)}{!runs.length && <Empty title="尚未运行">点击右上角运行，生成任务将出现在任务工作台。</Empty>}</div>}
    </div><SectionRail sections={sections} project={project} navigate={navigate} active={section.id} editor/></div>
    <Dialog visible={Boolean(restore)} header="恢复小节配置" onHide={() => setRestore(null)} style={{ width: '460px', maxWidth: 'calc(100vw - 24px)' }} footer={<><Button text plain label="取消" onClick={() => setRestore(null)}/><Button label="确认恢复" onClick={() => { const allowed = { params: ['params', 'checkpoint'], preset: ['presetIds', 'presetVariants', 'promptBlocks', 'loras'], prompt: ['promptBlocks', 'prompt', 'negative'], lora: ['loras', 'disabledPresetLoras'] }[restore.dimension] || []; const patch = Object.fromEntries(Object.entries(restore.before || {}).filter(([key]) => allowed.includes(key))); update(patch, restore.dimension, '恢复：' + restore.title); setRestore(null); notify('已恢复所选配置范围，并保留恢复前状态'); }}/></>}><p>恢复“{section.name}”的{({ params: '参数', preset: '预制', prompt: '提示词', lora: 'LoRA' })[restore?.dimension]}范围。其余配置与历史任务保持不变，本次恢复也会记录到历史中。</p></Dialog>
  </div>;
}

export function ProductionProjects(props) {
  const { route, store, navigate } = props;
  const id = route.segments[1], project = store.projects.find(item => item.id === id);
  if (!id) return <ProjectsList {...props}/>;
  if (id === 'new') return <ProjectForm key={'new-' + (route.query.source || '')} {...props}/>;
  if (!project) return <div className="pp-page"><Empty title="项目不存在">它可能已被删除。</Empty><Button label="返回项目" onClick={() => navigate(path())}/></div>;
  if (route.segments[2] === 'edit') return <ProjectForm key={project.id} {...props} project={project}/>;
  if (route.segments[2] === 'sections' && route.segments[3]) { const section = store.sections.find(item => item.id === route.segments[3] && item.projectId === project.id); return section ? <SectionEditor key={section.id} {...props} project={project} section={section}/> : <Empty title="小节不存在"/>; }
  return <ProjectDetail key={project.id} {...props} project={project}/>;
}
