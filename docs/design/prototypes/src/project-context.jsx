import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from 'primereact/button';
import { BreadCrumb } from 'primereact/breadcrumb';
import { Card } from 'primereact/card';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Menu } from 'primereact/menu';
import { Message } from 'primereact/message';
import { TabMenu } from 'primereact/tabmenu';
import { PrototypeProvider } from './prototype-provider.jsx';
import { NavigationShell } from './navigation-shell.jsx';
import { initialDataset, childrenFor, filterChildren, filterProjects, filterTasks, foldersFor, folderTrail, projectFolderScope, sectionFolderScope, createFolder, renameFolder, moveFolder, moveResource, listKey, projectKey, taskKey, projectTabs, resolveContextRoute } from './project-context-model.mjs';
import './project-context.css';

const memoryKey = 'cm-project-context-preview-v2';
const moduleLabels = { production: '生产', training: '训练' };
const states = { active: '进行中', archived: '已归档', done: '已完成', running: '运行中', queued: '排队中', failed: '失败' };
const taskTypes = { 'image-generation': '图片生成', 'material-generation': '素材生成', 'lora-training': 'LoRA 训练' };
const childTabFor = project => project.module === 'production' ? 'sections' : 'compositions';
const childLabelFor = project => project.module === 'production' ? '小节' : '构图';
const breadcrumbSlots = { root: { style: { padding: 0, border: 0, background: 'transparent' } }, menu: { style: { flexWrap: 'wrap', gap: '8px' } } };
function plainActivation(event) { return !event.defaultPrevented && (event.button == null || event.button === 0) && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey; }
function readMemory() {
  const empty = { current: '', activeModule: 'production', scroll: {}, lastLists: {}, focus: {}, viewFilters: {}, dataset: initialDataset };
  try { const saved = JSON.parse(sessionStorage.getItem(memoryKey) || '{}'); return { ...empty, ...saved, dataset: saved.dataset?.folders && saved.dataset?.tasks ? saved.dataset : initialDataset }; } catch { return empty; }
}
function persist(memory) { try { sessionStorage.setItem(memoryKey, JSON.stringify(memory)); } catch { /* Navigation remains usable when storage is unavailable. */ } }
function useContextNavigation() {
  const [memory] = useState(readMemory);
  const [dataset, setDataset] = useState(memory.dataset);
  const dataRef = useRef(dataset);
  const [route, setRoute] = useState(() => resolveContextRoute(location.hash || memory.current || 'production/tasks', dataset));
  const current = useRef(route);
  const restoring = useRef(false);
  function capture() { if (!restoring.current) memory.scroll[current.current.key] = window.scrollY; }
  function apply(next) {
    restoring.current = true; current.current = next; memory.current = next.key;
    if (next.module) memory.activeModule = next.module;
    if (next.kind === 'list') memory.lastLists[next.rootKey] = next.key;
    persist(memory); setRoute(next);
  }
  function go(key, { replace = false, focusId } = {}) {
    if (focusId) memory.focus[current.current.key] = focusId;
    capture(); const next = resolveContextRoute(key, dataRef.current);
    if (location.hash !== `#${next.key}`) history[replace ? 'replaceState' : 'pushState'](null, '', `#${next.key}`);
    apply(next);
  }
  function follow(event, key, focusId) { if (plainActivation(event)) { event.preventDefault(); go(key, { focusId }); } }
  function updateDataset(next) { dataRef.current = next; memory.dataset = next; setDataset(next); capture(); apply(resolveContextRoute(current.current.key, next)); }
  function reset() {
    Object.assign(memory, { scroll: {}, focus: {}, lastLists: {}, viewFilters: {}, dataset: initialDataset });
    dataRef.current = initialDataset; setDataset(initialDataset);
    const next = resolveContextRoute('production/projects', initialDataset);
    history.replaceState(null, '', `#${next.key}`); apply(next);
  }
  useLayoutEffect(() => {
    if (route.project && route.tab) memory.viewFilters[`${route.module}/${route.project.id}/${route.tab}`] = route.filters;
    if (location.hash !== `#${route.key}`) history.replaceState(null, '', `#${route.key}`);
    window.scrollTo({ top: Number(memory.scroll[route.key]) || 0, behavior: 'instant' });
    const target = memory.focus[route.key];
    if (target) document.querySelector(`[data-context-link="${CSS.escape(target)}"]`)?.focus({ preventScroll: true });
    restoring.current = false; persist(memory);
  }, [route]);
  useEffect(() => {
    const previous = history.scrollRestoration; history.scrollRestoration = 'manual';
    const onHistory = () => { const next = resolveContextRoute(location.hash, dataRef.current); if (next.key !== current.current.key || next.notice) { capture(); apply(next); } };
    const onHide = () => { capture(); persist(memory); };
    window.addEventListener('popstate', onHistory); window.addEventListener('hashchange', onHistory);
    window.addEventListener('scroll', capture, { passive: true }); window.addEventListener('pagehide', onHide);
    return () => { window.removeEventListener('popstate', onHistory); window.removeEventListener('hashchange', onHistory); window.removeEventListener('scroll', capture); window.removeEventListener('pagehide', onHide); history.scrollRestoration = previous; };
  }, []);
  return { route, memory, dataset, go, follow, updateDataset, reset };
}
function ContextLink({ navigation, to, identity, className, children, ...props }) { return <a {...props} className={className} href={`#${to}`} data-context-link={identity} onClick={event => navigation.follow(event, to, identity)}>{children}</a>; }
function Photo({ src, name, label, empty = '暂无图片' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <figure className="ctx-photo">{src && !failed ? <><img src={src} alt={name} loading="lazy" width="600" height="400" onError={() => setFailed(true)} /><figcaption>{label}</figcaption></> : <div className="ctx-no-photo"><i className="pi pi-image" aria-hidden="true" /><span>{failed ? '图片暂不可用' : empty}</span></div>}</figure>;
}
function MoreActions({ label, items }) {
  const menu = useRef(null);
  return <><Button text plain icon="pi pi-ellipsis-h" aria-label={`${label}的操作`} onClick={event => menu.current.toggle(event)} aria-haspopup="menu" /><Menu popup ref={menu} model={items} /></>;
}
function ResourceCard({ navigation, record, href, identity, photoLabel, detail, footer, actions, photo = record.photo, empty }) {
  return <li><Card className="ctx-card" pt={{ body: { style: { padding: 0 } }, content: { style: { padding: 0 } } }}>
    <ContextLink navigation={navigation} to={href} identity={identity} className="ctx-card-link" aria-label={`打开${record.name}`}>
      <Photo src={photo} name={`${record.name} · ${photoLabel}`} label={photoLabel} empty={empty} />
      <div className="ctx-card-copy"><h3 title={record.name}>{record.name}</h3><p>{detail}</p></div>
    </ContextLink>
    <div className="ctx-card-footer"><span>{footer}</span>{actions?.length ? <MoreActions label={record.name} items={actions} /> : <i className="pi pi-arrow-up-right" aria-hidden="true" />}</div>
  </Card></li>;
}
function SectionTitle({ title, count, children }) { return <div className="ctx-section-title"><h2>{title}{count != null && <span> · {count}</span>}</h2>{children}</div>; }
function Empty({ children }) { return <div className="ctx-empty"><i className="pi pi-images" aria-hidden="true" /><p>{children}</p></div>; }
function Filters({ navigation, tasks = false }) {
  const { route, dataset } = navigation;
  const [query, setQuery] = useState(route.filters.q || '');
  useEffect(() => setQuery(route.filters.q || ''), [route.key]);
  const options = [{ label: tasks ? '全部状态' : '全部项目', value: 'all' }, ...(tasks ? ['done','running','queued','failed'] : ['active','archived']).map(value => ({ value, label: states[value] }))];
  function apply(filters) {
    navigation.go(route.project ? projectKey(route.project, route.tab, route.from, '', filters, dataset) : listKey(route.module, route.section, filters), { replace: true });
  }
  return <form className="ctx-toolbar" onSubmit={event => { event.preventDefault(); apply({ ...route.filters, q: query }); }}>
    <div className="ctx-search"><InputText aria-label={tasks ? '搜索任务' : route.module === 'production' ? '搜索当前文件夹项目' : '搜索项目'} placeholder={tasks ? '搜索任务或项目' : route.module === 'production' ? '搜索当前文件夹' : '搜索项目'} value={query} onChange={event => setQuery(event.target.value)} /><Button type="submit" icon="pi pi-search" aria-label="搜索" /></div>
    <Dropdown className="ctx-status-filter" value={route.filters.status || 'all'} options={options} onChange={event => apply({ ...route.filters, q: query, status: event.value })} aria-label={tasks ? '任务状态' : '项目状态'} />
    {(query || route.filters.status !== 'all') && <Button type="button" text label="清除筛选" onClick={() => { setQuery(''); apply({ folder: route.filters.folder }); }} />}
  </form>;
}
function useFolderActions(navigation) {
  const [dialog, setDialog] = useState(null);
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  useEffect(() => setFeedback(null), [navigation.route.key]);
  function open(action) { setDialog(action); setName(action.kind === 'rename' ? action.record.name : ''); setDestination(action.parentId || ''); setError(''); }
  function submit(event) {
    event?.preventDefault();
    try {
      const { dataset } = navigation;
      let next;
      if (dialog.kind === 'create') next = createFolder(dataset, { scope: dialog.scope, parentId: dialog.parentId, name });
      if (dialog.kind === 'rename') next = renameFolder(dataset, { id: dialog.record.id, name });
      if (dialog.kind === 'move') next = dialog.resourceKind === 'folder' ? moveFolder(dataset, { id: dialog.record.id, parentId: destination }) : moveResource(dataset, { kind: dialog.resourceKind, id: dialog.record.id, module: dialog.record.module, projectId: dialog.record.projectId, folderId: destination });
      navigation.updateDataset(next); setDialog(null);
      setFeedback({ text: dialog.kind === 'move' ? `已将“${dialog.record.name}”移至${next.folders.find(folder => folder.id === destination)?.name || '根目录'}` : dialog.kind === 'create' ? `已创建文件夹“${name.trim()}”` : `已重命名为“${name.trim()}”`, href: dialog.kind === 'move' ? dialog.hrefFor(destination) : null });
    } catch (err) { setError(err.message); }
  }
  function actions(record, resourceKind, scope, hrefFor) {
    return [
      ...(resourceKind === 'folder' ? [{ label: '重命名', icon: 'pi pi-pencil', command: () => open({ kind: 'rename', record, scope }) }] : []),
      { label: '移动到文件夹', icon: 'pi pi-folder-open', command: () => open({ kind: 'move', record, resourceKind, scope, parentId: resourceKind === 'folder' ? record.parentId : record.folderId, hrefFor }) },
    ];
  }
  const currentFolder = navigation.dataset.folders.find(folder => folder.id === destination);
  const choices = dialog ? foldersFor(dialog.scope, destination, navigation.dataset).filter(folder => dialog.resourceKind !== 'folder' || !folderTrail(dialog.scope, folder.id, navigation.dataset).some(parent => parent.id === dialog.record.id)) : [];
  const sameTarget = dialog?.kind === 'move' && (dialog.resourceKind === 'folder' ? dialog.record.parentId : dialog.record.folderId) === destination;
  const ui = <>
    {feedback && <div className="ctx-feedback" role="status"><Message severity="success" text={feedback.text} />{feedback.href && <ContextLink navigation={navigation} to={feedback.href} className="ctx-inline-link">查看目标文件夹<i className="pi pi-arrow-right" aria-hidden="true" /></ContextLink>}</div>}
    <Dialog className="ctx-dialog" header={dialog?.kind === 'move' ? '移动到文件夹' : dialog?.kind === 'rename' ? '重命名文件夹' : '新建文件夹'} visible={!!dialog} onHide={() => setDialog(null)} draggable={false} blockScroll footer={<div className="ctx-dialog-actions"><Button text label="取消" onClick={() => setDialog(null)} /><Button label={dialog?.kind === 'move' ? '移动到此处' : '保存'} disabled={dialog?.kind === 'move' ? sameTarget : !name.trim()} onClick={submit} /></div>}>
      {dialog?.kind === 'move' ? <>
        <p className="ctx-muted">{dialog.record.name}</p>
        <div className="ctx-dialog-location">根目录{folderTrail(dialog.scope, destination, navigation.dataset).map(folder => ` / ${folder.name}`).join('')}</div>
        <div className="ctx-destination-list">
          {destination && <Button text plain icon="pi pi-arrow-left" label="上一级" onClick={() => setDestination(currentFolder?.parentId || '')} />}
          {choices.map(folder => <Button key={folder.id} text plain icon="pi pi-folder" label={folder.name} onClick={() => setDestination(folder.id)} />)}
          {!choices.length && <p className="ctx-muted">此处没有可进入的子文件夹，可直接移入当前位置。</p>}
        </div>
      </> : <form className="ctx-dialog-form" onSubmit={submit}><label htmlFor="context-folder-name">文件夹名称</label><InputText id="context-folder-name" autoFocus value={name} onChange={event => setName(event.target.value)} maxLength={80} /></form>}
      {error && <Message severity="error" text={error} />}
    </Dialog>
  </>;
  return { open, actions, ui };
}
function FolderBrowser({ navigation, project, folderActions }) {
  const { route, dataset } = navigation;
  const scope = project ? sectionFolderScope(project) : projectFolderScope(route.module);
  if (!scope) return null;
  const currentId = route.filters.folder || '';
  const hrefFor = folder => project ? projectKey(project, childTabFor(project), route.from, '', { folder }, dataset) : listKey(route.module, 'projects', { folder });
  const trail = [{ name: project ? '全部小节' : '全部项目', id: '' }, ...folderTrail(scope, currentId, dataset)];
  const folders = foldersFor(scope, currentId, dataset);
  function folderItems(folder) { const all = project ? childrenFor(project, dataset) : dataset.projects.filter(item => item.module === route.module); return all.filter(item => folderTrail(scope, item.folderId, dataset).some(parent => parent.id === folder.id)); }
  return <>
    <div className="ctx-folder-bar"><BreadCrumb className="ctx-folder-path" aria-label="文件夹路径" pt={breadcrumbSlots} model={trail.map(folder => ({ label: folder.name, url: `#${hrefFor(folder.id)}`, command: ({ originalEvent }) => navigation.follow(originalEvent, hrefFor(folder.id)) }))} /><Button outlined icon="pi pi-folder-plus" label="新建文件夹" onClick={() => folderActions.open({ kind: 'create', scope, parentId: currentId })} /></div>
    {folders.length > 0 && <ul className="ctx-grid ctx-folder-grid" aria-label="文件夹">{folders.map(folder => {
      const contents = folderItems(folder); const photo = contents.find(item => item.photo)?.photo;
      return <li key={folder.id} className="ctx-folder-card"><ContextLink navigation={navigation} to={hrefFor(folder.id)} identity={`folder-${folder.id}`} aria-label={`进入文件夹 ${folder.name}`}><span className="ctx-folder-cover">{photo ? <img src={photo} alt="" width="48" height="48" /> : <i className="pi pi-folder" aria-hidden="true" />}</span><span className="ctx-folder-copy"><strong>{folder.name}</strong><small>{contents.length} 个{project ? '小节' : '项目'}</small></span></ContextLink><MoreActions label={folder.name} items={folderActions.actions(folder, 'folder', scope, hrefFor)} /></li>;
    })}</ul>}
  </>;
}
function TaskCards({ navigation, project, child }) {
  const { dataset, route } = navigation;
  const tasks = filterTasks(route.module, route.filters, dataset).filter(task => (!project || task.projectId === project.id) && (!child || task.childId === child.id));
  return <><SectionTitle title={child ? `${childLabelFor(project)}运行记录` : '任务'} count={tasks.length} />{tasks.length ? <ul className="ctx-grid" aria-label="任务卡片">{tasks.map(task => {
    const owner = dataset.projects.find(item => item.id === task.projectId && item.module === task.module);
    const source = childrenFor(owner, dataset).find(item => item.id === task.childId);
    const label = task.photo ? (task.type === 'lora-training' ? '本次训练样本' : '本次输出') : '来源参考 · 尚无输出';
    return <ResourceCard key={task.id} navigation={navigation} record={task} identity={`task-${task.id}`} href={taskKey(task, route.key, dataset)} photo={task.photo || task.sourcePhoto} photoLabel={label} empty={task.state === 'failed' ? '本次未生成图片' : '尚无输出图片'} detail={`${owner?.name || ''}${source ? ` · ${source.name}` : ''}`} footer={`${taskTypes[task.type] || '生成任务'} · ${states[task.state]}`} />;
  })}</ul> : <Empty>当前范围没有任务。</Empty>}</>;
}
function Projects({ navigation, folderActions }) {
  const { dataset, route } = navigation;
  const records = filterProjects(route.module, { ...route.filters, folder: route.filters.folder || '' }, dataset);
  const scope = projectFolderScope(route.module);
  return <><Filters navigation={navigation} /><FolderBrowser navigation={navigation} folderActions={folderActions} />
    <SectionTitle title="项目" count={records.length} />{records.length ? <ul className="ctx-grid" aria-label="项目卡片">{records.map(project => <ResourceCard key={project.id} navigation={navigation} record={project} identity={`project-${project.id}`} href={projectKey(project, 'overview', route.key, '', {}, dataset)} photoLabel="最近结果" detail={`${childrenFor(project, dataset).length} 个${childLabelFor(project)}`} footer={states[project.state]} actions={scope ? folderActions.actions(project, 'project', scope, folder => listKey(route.module, 'projects', { folder })) : null} />)}</ul> : <Empty>当前文件夹没有匹配的项目。</Empty>}
  </>;
}
function ChildCards({ navigation, folderActions, all = false }) {
  const { route, dataset } = navigation; const project = route.project;
  const records = all ? childrenFor(project, dataset) : filterChildren(project, { ...route.filters, folder: route.filters.folder || '' }, dataset);
  const tab = childTabFor(project); const label = childLabelFor(project); const scope = sectionFolderScope(project);
  const hrefFor = folder => projectKey(project, tab, route.from, '', { folder }, dataset);
  return <><SectionTitle title={label} count={records.length}>{all && <ContextLink navigation={navigation} to={hrefFor('')} className="ctx-inline-link">查看全部<i className="pi pi-arrow-right" aria-hidden="true" /></ContextLink>}</SectionTitle>
    {records.length ? <ul className="ctx-grid" aria-label={`${label}卡片`}>{records.map(child => <ResourceCard key={child.id} navigation={navigation} record={child} identity={`child-${project.id}-${child.id}`} href={projectKey(project, tab, route.from, child.id, { folder: child.folderId }, dataset)} photoLabel={project.module === 'production' ? '最近结果' : '代表图'} detail={`${dataset.tasks.filter(task => task.projectId === project.id && task.childId === child.id).length} 次任务`} footer={project.module === 'production' ? '图片小节' : '构图工作区'} actions={scope ? folderActions.actions(child, 'child', scope, hrefFor) : null} />)}</ul> : <Empty>当前文件夹没有小节。可通过移动操作整理已有小节。</Empty>}
  </>;
}
function ProjectTabs({ navigation }) {
  const { route, dataset, memory } = navigation;
  const tabs = projectTabs[route.module]; const activeIndex = tabs.findIndex(tab => tab.id === route.tab);
  const tabKey = tab => projectKey(route.project, tab, route.from, '', memory.viewFilters[`${route.module}/${route.project.id}/${tab}`] || {}, dataset);
  return <TabMenu className={`ctx-${route.module}`} model={tabs.map(tab => ({ id: tab.id, label: tab.label, url: `#${tabKey(tab.id)}` }))} activeIndex={activeIndex} onTabChange={({ originalEvent, index }) => { if (plainActivation(originalEvent)) { originalEvent.preventDefault(); navigation.go(tabKey(tabs[index].id)); } }} pt={{ menu: { className: 'ctx-tab-list', 'aria-label': '项目页签', style: { background: 'transparent', padding: 0 } }, action: ({ context }) => ({ 'aria-current': context.index === activeIndex ? 'page' : undefined, style: { padding: '10px 8px', minHeight: '40px', fontWeight: 500, justifyContent: 'center', background: 'transparent', color: context.index === activeIndex ? 'var(--accent)' : 'var(--nav-secondary)', borderColor: context.index === activeIndex ? 'var(--accent)' : 'var(--nav-border)', transition: 'color var(--duration-quick) var(--ease-out), border-color var(--duration-quick) var(--ease-out)' } }), label: { style: { whiteSpace: 'nowrap' } } }} />;
}
function ChildWorkspace({ navigation }) {
  const { route, dataset } = navigation; const { project, child } = route;
  const siblings = childrenFor(project, dataset); const index = siblings.findIndex(item => item.id === child.id);
  return <div className="ctx-workspace"><div className="ctx-workspace-heading"><h2>{childLabelFor(project)}工作区</h2><div className="ctx-neighbors">{[-1,1].map(step => { const sibling = siblings[index + step]; return <Button key={step} text plain icon={step < 0 ? 'pi pi-angle-left' : 'pi pi-angle-right'} aria-label={step < 0 ? '上一个小节' : '下一个小节'} title={sibling?.name} disabled={!sibling} onClick={() => navigation.go(projectKey(project, childTabFor(project), route.from, sibling.id, { folder: sibling.folderId }, dataset))} />; })}</div></div>
    <figure className="ctx-detail-photo"><img src={child.photo} alt={`${child.name}的图片样本`} width="600" height="400" /><figcaption>{project.module === 'training' ? '当前构图代表图' : '当前小节最近结果'} · {child.name}</figcaption></figure>
    <div className="ctx-scope-note">{project.module === 'training' ? '构图持续保存提示词、输入图与生成参数；生成任务保留每次执行快照。代表图与 Caption 在训练素材中集中整理。' : '小节保存生成配置；每次执行产生独立任务与结果。此处保留编辑工作区的位置，参数编辑在对应页面任务中设计。'}</div>
    <TaskCards navigation={navigation} project={project} child={child} />
  </div>;
}
function TaskDetail({ navigation }) {
  const { route, dataset } = navigation; const { task, project } = route;
  const child = childrenFor(project, dataset).find(item => item.id === task.childId);
  const origin = route.from ? resolveContextRoute(route.from, dataset) : null;
  const listSource = origin?.kind === 'list' ? origin.key : origin?.from || listKey(task.module, 'tasks');
  return <div className="ctx-workspace"><div className="ctx-related"><ContextLink navigation={navigation} to={projectKey(project, 'tasks', listSource, '', {}, dataset)} className="ctx-inline-link">所属项目：{project.name}</ContextLink>{child && <ContextLink navigation={navigation} to={projectKey(project, childTabFor(project), listSource, child.id, { folder: child.folderId }, dataset)} className="ctx-inline-link">来源{childLabelFor(project)}：{child.name}</ContextLink>}</div>
    <SectionTitle title={taskTypes[task.type] || '任务详情'}><span>{states[task.state]} · {task.id}</span></SectionTitle>
    {task.photo ? <figure className="ctx-detail-photo"><img src={task.photo} alt={`${task.name}的图片`} width="600" height="400" /><figcaption>{task.type === 'lora-training' ? '本次训练使用的样本图' : '本次任务输出'} · {task.name}</figcaption></figure> : <Empty>{task.state === 'failed' ? '本次任务失败，没有输出图片。' : '本次任务尚无输出图片。'}</Empty>}
    <p className="ctx-scope-note">此处验证独立任务、来源与返回关系。执行控制及审核操作在对应任务中设计。</p>
  </div>;
}
function ProjectView({ navigation, folderActions }) {
  const { route, dataset } = navigation; const { project } = route;
  if (route.kind === 'child') return <ChildWorkspace navigation={navigation} />;
  return <><ProjectTabs navigation={navigation} /><div className="ctx-view-body">
    {route.tab === childTabFor(project) ? <><FolderBrowser navigation={navigation} project={project} folderActions={folderActions} /><ChildCards navigation={navigation} folderActions={folderActions} /></> : route.tab === 'tasks' ? <><Filters navigation={navigation} tasks /><TaskCards navigation={navigation} project={project} /></> : route.tab === 'overview' ? <><ChildCards navigation={navigation} folderActions={folderActions} all /><TaskCards navigation={navigation} project={project} /></> : ['images','materials','references'].includes(route.tab) ? <><SectionTitle title={projectTabs[project.module].find(tab => tab.id === route.tab).label} /><ul className="ctx-grid" aria-label="图片卡片">{childrenFor(project, dataset).map(child => <ResourceCard key={child.id} navigation={navigation} record={child} identity={`image-${child.id}`} href={projectKey(project, childTabFor(project), route.from, child.id, { folder: child.folderId }, dataset)} photoLabel={route.tab === 'references' ? '参考图片样本' : route.tab === 'materials' ? '构图代表图' : '小节结果'} detail={route.tab === 'materials' ? '代表图与 Caption 属于此构图' : `查看来源${childLabelFor(project)}`} footer={project.name} />)}</ul></> : <><SectionTitle title="角色档案" /><figure className="ctx-detail-photo"><img src={project.photo} alt={`${project.name}的参考图片样本`} width="600" height="400" /><figcaption>{project.name} · 参考图片样本</figcaption></figure><p className="ctx-footnote">角色档案编辑在对应业务页面中设计。</p></>}
  </div></>;
}
function App() {
  const navigation = useContextNavigation(); const folders = useFolderActions(navigation);
  const { route, dataset, memory } = navigation; const project = route.project;
  const activeModule = route.module || memory.activeModule;
  const sourceList = route.from || listKey(activeModule, route.kind === 'task' ? 'tasks' : 'projects', project ? { folder: project.folderId } : {});
  const backKey = route.kind === 'child' ? projectKey(project, childTabFor(project), route.from, '', { folder: route.child.folderId }, dataset) : sourceList;
  const origin = resolveContextRoute(sourceList, dataset);
  const originLabel = origin.kind === 'child' ? `返回${childLabelFor(origin.project)}工作区` : origin.kind === 'project' && origin.tab !== 'tasks' ? `返回${projectTabs[origin.module].find(tab => tab.id === origin.tab).label}` : origin.section === 'tasks' || origin.tab === 'tasks' ? '返回任务列表' : '返回项目列表';
  const backLabel = route.kind === 'child' ? `返回${childLabelFor(project)}列表` : originLabel;
  const crumbs = project ? [
    { label: moduleLabels[activeModule], url: `#${activeModule}/tasks` },
    { label: '项目', url: `#${listKey(activeModule, 'projects', { folder: project.folderId })}` },
    { label: project.name, url: `#${projectKey(project, 'overview', route.from, '', {}, dataset)}` },
    ...(route.kind === 'child' ? [{ label: route.child.name }] : []),
  ].map(item => item.url ? { ...item, command: ({ originalEvent }) => navigation.follow(originalEvent, item.url) } : { ...item, template: () => <span aria-current="page">{item.label}</span> }) : [];
  const header = <header className="ctx-page-header">{project && route.kind !== 'task' && <BreadCrumb aria-label="项目层级" className="ctx-breadcrumb" pt={breadcrumbSlots} model={crumbs} />}<div className="ctx-title-row"><div><h1>{route.kind === 'task' ? route.task.name : route.title}</h1><p>交互原型 · 图片与记录均为演示样本</p></div>{project && <ContextLink navigation={navigation} to={backKey} className="ctx-return"><i className="pi pi-arrow-left" aria-hidden="true" />{backLabel}</ContextLink>}</div></header>;
  const previewControls = <div className="ctx-preview-cases"><p>文件夹操作保存在当前浏览器会话中，刷新保留。重置可还原样本。</p><ContextLink navigation={navigation} to="production/projects/missing/overview">检查失效项目回退</ContextLink><ContextLink navigation={navigation} to="production/projects?folder=missing">检查失效文件夹回退</ContextLink></div>;
  return <NavigationShell route={route} activeModule={activeModule} onNavigate={(key, { originalEvent, source }) => { originalEvent?.preventDefault(); navigation.go(source === 'module' ? key : memory.lastLists[key] || key); }} header={header} contentClassName="ctx-main" className="project-context-preview" reviewLabel="R02-02 · 项目上下文" reviewHref="../../reviews/R02-02.md" previewTitle="项目导航预览设置" previewControls={previewControls} onReset={navigation.reset} resetLabel="重置导航与文件夹样本">
    <div className="ctx-content">{route.notice && <div className="ctx-route-notice"><Message severity="warn" text={route.notice} /></div>}{folders.ui}
      {route.kind === 'list' ? route.section === 'projects' ? <Projects navigation={navigation} folderActions={folders} /> : <><Filters navigation={navigation} tasks /><TaskCards navigation={navigation} /></> : route.kind === 'task' ? <TaskDetail navigation={navigation} /> : project ? <ProjectView navigation={navigation} folderActions={folders} /> : <Empty>此页面将在对应设计任务中展开。</Empty>}
      <p className="ctx-footnote">R02-02 · 项目、小节与任务的图片导航及文件夹操作演示。</p>
    </div>
  </NavigationShell>;
}
createRoot(document.getElementById('root')).render(<PrototypeProvider><App /></PrototypeProvider>);
