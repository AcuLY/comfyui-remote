import React, { useEffect, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { Checkbox } from 'primereact/checkbox';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { Message } from 'primereact/message';
import { Paginator } from 'primereact/paginator';
import { ProgressBar } from 'primereact/progressbar';
import { TabMenu } from 'primereact/tabmenu';
import { Tag } from 'primereact/tag';
import './production-tasks.css';

const states = { unsubmitted:'待提交', submitted:'排队中', running:'运行中', paused:'已暂停', completed:'已完成', failed:'失败', cancelled:'已取消' };
const activeStates = ['unsubmitted','submitted','running','paused'];
const tabs = [{value:'pending',label:'待审核'},{value:'queue',label:'队列'},{value:'failed',label:'失败'},{value:'records',label:'全部记录'},{value:'censor',label:'打码'},{value:'trash',label:'回收站'}];
const filters = [{value:'all',label:'全部'},{value:'pending',label:'待审'},{value:'kept',label:'已保留'},{value:'featured',label:'P站'},{value:'preview',label:'预览'},{value:'cover',label:'封面'}];
const countPending = images => images.filter(image => !image.trashed && image.review === 'pending').length;
const canEdit = (store,image) => !store.projects.find(project => project.id === image.projectId)?.archived;
const imageName = image => image.name || image.label || `图片 ${image.id}`;
const clone = value => JSON.parse(JSON.stringify(value));
// TabMenu v10 already owns horizontal scrolling; public slots keep its ink bar on one row.
const tabPT = {
  root:{style:{overflowX:'auto',maxWidth:'100%',minWidth:0}},
  menu:{style:{flexWrap:'nowrap',width:'max-content',minWidth:'100%'}},
  menuitem:{style:{flexShrink:0}},
  action:{style:{padding:'10px 12px',minHeight:'var(--control-height)'}},
  label:{style:{whiteSpace:'nowrap'}},
};
function shortDate(value) {
  if(!value)return '未记录时间';
  const date=new Date(value);if(Number.isNaN(date.getTime()))return value;
  return `${date.getMonth()+1}月${date.getDate()}日 ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}
const terminalStates=['completed','failed','cancelled'];
const runEditable=(store,run)=>!store.projects.find(project=>project.id===run.projectId)?.archived;
function attemptsFor(run) {
  if(run.attempts?.length)return run.attempts;
  if(run.status==='unsubmitted'&&!run.startedAt)return [];
  return [{id:`${run.id}-attempt-1`,index:1,status:run.status,startedAt:run.startedAt||run.createdAt,finishedAt:run.finishedAt||null,error:run.error||'',elapsedMs:run.elapsedMs??(run.elapsed!=null?run.elapsed*1000:null),stages:run.stages||[]}];
}
function duration(milliseconds) { if(milliseconds==null)return '未记录';const seconds=Math.round(milliseconds/1000);return seconds>=60?`${Math.floor(seconds/60)}分${seconds%60}秒`:`${seconds}秒`; }
function runDuration(run) { const values=attemptsFor(run).map(attempt=>attempt.elapsedMs).filter(value=>value!=null);return values.length?duration(values.reduce((sum,value)=>sum+value,0)):duration(run.elapsedMs??(run.elapsed!=null?run.elapsed*1000:null)); }
function timingSummary(run) { return run.status==='unsubmitted'&&!attemptsFor(run).length?'尚未执行':`${activeStates.includes(run.status)?'已用':'总耗时'} ${runDuration(run)}`; }
function waitingReason(run,store) {
  if(run.controlError)return run.controlError;
  if(run.status==='unsubmitted')return run.waitReason||(store.trainingBusy?'训练正在占用执行资源，等待训练释放':'尚未提交，等待调度');
  if(run.status==='submitted')return '已提交至 ComfyUI 队列，等待执行';
  if(run.status==='paused')return '已停止执行，恢复后从头生成';
  return '';
}
function useRunOperations({store,updateStore,notify,onDeleted}) {
  const [pending,setPending]=useState([]),[confirm,setConfirm]=useState(null),[error,setError]=useState('');
  function act(ids,action){
    const allowed=store.runs.filter(run=>ids.includes(run.id)&&runEditable(store,run)&&!pending.includes(run.id)&&(
      action==='pause'?['unsubmitted','submitted','running'].includes(run.status):action==='cancel'?activeStates.includes(run.status):action==='resume'?run.status==='paused':run.status==='failed'));
    if(!allowed.length)return;
    setPending(values=>[...new Set([...values,...allowed.map(run=>run.id)])]);
    const snapshots=new Map(allowed.map(run=>[run.id,run.status]));
    setTimeout(()=>{
      const failures=allowed.filter(run=>['pause','cancel'].includes(action)&&['submitted','running'].includes(run.status)&&(run.stopError||store.simulateStopFailure));
      updateStore(draft=>{for(const run of draft.runs){if(!snapshots.has(run.id)||snapshots.get(run.id)!==run.status||!runEditable(draft,run))continue;
        if(failures.some(item=>item.id===run.id)){run.controlError=run.stopError||'尚未确认 ComfyUI 停止执行。任务状态保持不变，请重试停止。';continue;}
        run.attempts=clone(attemptsFor(run));delete run.controlError;
        if(['pause','cancel'].includes(action)){
          const attempt=run.attempts.at(-1);if(attempt&&['running','submitted'].includes(run.status)){attempt.status=action==='pause'?'interrupted':'cancelled';attempt.finishedAt=new Date().toISOString();attempt.stopReason=action==='pause'?'用户暂停':'用户取消';}
          run.status=action==='pause'?'paused':'cancelled';
        }else{run.status='unsubmitted';run.progress=0;run.error='';run.elapsed=0;delete run.startedAt;delete run.finishedAt;}
      }});
      setPending(values=>values.filter(id=>!snapshots.has(id)));setConfirm(null);
      notify(failures.length?`${failures.length} 条任务未确认停止，原状态已保留，请查看具体错误。`:action==='pause'?'任务已确认暂停':action==='cancel'?'任务已确认取消':action==='resume'?'任务已重新排队，将从头执行':'同一任务已重新排队，旧执行尝试完整保留',failures.length?'error':'success');
    },350);
  }
  function requestDelete(ids){setError('');setConfirm({kind:'delete',ids});}
  function deleteTasks(){
    const targets=store.runs.filter(run=>confirm.ids.includes(run.id));
    if(targets.some(run=>!terminalStates.includes(run.status)||!runEditable(store,run))){setError('活动任务或归档项目不能删除，请先取消活动任务。');return;}
    const targetIds=targets.map(run=>run.id),imageIds=store.images.filter(image=>targetIds.includes(image.runId)).map(image=>image.id);
    if(store.censorJobs?.some(job=>job.status==='running'&&job.imageIds?.some(id=>imageIds.includes(id)))){setError('相关图片正在打码，请先暂停或取消对应打码任务。');return;}
    updateStore(draft=>{
      draft.runs=draft.runs.filter(run=>!targetIds.includes(run.id));draft.images=draft.images.filter(image=>!imageIds.includes(image.id));
      draft.censorJobs=(draft.censorJobs||[]).map(job=>{if(!job.imageIds?.some(id=>imageIds.includes(id)))return job;const doneIds=job.imageIds.slice(0,job.done||0).filter(id=>!imageIds.includes(id));const remainingIds=job.imageIds.filter(id=>!imageIds.includes(id));return {...job,imageIds:remainingIds,done:doneIds.length,total:remainingIds.length,status:remainingIds.length===doneIds.length?'completed':job.status};}).filter(job=>!job.imageIds||job.imageIds.length);
      for(const project of draft.projects){if(imageIds.includes(project.coverImageId))project.coverImageId=null;}
    });setConfirm(null);notify(`已永久删除 ${targetIds.length} 条任务及 ${imageIds.length} 张图片`);onDeleted?.(targetIds);
  }
  const targets=store.runs.filter(run=>confirm?.ids.includes(run.id)),outputs=store.images.filter(image=>confirm?.ids.includes(image.runId));
  const dialog=<Dialog header={confirm?.kind==='delete'?'永久删除任务及全部输出':'取消任务'} visible={!!confirm} onHide={()=>{if(!pending.length)setConfirm(null);}} className="pt-confirm" footer={<><Button text label="返回" disabled={!!pending.length} onClick={()=>setConfirm(null)}/><Button severity="danger" label={confirm?.kind==='delete'?'永久删除':'确认取消'} loading={!!pending.length} onClick={()=>confirm.kind==='delete'?deleteTasks():act(confirm.ids,'cancel')}/></>}>
    {confirm?.kind==='delete'?<><p>永久删除 {targets.length} 条终态任务及 {targets.reduce((sum,run)=>sum+attemptsFor(run).length,0)} 次执行尝试。</p><ul className="pt-delete-impact"><li>{outputs.filter(image=>!image.trashed).length} 张正常图片及其缩略图</li><li>{outputs.filter(image=>image.trashed).length} 张回收站图片</li><li>{outputs.filter(image=>image.censored).length} 个打码版本、任务工作流与受管文件</li></ul><p>包括项目封面引用。此操作不可撤销，不影响其他任务的图片。</p></>:<p>取消所选 {targets.length} 条任务，等待确认执行器停止后更新状态，已有结果保留。</p>}{error&&<Message severity="error" text={error}/>}</Dialog>;
  return {pending,act,requestDelete,requestCancel:ids=>{setError('');setConfirm({kind:'cancel',ids});},dialog};
}
function RunActionButtons({run,store,operations}) {
  if(!runEditable(store,run))return null;
  const busy=operations.pending.includes(run.id);
  return <div className="pt-toolbar">{['unsubmitted','submitted','running'].includes(run.status)&&<Button text icon="pi pi-pause" label="暂停" loading={busy} onClick={()=>operations.act([run.id],'pause')}/>}{run.status==='paused'&&<Button outlined icon="pi pi-play" label="从头恢复" loading={busy} onClick={()=>operations.act([run.id],'resume')}/>}{activeStates.includes(run.status)&&<Button text severity="danger" icon="pi pi-times" label="取消" disabled={busy} onClick={()=>operations.requestCancel([run.id])}/>} {run.status==='failed'&&<Button outlined icon="pi pi-refresh" label="重试本任务" loading={busy} onClick={()=>operations.act([run.id],'retry')}/>} {terminalStates.includes(run.status)&&<Button text severity="danger" icon="pi pi-trash" label="删除任务" disabled={busy} onClick={()=>operations.requestDelete([run.id])}/>}</div>;
}
function AttemptHistory({run,notify}) {
  const attempts=attemptsFor(run);
  return <details className="pt-execution pt-attempts"><summary>执行尝试 · {attempts.length} 次 · 总耗时 {runDuration(run)}</summary><div className="pt-execution-body">{attempts.length?attempts.map(attempt=><article className="pt-attempt" key={attempt.id}><div className="pt-attempt-heading"><strong>第 {attempt.index} 次</strong><Tag value={attempt.status==='interrupted'?'已中断':states[attempt.status]||attempt.status}/><span>{duration(attempt.elapsedMs)}</span></div><p>{shortDate(attempt.startedAt)}{attempt.finishedAt?` → ${shortDate(attempt.finishedAt)}`:''}{attempt.stopReason?` · ${attempt.stopReason}`:''}</p><dl className="pt-attempt-stages">{attempt.stages?.length?attempt.stages.map((stage,index)=><div key={stage.name||index}><dt>{stage.name}</dt><dd>{duration(stage.durationMs)}</dd></div>):<div><dt>阶段耗时</dt><dd>本次未记录</dd></div>}</dl>{attempt.error&&<div className="pt-attempt-error"><p>{attempt.error}</p><Button text icon="pi pi-copy" label="复制错误" onClick={()=>navigator.clipboard.writeText(attempt.error).then(()=>notify('错误已复制'),()=>notify('复制失败，请手动选择文本','error'))}/></div>}</article>):<p>尚未实际提交，没有执行尝试。</p>}</div></details>;
}

function RunState({status}) { return <Tag value={states[status] || status} severity={status==='failed'?'danger':status==='completed'?'success':status==='running'?'info':status==='paused'?'warning':undefined}/>; }
function Empty({children}) { return <div className="pt-empty"><i className="pi pi-images" aria-hidden="true"/><p>{children}</p></div>; }
function RouteLink({to,navigate,children,...props}) { return <a {...props} href={`#${to}`} onClick={event=>{if(!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&event.button===0){event.preventDefault();navigate(to);}}}>{children}</a>; }
function downloadSnapshot(run,notify,mode) {
  const payload={source:'production-prototype',format:mode,runId:run.id,params:run.params,prompt:run.prompt,negative:run.negative,checkpoint:run.checkpoint,loras:run.loras||[]};
  if(mode==='debug')payload.execution={attempts:attemptsFor(run),status:run.status,error:run.error||null};
  const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob),anchor=document.createElement('a'); anchor.href=url;anchor.download=`${run.id}-${mode}-workflow.json`;anchor.click();URL.revokeObjectURL(url);notify(`已下载本次任务的${mode==='debug'?'调试':'原始'}工作流演示文件`);
}
function ImageSurface({image,large=false,showCensor=true}) {
  const [failed,setFailed]=useState(false),[intrinsic,setIntrinsic]=useState(null),[bounds,setBounds]=useState(null);
  const surface=useRef(null);
  useEffect(()=>setFailed(false),[image.src]);
  useEffect(()=>{if(!image.censored||!surface.current)return;const observer=new ResizeObserver(entries=>setBounds({width:entries[0].contentRect.width,height:entries[0].contentRect.height}));observer.observe(surface.current);return()=>observer.disconnect();},[image.censored]);
  const ratio=intrinsic&&bounds?Math.min(bounds.width/intrinsic.width,bounds.height/intrinsic.height):0;
  const displayed=ratio?{width:intrinsic.width*ratio,height:intrinsic.height*ratio}:null;
  return <span ref={surface} className={`pt-image-surface${large?' is-large':''}`}>{!failed&&image.src?<img src={image.src} alt={imageName(image)} loading={large?'eager':'lazy'} onLoad={event=>setIntrinsic({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})} onError={()=>setFailed(true)}/>:<span className="pt-image-missing"><i className="pi pi-image" aria-hidden="true"/>图片暂不可用</span>}{showCensor&&image.censored&&displayed&&<span className="pt-image-mask-plane" style={{width:displayed.width,height:displayed.height,left:(bounds.width-displayed.width)/2,top:(bounds.height-displayed.height)/2}}>{(image.censorRegions||[]).map((region,index)=><span key={index} className="pt-mask-region" style={{left:`${region.x*100}%`,top:`${region.y*100}%`,width:`${region.width*100}%`,height:`${region.height*100}%`}}/>)}</span>}</span>;
}

/** Shared result board follows the demo's image grid and separate batch-action strip. */
export function ProductionImageBoard({images,store,updateStore,notify,readOnly=false}) {
  const [filter,setFilter]=useState('all'),[selected,setSelected]=useState([]),[previewId,setPreviewId]=useState(null),[previewSequence,setPreviewSequence]=useState([]),[undo,setUndo]=useState([]),[confirm,setConfirm]=useState(null),[editor,setEditor]=useState(null),[zoom,setZoom]=useState(1),[showCensor,setShowCensor]=useState(true);
  const touch=useRef(null);
  const available=images.filter(image=>!image.trashed);
  const visible=available.filter(image=>filter==='all'||filter==='pending'&&image.review==='pending'||filter==='kept'&&image.review==='kept'||(image.tags||[]).includes(filter));
  const selectedIds=selected.filter(id=>visible.some(image=>image.id===id));
  const eligible=visible.filter(image=>canEdit(store,image));
  const preview=available.find(image=>image.id===previewId);
  const previewImages=previewSequence.map(id=>available.find(image=>image.id===id)).filter(Boolean);
  const previewIndex=previewImages.findIndex(image=>image.id===previewId);
  const isReadOnly=readOnly||available.length>0&&available.every(image=>!canEdit(store,image));
  function mutate(ids,operation) {
    if(readOnly)return;
    const allowed=ids.filter(id=>{const image=store.images.find(item=>item.id===id);return image&&canEdit(store,image);});
    if(!allowed.length)return;
    const previewDraft={...store,images:clone(store.images)};
    operation(previewDraft,allowed);
    const changes=store.images.flatMap(image=>{const after=previewDraft.images.find(next=>next.id===image.id);if(!after)return[];const fields={};for(const key of new Set([...Object.keys(image),...Object.keys(after)])){if(JSON.stringify(image[key])!==JSON.stringify(after[key]))fields[key]={before:image[key],after:after[key]};}return Object.keys(fields).length?[{id:image.id,fields}]:[];});
    if(!changes.length)return;
    setUndo(previous=>[...previous.slice(-9),clone(changes)]);
    updateStore(draft=>{operation(draft,allowed);});setSelected([]);
  }
  function mark(ids,kind) {
    mutate(ids,(draft,allowed)=>{draft.images.forEach(image=>{if(!allowed.includes(image.id))return;if(kind==='kept'){image.review='kept';return;}image.tags||=[];const enabled=!image.tags.includes(kind);if(kind==='cover'&&enabled)draft.images.forEach(other=>{if(other.projectId===image.projectId)other.tags=(other.tags||[]).filter(tag=>tag!=='cover');});image.tags=enabled?[...image.tags,kind]:image.tags.filter(tag=>tag!==kind);if(enabled)image.review='kept';});});
    notify(kind==='kept'?`已保留 ${ids.length} 张图片`:`已更新${filters.find(item=>item.value===kind)?.label||kind}标记`);
  }
  function discard(ids) {
    const candidates=[...previewImages.slice(previewIndex+1),...previewImages.slice(0,previewIndex)]; const next=candidates.find(image=>!ids.includes(image.id));
    mutate(ids,(draft,allowed)=>{draft.images.forEach(image=>{if(allowed.includes(image.id)){image.trashed=true;image.deletedAt=new Date().toLocaleString('zh-CN');image.tags=(image.tags||[]).filter(tag=>tag!=='cover');}});});
    if(ids.includes(previewId))setPreviewId(next?.id||null);notify(`已将 ${ids.length} 张图片移入回收站`);setConfirm(null);
  }
  function undoLast() {
    const previous=undo.at(-1);if(!previous||readOnly)return;
    const conflicted=previous.some(change=>{const image=store.images.find(item=>item.id===change.id);return!image||Object.entries(change.fields).some(([key,value])=>JSON.stringify(image[key])!==JSON.stringify(value.after));});
    if(conflicted){notify('这些图片已有后续修改，无法撤销这一步；可在回收站恢复图片。','warn');return;}
    updateStore(draft=>{for(const change of previous){const image=draft.images.find(item=>item.id===change.id);if(!image||!canEdit(draft,image))continue;for(const [key,value] of Object.entries(change.fields)){if(value.before===undefined)delete image[key];else image[key]=clone(value.before);}}});setUndo(values=>values.slice(0,-1));notify('已撤销上一步图片操作');
  }
  function movePreview(direction) { if(!previewImages.length)return;setPreviewId(previewImages[(Math.max(0,previewIndex)+direction+previewImages.length)%previewImages.length].id); }
  function reviewPreview(kind) { if(!preview)return;const following=previewImages[(Math.max(0,previewIndex)+1)%previewImages.length];if(kind==='trash'){discard([preview.id]);return;}mark([preview.id],kind);if(kind==='kept'&&following?.id!==preview.id)setPreviewId(following.id); }
  useEffect(()=>{setZoom(1);setShowCensor(true);},[previewId]);
  useEffect(()=>{if(!previewId||editor||confirm)return;function keyboard(event){if(event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,textarea,select,[contenteditable="true"]'))return;const key=event.key.toLowerCase();if(['arrowleft','s'].includes(key)){event.preventDefault();movePreview(-1);}if(['arrowright','f'].includes(key)){event.preventDefault();movePreview(1);}if(!isReadOnly){if(['j','w'].includes(key)){event.preventDefault();reviewPreview('kept');}if(['k','e'].includes(key)){event.preventDefault();reviewPreview('trash');}if(['l','r'].includes(key))reviewPreview('featured');if([';','t'].includes(key))reviewPreview('preview');if(key==="'")reviewPreview('cover');if(key==='z')undoLast();}if(key==='h')setShowCensor(value=>!value);}window.addEventListener('keydown',keyboard);return()=>window.removeEventListener('keydown',keyboard);},[previewId,visible,undo,isReadOnly,editor,confirm]);
  const filterCount=value=>available.filter(image=>value==='all'||value==='pending'&&image.review==='pending'||value==='kept'&&image.review==='kept'||(image.tags||[]).includes(value)).length;
  const actionIds=selectedIds.length?selectedIds:eligible.map(image=>image.id);
  return <div className="pt-board">
    <TabMenu model={filters.map(item=>({label:`${item.label} ${filterCount(item.value)}`}))} activeIndex={filters.findIndex(item=>item.value===filter)} onTabChange={event=>{setFilter(filters[event.index].value);setSelected([]);}} pt={tabPT}/>
    {visible.length?<>
      <div className="pt-board-summary"><span>{selectedIds.length?`已选 ${selectedIds.length} 张`:`${visible.length} 张图片 · ${countPending(visible)} 张待审`}</span>{!isReadOnly&&<Button text label={selectedIds.length?'取消选择':'选择待审'} onClick={()=>setSelected(selectedIds.length?[]:eligible.filter(image=>image.review==='pending').map(image=>image.id))}/>}</div>
      <ul className="pt-image-grid">{visible.map(image=><li key={image.id} className={`pt-image-cell${selectedIds.includes(image.id)?' is-selected':''}`}>
        <button className="pt-image-open" type="button" onClick={()=>{setPreviewSequence(visible.map(item=>item.id));setPreviewId(image.id);}} aria-label={`查看${imageName(image)}`}><ImageSurface image={image}/></button>
        {!isReadOnly&&<label className="pt-image-check"><Checkbox checked={selectedIds.includes(image.id)} disabled={!canEdit(store,image)} onChange={()=>setSelected(values=>values.includes(image.id)?values.filter(id=>id!==image.id):[...values,image.id])} aria-label={`选择${imageName(image)}`}/></label>}
        <div className="pt-image-meta"><span>{imageName(image)}</span><div>{image.review==='kept'&&<i className="pi pi-check" title="已保留" aria-label="已保留"/>}{(image.tags||[]).includes('featured')&&<i className="pi pi-star-fill" title="P站" aria-label="P站"/>}{(image.tags||[]).includes('preview')&&<i className="pi pi-eye" title="预览" aria-label="预览"/>}{(image.tags||[]).includes('cover')&&<i className="pi pi-image" title="封面" aria-label="封面"/>}{image.censored&&<i className="pi pi-shield" title="已打码" aria-label="已打码"/>}</div></div>
      </li>)}</ul>
      {!isReadOnly&&<div className="pt-board-actions"><Button icon="pi pi-check" label={selectedIds.length?'保留所选':'保留当前全部'} disabled={!actionIds.length} onClick={()=>mark(actionIds,'kept')}/><Button outlined icon="pi pi-star" label="P站" disabled={!selectedIds.length} onClick={()=>mark(selectedIds,'featured')}/><Button outlined icon="pi pi-eye" label="预览" disabled={!selectedIds.length} onClick={()=>mark(selectedIds,'preview')}/><Button outlined icon="pi pi-image" label="封面" disabled={selectedIds.length!==1} onClick={()=>mark(selectedIds,'cover')}/><Button text severity="danger" icon="pi pi-trash" label={selectedIds.length?'丢弃所选':'丢弃当前全部'} disabled={!actionIds.length} onClick={()=>setConfirm(actionIds)}/><Button text icon="pi pi-undo" label="撤销" disabled={!undo.length} onClick={undoLast}/></div>}
    </>:<Empty>当前筛选下没有图片</Empty>}
    <Dialog header="移入回收站" visible={!!confirm} onHide={()=>setConfirm(null)} className="pt-confirm" footer={<><Button text label="取消" onClick={()=>setConfirm(null)}/><Button severity="danger" label="移入回收站" onClick={()=>discard(confirm)}/></>}><p>将当前{selectedIds.length?'所选':'筛选范围内的'} {confirm?.length} 张图片移入回收站，其他图片保留。图片可在回收站恢复，封面标记会清除。</p></Dialog>
    <Dialog header={preview?imageName(preview):'图片预览'} visible={!!preview} onHide={()=>setPreviewId(null)} className="pt-lightbox" draggable={false} maximizable blockScroll footer={preview&&<div className="pt-preview-actions"><Button text icon="pi pi-chevron-left" aria-label="上一张" onClick={()=>movePreview(-1)}/><span>{Math.max(0,previewIndex)+1} / {previewImages.length}</span><Button text icon="pi pi-chevron-right" aria-label="下一张" onClick={()=>movePreview(1)}/>{!isReadOnly&&<><Button icon="pi pi-check" label="保留" onClick={()=>reviewPreview('kept')}/><Button outlined icon="pi pi-star" label="P站" onClick={()=>reviewPreview('featured')}/><Button outlined icon="pi pi-eye" label="预览" onClick={()=>reviewPreview('preview')}/><Button outlined icon="pi pi-image" label="封面" onClick={()=>reviewPreview('cover')}/><Button text severity="danger" icon="pi pi-trash" label="丢弃" onClick={()=>reviewPreview('trash')}/><Button text icon="pi pi-undo" label="撤销" disabled={!undo.length} onClick={undoLast}/><Button text icon="pi pi-shield" label="打码" onClick={()=>setEditor(preview)}/></>}</div>}>
      {preview&&<><div className="pt-preview-tools"><Button text icon="pi pi-search-minus" aria-label="缩小" disabled={zoom<=1} onClick={()=>setZoom(value=>Math.max(1,value-.5))}/><span>{Math.round(zoom*100)}%</span><Button text icon="pi pi-search-plus" aria-label="放大" disabled={zoom>=3} onClick={()=>setZoom(value=>Math.min(3,value+.5))}/>{preview.censored&&<Button text label={showCensor?'查看原图':'查看打码版'} onClick={()=>setShowCensor(value=>!value)}/>}</div><div className="pt-preview-stage" onTouchStart={event=>{touch.current=event.touches[0].clientX;}} onTouchEnd={event=>{if(zoom!==1||touch.current==null)return;const delta=event.changedTouches[0].clientX-touch.current;if(Math.abs(delta)>70)movePreview(delta>0?-1:1);touch.current=null;}}><div style={{'--preview-zoom':zoom,width:`${zoom*100}%`,maxWidth:zoom===1?'100%':'none'}}><ImageSurface image={preview} large showCensor={showCensor}/></div></div>{preview.path&&<div className="pt-image-path"><span>{preview.path}</span><Button text icon="pi pi-copy" aria-label="复制图片路径" onClick={()=>navigator.clipboard.writeText(preview.path).then(()=>notify('图片路径已复制'),()=>notify('复制失败，请手动选择路径','error'))}/></div>}<p className="pt-keyboard-hint">← → 切换 · J 保留 · K 丢弃 · Z 撤销 · Esc 关闭</p></>}
    </Dialog>
    {editor&&<CensorEditor image={editor} onHide={()=>setEditor(null)} onSave={regions=>{mutate([editor.id],draft=>{const image=draft.images.find(item=>item.id===editor.id);image.censorRegions=regions;image.censored=regions.length>0;});setEditor(null);notify('已保存独立打码版本，原图保持不变');}}/>}
  </div>;
}

function CensorEditor({image,onHide,onSave}) {
  const [regions,setRegions]=useState(clone(image.censorRegions||[])),[draft,setDraft]=useState(null),[showOriginal,setShowOriginal]=useState(false),[discard,setDiscard]=useState(false);
  const origin=useRef(null),changed=JSON.stringify(regions)!==JSON.stringify(image.censorRegions||[]);
  function point(event){const rect=event.currentTarget.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))};}
  function close(){if(changed)setDiscard(true);else onHide();}
  return <><Dialog header={`打码 · ${imageName(image)}`} visible onHide={close} draggable={false} className="pt-censor-dialog" blockScroll footer={<><Button text label="取消" onClick={close}/><Button label="保存打码版" onClick={()=>onSave(regions)}/></>}><p className="pt-censor-help">在图片上拖出遮挡区域。保存只生成打码版，保留原图。</p><div className="pt-censor-toolbar"><Button icon="pi pi-sparkles" label="自动打码" onClick={()=>{setRegions(image.autoCensorRegions||[{x:.28,y:.4,width:.44,height:.18}]);setShowOriginal(false);}}/><Button outlined icon="pi pi-eye" label={showOriginal?'返回打码预览':'对比原图'} onClick={()=>setShowOriginal(value=>!value)}/><Button text icon="pi pi-undo" label="撤销区域" disabled={!regions.length} onClick={()=>setRegions(values=>values.slice(0,-1))}/><Button text label="清空区域" disabled={!regions.length} onClick={()=>setRegions([])}/></div><div className="pt-censor-canvas" onPointerDown={event=>{if(showOriginal)return;origin.current=point(event);event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={event=>{if(!origin.current)return;const next=point(event),start=origin.current;setDraft({x:Math.min(start.x,next.x),y:Math.min(start.y,next.y),width:Math.abs(next.x-start.x),height:Math.abs(next.y-start.y)});}} onPointerUp={()=>{if(draft&&draft.width>.005&&draft.height>.005)setRegions(values=>[...values,draft]);origin.current=null;setDraft(null);}} onPointerCancel={()=>{origin.current=null;setDraft(null);}}><img src={image.src} alt={imageName(image)} draggable={false}/>{!showOriginal&&[...regions,...draft?[draft]:[]].map((region,index)=><span key={index} className="pt-mask-region" style={{left:`${region.x*100}%`,top:`${region.y*100}%`,width:`${region.width*100}%`,height:`${region.height*100}%`}}/>)}</div></Dialog><Dialog header="放弃本次修改？" visible={discard} onHide={()=>setDiscard(false)} className="pt-confirm" footer={<><Button text label="继续编辑" onClick={()=>setDiscard(false)}/><Button severity="danger" label="放弃修改" onClick={onHide}/></>}><p>尚未保存的打码区域会丢失。</p></Dialog></>;
}

function ExecutionSnapshot({run}) {
  const params=run.params||{};
  const sampler=(number)=>{const value=params[`ksampler${number}`]||params[`sampler${number}`]||{};return <div className="pt-sampler"><h3>KSampler {number}</h3><dl><div><dt>Seed</dt><dd>{value.seed??params[`seed${number}`]??(number===1?(run.seed??params.seed??'未记录'):(params.secondSeed??'随机'))}</dd></div><div><dt>Steps</dt><dd>{value.steps??params[`steps${number}`]??(number===1?params.steps:params.secondSteps)??'未记录'}</dd></div><div><dt>CFG</dt><dd>{value.cfg??params[`cfg${number}`]??(number===1?params.cfg:params.secondCfg)??'未记录'}</dd></div><div><dt>Denoise</dt><dd>{value.denoise??(number===1?1:params.denoise??'未记录')}</dd></div><div><dt>Sampler</dt><dd>{value.sampler_name||(number===1?params.sampler:params.secondSampler)||'未记录'}</dd></div><div><dt>Scheduler</dt><dd>{value.scheduler||(number===1?params.scheduler:params.secondScheduler)||'未记录'}</dd></div></dl></div>;};
  return <details className="pt-execution"><summary><span>执行参数 · {run.id}</span><span>{shortDate(run.createdAt)}</span></summary><div className="pt-execution-body"><div className="pt-sampler-grid">{sampler(1)}{(params.secondEnabled??Number(params.upscaleFactor||params.upscale||1)>1)?sampler(2):<div className="pt-sampler"><h3>KSampler 2</h3><p>未启用二阶段采样</p></div>}</div><dl className="pt-run-config"><div><dt>Checkpoint</dt><dd>{run.checkpoint||params.checkpointName||params.checkpoint||'未记录'}</dd></div><div><dt>画幅</dt><dd>{params.width&&params.height?`${params.width} × ${params.height}px`:`${params.aspectRatio||'未记录'} · 短边 ${params.shortSidePx||params.shortSide||'未记录'}px`}</dd></div><div><dt>生成数量</dt><dd>{run.batchSize} 张</dd></div><div><dt>执行尝试</dt><dd>{attemptsFor(run).length} 次</dd></div></dl>{(run.loras||params.loras||[]).length>0&&<div><h3>LoRA</h3><ul className="pt-lora-list">{(run.loras||params.loras).map((lora,index)=><li key={lora.id||index}><span>{lora.name||lora.path}</span><span>{lora.weight??1}</span></li>)}</ul></div>}<div className="pt-prompts"><div><h3>Prompt</h3><pre>{run.prompt||'未记录'}</pre></div><div><h3>Negative</h3><pre>{run.negative||'未记录'}</pre></div></div></div></details>;
}

export function ProductionTasks(props) {
  const {route,store}=props,runId=route.segments[1];
  if(runId){const run=store.runs.find(item=>item.id===runId);return <RunDetail {...props} run={run}/>;}
  return <TaskWorkbench {...props}/>;
}
function RunDetail({run,store,updateStore,navigate,notify,route}) {
  const back=route.query.from||'production/tasks';
  const operations=useRunOperations({store,updateStore,notify,onDeleted:()=>navigate(back)});
  if(!run)return <div className="pt-page"><Message severity="warn" text="这条任务记录已不存在。"/><Button label="返回任务" onClick={()=>navigate('production/tasks')}/></div>;
  const project=store.projects.find(item=>item.id===run.projectId),section=store.sections.find(item=>item.id===run.sectionId),images=store.images.filter(image=>image.runId===run.id);
  const next=store.runs.find(item=>item.id!==run.id&&store.images.some(image=>image.runId===item.id&&!image.trashed&&image.review==='pending')&&!store.projects.find(project=>project.id===item.projectId)?.archived);
  return <div className="pt-page"><div className="pt-detail-heading"><div><RouteLink to={back} navigate={navigate} className="pt-back"><i className="pi pi-arrow-left" aria-hidden="true"/>返回任务</RouteLink><h1>{project?.name||'项目已删除'} / {section?.name||'小节已删除'}</h1><p>{run.id} · <RunState status={run.status}/> · {timingSummary(run)}</p></div><div className="pt-toolbar"><Button outlined icon="pi pi-external-link" label="跳转小节" disabled={!section} onClick={()=>navigate(`production/projects/${run.projectId}/sections/${run.sectionId}`)}/><Button text icon="pi pi-download" label="原始工作流" onClick={()=>downloadSnapshot(run,notify,'original')}/><Button text icon="pi pi-code" label="调试工作流" onClick={()=>downloadSnapshot(run,notify,'debug')}/></div></div>
    {project?.archived&&<Message severity="info" text="项目已归档，任务参数与图片仅供查看。"/>}
    <RunActionButtons run={run} store={store} operations={operations}/>
    {waitingReason(run,store)&&<Message severity={run.controlError?'error':'info'} text={waitingReason(run,store)}/>}
    <ExecutionSnapshot run={run}/><AttemptHistory run={run} notify={notify}/>
    {run.status==='running'&&<div className="pt-detail-progress"><div><RunState status={run.status}/><span>采样进度 {run.progress||0}%</span></div><ProgressBar value={run.progress||0} showValue={false}/></div>}
    {run.error&&<div className="pt-attempt-error"><Message severity="error" text={run.error}/><Button text icon="pi pi-copy" label="复制错误" onClick={()=>navigator.clipboard.writeText(run.error).then(()=>notify('错误已复制'),()=>notify('复制失败，请手动选择文本','error'))}/></div>}
    <ProductionImageBoard images={images} store={store} updateStore={updateStore} notify={notify} readOnly={project?.archived}/>
    {terminalStates.includes(run.status)&&images.length>0&&countPending(images)===0&&next&&<div className="pt-next-review"><span>当前任务的图片已审核完毕</span><Button label="下一组待审核" icon="pi pi-arrow-right" iconPos="right" onClick={()=>navigate(`production/tasks/${next.id}?from=${encodeURIComponent(back)}`)}/></div>}{operations.dialog}
  </div>;
}

function TaskWorkbench({route,store,updateStore,navigate,notify}) {
  const tab=tabs.some(item=>item.value===route.query.view)?route.query.view:'pending';
  const [collapsed,setCollapsed]=useState([]),[selected,setSelected]=useState([]),[page,setPage]=useState(0);
  const operations=useRunOperations({store,updateStore,notify,onDeleted:()=>setSelected([])});
  const projectId=route.query.project||'',sectionId=route.query.section||'',status=route.query.status||'all',time=route.query.time||'all',grouping=route.query.group||'project';
  const oldest=route.query.order==='oldest';
  function query(patch){setPage(0);setSelected([]);const next={...route.query,...patch};const params=new URLSearchParams();Object.entries(next).forEach(([key,value])=>{if(value&&value!=='__all__')params.set(key,value);});navigate(`production/tasks${params.size?'?'+params:''}`);}
  const now=Date.now();
  function inTime(run){const date=new Date(run.createdAt).getTime();if(time==='day')return date>=now-86400000;if(time==='week')return date>=now-7*86400000;if(time==='month')return date>=now-30*86400000;if(time==='custom'){if(route.query.start&&date<new Date(route.query.start+'T00:00:00').getTime())return false;if(route.query.end&&date>new Date(route.query.end+'T23:59:59').getTime())return false;}return true;}
  const runs=store.runs.filter(run=>(!projectId||run.projectId===projectId)&&(!sectionId||run.sectionId===sectionId)&&inTime(run)).sort((a,b)=>(new Date(a.createdAt)-new Date(b.createdAt))*(oldest?1:-1));
  const runIds=new Set(runs.map(run=>run.id));
  const images=store.images.filter(image=>(!projectId||image.projectId===projectId)&&(!sectionId||image.sectionId===sectionId)&&(time==='all'||runIds.has(image.runId)));
  const filtered=runs.filter(run=>tab==='pending'?countPending(images.filter(image=>image.runId===run.id))>0:tab==='queue'?activeStates.includes(run.status):tab==='failed'?run.status==='failed':tab==='records'?(status==='all'||run.status===status):false);
  const groups=new Map();
  filtered.forEach(run=>{const groupId=grouping==='time'?dateString(new Date(run.createdAt)):run.projectId;const title=grouping==='time'?shortDate(run.createdAt).split(' ')[0]:store.projects.find(project=>project.id===run.projectId)?.name||'项目已删除';if(!groups.has(groupId))groups.set(groupId,{id:groupId,title,rows:[]});groups.get(groupId).rows.push(run);});
  const grouped=[...groups.values()],first=Math.min(page,Math.max(0,Math.floor((grouped.length-1)/8)*8)),visibleGroups=grouped.slice(first,first+8);
  const selectedRuns=filtered.filter(run=>selected.includes(run.id)&&runEditable(store,run));
  const counts={pending:countPending(images),queue:runs.filter(run=>activeStates.includes(run.status)).length,failed:runs.filter(run=>run.status==='failed').length,records:runs.length,censor:(store.censorJobs||[]).filter(job=>!projectId||job.projectId===projectId).length,trash:images.filter(image=>image.trashed).length};
  const running=runs.filter(run=>run.status==='running');
  function selectGroup(groupRuns){const ids=groupRuns.filter(run=>runEditable(store,run)).map(run=>run.id),all=ids.every(id=>selected.includes(id));setSelected(values=>all?values.filter(id=>!ids.includes(id)):[...new Set([...values,...ids])]);}
  function dateString(value){if(!value)return '';return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;}
  const filteredLabel=tab==='pending'?'组结果':'条任务';
  return <div className="pt-page"><div className="pt-workbench-heading"><div><h1>任务工作台</h1><p>待审图片、生成队列与任务记录</p></div><Dropdown aria-label="项目范围" value={projectId||'__all__'} options={[{label:'全部项目',value:'__all__'},...store.projects.map(project=>({label:project.name,value:project.id}))]} onChange={event=>query({project:event.value==='__all__'?'':event.value,section:''})}/></div>
    <div className="pt-queue-counts"><span><i className="pi pi-images" aria-hidden="true"/><strong>{counts.pending}</strong> 张待审</span><span><i className="pi pi-clock" aria-hidden="true"/><strong>{counts.queue}</strong> 个队列任务</span><span><i className="pi pi-exclamation-circle" aria-hidden="true"/><strong>{counts.failed}</strong> 个失败</span></div>
    {!!running.length&&<section className="pt-running-now" aria-label="当前运行中">{running.map(run=>{const section=store.sections.find(item=>item.id===run.sectionId),project=store.projects.find(item=>item.id===run.projectId);return <div className="pt-running-line" key={run.id}><RouteLink to={`production/tasks/${run.id}?from=${encodeURIComponent(route.key)}`} navigate={navigate}><strong>{project?.name} · {section?.name}</strong><span>{run.id} · 已用 {runDuration(run)}</span></RouteLink><div className="pt-progress"><div><span>采样进度</span><strong>{run.progress||0}%</strong></div><ProgressBar value={run.progress||0} showValue={false}/></div><Button text icon="pi pi-pause" label="暂停" loading={operations.pending.includes(run.id)} disabled={!runEditable(store,run)} onClick={()=>operations.act([run.id],'pause')}/></div>;})}</section>}
    <section className="pt-queue-surface"><TabMenu model={tabs.map(item=>({label:`${item.label} ${counts[item.value]}`}))} activeIndex={tabs.findIndex(item=>item.value===tab)} onTabChange={event=>query({view:tabs[event.index].value,status:''})} pt={tabPT}/>
      <details className="pt-task-filters" open={!!(sectionId||time!=='all')}><summary>筛选与排列{sectionId||time!=='all'?' · 已筛选':''}</summary><div className="pt-filter-fields">
        <label><span>小节</span><Dropdown aria-label="小节范围" value={sectionId||'__all__'} options={[{label:'全部小节',value:'__all__'},...store.sections.filter(section=>!projectId||section.projectId===projectId).map(section=>({label:projectId?section.name:`${store.projects.find(project=>project.id===section.projectId)?.name} / ${section.name}`,value:section.id}))]} onChange={event=>query({section:event.value==='__all__'?'':event.value})}/></label>
        <label><span>时间</span><Dropdown aria-label="任务时间范围" value={time} options={[{label:'全部时间',value:'all'},{label:'近24小时',value:'day'},{label:'近7天',value:'week'},{label:'近30天',value:'month'},{label:'自选日期',value:'custom'}]} onChange={event=>query({time:event.value,start:'',end:''})}/></label>
        <label><span>分组</span><Dropdown aria-label="任务分组" value={grouping} options={[{label:'按项目分组',value:'project'},{label:'按日期分组',value:'time'}]} onChange={event=>query({group:event.value})}/></label>
        <label><span>排序</span><Dropdown aria-label="任务时间排序" value={oldest?'oldest':'newest'} options={[{label:'最新在前',value:'newest'},{label:'最早在前',value:'oldest'}]} onChange={event=>query({order:event.value})}/></label>
        {tab==='records'&&<label><span>任务状态</span><Dropdown aria-label="任务状态" value={status} options={[{label:`全部状态 ${runs.length}`,value:'all'},...Object.entries(states).map(([value,label])=>({label:`${label} ${runs.filter(run=>run.status===value).length}`,value}))]} onChange={event=>query({status:event.value})}/></label>}
        {time==='custom'&&<label className="pt-date-range"><span>起止日期</span><Calendar aria-label="任务起止日期" selectionMode="range" value={[route.query.start?new Date(route.query.start+'T00:00:00'):null,route.query.end?new Date(route.query.end+'T00:00:00'):null]} onChange={event=>query({start:dateString(event.value?.[0]),end:dateString(event.value?.[1])})} dateFormat="yy-mm-dd" readOnlyInput showIcon hideOnRangeSelection placeholder="选择日期范围"/></label>}
        {(sectionId||time!=='all'||status!=='all')&&<Button text label="清除筛选" onClick={()=>query({section:'',time:'',status:'',start:'',end:''})}/>}
      </div></details>
      {tab==='trash'?<TrashPanel images={images.filter(image=>image.trashed)} store={store} updateStore={updateStore} notify={notify}/>:tab==='censor'?<CensorJobs jobs={(store.censorJobs||[]).filter(job=>!projectId||job.projectId===projectId)} store={store} updateStore={updateStore} notify={notify}/>:<>
        <div className="pt-queue-toolbar"><span>{grouped.length} {grouping==='time'?'个日期':'个项目'} · {filtered.length} {filteredLabel}{selectedRuns.length?` · 已选 ${selectedRuns.length}`:''}</span>{tab!=='pending'&&<div className="pt-toolbar"><Button text label={selectedRuns.length?'取消选择':'选择当前筛选全部'} disabled={!filtered.length} onClick={()=>setSelected(selectedRuns.length?[]:filtered.filter(run=>runEditable(store,run)).map(run=>run.id))}/>
          {selectedRuns.some(run=>['unsubmitted','submitted','running'].includes(run.status))&&<Button text icon="pi pi-pause" label="暂停" onClick={()=>operations.act(selectedRuns.map(run=>run.id),'pause')}/>}
          {selectedRuns.some(run=>run.status==='paused')&&<Button text icon="pi pi-play" label="从头恢复" onClick={()=>operations.act(selectedRuns.map(run=>run.id),'resume')}/>}
          {selectedRuns.some(run=>run.status==='failed')&&<Button outlined icon="pi pi-refresh" label="重试所选" onClick={()=>operations.act(selectedRuns.map(run=>run.id),'retry')}/>}
          {selectedRuns.some(run=>activeStates.includes(run.status))&&<Button text severity="danger" label="取消活动任务" onClick={()=>operations.requestCancel(selectedRuns.filter(run=>activeStates.includes(run.status)).map(run=>run.id))}/>}
          {selectedRuns.some(run=>terminalStates.includes(run.status))&&<Button text severity="danger" icon="pi pi-trash" label="删除终态任务" disabled={selectedRuns.some(run=>activeStates.includes(run.status))} onClick={()=>operations.requestDelete(selectedRuns.map(run=>run.id))}/>}
        </div>}</div>
        {!filtered.length?<Empty>当前筛选范围内没有{tab==='pending'?'待审图片':'任务'}</Empty>:visibleGroups.map(group=>{const isCollapsed=collapsed.includes(group.id);return <section className="pt-project-group" key={group.id}><div className="pt-project-group-heading"><button type="button" aria-expanded={!isCollapsed} onClick={()=>setCollapsed(values=>values.includes(group.id)?values.filter(value=>value!==group.id):[...values,group.id])}><i className={`pi ${isCollapsed?'pi-chevron-right':'pi-chevron-down'}`} aria-hidden="true"/><strong>{group.title}</strong><span>{group.rows.length} {filteredLabel}</span></button>{tab!=='pending'&&<Checkbox checked={group.rows.filter(run=>runEditable(store,run)).length>0&&group.rows.filter(run=>runEditable(store,run)).every(run=>selected.includes(run.id))} disabled={group.rows.every(run=>!runEditable(store,run))} onChange={()=>selectGroup(group.rows)} aria-label={`选择${group.title}的全部任务`}/>}</div>
          {!isCollapsed&&group.rows.map(run=>{const section=store.sections.find(item=>item.id===run.sectionId),results=images.filter(image=>image.runId===run.id&&!image.trashed),thumbs=results.length?results:store.images.filter(image=>image.sectionId===run.sectionId&&!image.trashed).slice(0,1);return <div className={`pt-run-row${tab==='pending'?' is-review-row':''}`} key={run.id}>
            {tab!=='pending'&&<Checkbox checked={selected.includes(run.id)} disabled={!runEditable(store,run)||operations.pending.includes(run.id)} onChange={()=>setSelected(values=>values.includes(run.id)?values.filter(id=>id!==run.id):[...values,run.id])} aria-label={`选择${section?.name} ${run.id}`}/>}
            <RouteLink className="pt-run-identity" to={`production/tasks/${run.id}?from=${encodeURIComponent(route.key)}`} navigate={navigate}><strong>{grouping==='time'?`${store.projects.find(project=>project.id===run.projectId)?.name} / `:''}{section?.name||'小节已删除'}</strong><span>{run.id} · {shortDate(run.createdAt)}</span>{tab!=='pending'&&<><RunState status={run.status}/><span>{timingSummary(run)}</span>{waitingReason(run,store)&&<span className={run.controlError?'pt-control-error':''}>{waitingReason(run,store)}</span>}</>}</RouteLink>
            {!!thumbs.length&&<RouteLink className="pt-run-thumbs" to={`production/tasks/${run.id}?from=${encodeURIComponent(route.key)}`} navigate={navigate} aria-label={`审核${section?.name} ${run.id}`}><span className="pt-thumb-strip">{thumbs.slice(0,8).map(image=><ImageSurface key={image.id} image={image}/>)}</span>{tab==='pending'&&<span className="pt-thumb-count">{results.length} 张 · {countPending(results)} 待审<i className="pi pi-angle-right" aria-hidden="true"/></span>}</RouteLink>}
            {run.status==='failed'&&tab!=='pending'?<div className="pt-failure"><p>{run.error||'未返回生成结果，请检查模型与连接后重试。'}</p><Button text icon="pi pi-copy" label="复制报错" onClick={()=>navigator.clipboard.writeText(run.error||'未返回生成结果').then(()=>notify('失败原因已复制'),()=>notify('复制失败，请手动选择文本','error'))}/><RunActionButtons run={run} store={store} operations={operations}/></div>:tab!=='pending'&&<RunActionButtons run={run} store={store} operations={operations}/>}</div>;})}</section>;})}
        {grouped.length>8&&<Paginator first={first} rows={8} totalRecords={grouped.length} onPageChange={event=>{setPage(event.first);setSelected([]);}} template="PrevPageLink PageLinks NextPageLink"/>}
      </>}
    </section>{operations.dialog}
  </div>;
}
function TrashPanel({images,store,updateStore,notify}) {
  const [selected,setSelected]=useState([]),[deleting,setDeleting]=useState(null);
  const eligible=images.filter(image=>canEdit(store,image)),ids=selected.filter(id=>eligible.some(image=>image.id===id));
  function restore(target){updateStore(draft=>{draft.images.forEach(image=>{if(target.includes(image.id)&&canEdit(draft,image)){image.trashed=false;image.tags=(image.tags||[]).filter(tag=>tag!=='cover');}});});setSelected([]);notify(`已恢复 ${target.length} 张图片至原小节`);}
  function remove(){updateStore(draft=>{draft.images=draft.images.filter(image=>!deleting.includes(image.id)||!canEdit(draft,image));});notify(`已永久删除 ${deleting.length} 张图片`);setSelected([]);setDeleting(null);}
  return <div className="pt-trash-panel"><div className="pt-queue-toolbar"><span>{images.length} 张已丢弃图片{ids.length?` · 已选 ${ids.length}`:''}</span><div className="pt-toolbar"><Button text label={ids.length?'取消选择':'全选'} disabled={!eligible.length} onClick={()=>setSelected(ids.length?[]:eligible.map(image=>image.id))}/><Button outlined icon="pi pi-replay" label="恢复所选" disabled={!ids.length} onClick={()=>restore(ids)}/><Button text severity="danger" label={ids.length?'永久删除所选':'清空回收站'} disabled={!eligible.length} onClick={()=>setDeleting(ids.length?ids:eligible.map(image=>image.id))}/></div></div>{!images.length?<Empty>回收站为空</Empty>:<ul className="pt-trash-list">{images.map(image=><li key={image.id}><Checkbox checked={ids.includes(image.id)} disabled={!canEdit(store,image)} aria-label={`选择${imageName(image)}`} onChange={()=>setSelected(values=>values.includes(image.id)?values.filter(id=>id!==image.id):[...values,image.id])}/><ImageSurface image={image}/><div><strong>{imageName(image)}</strong><span>{store.projects.find(item=>item.id===image.projectId)?.name} / {store.sections.find(item=>item.id===image.sectionId)?.name}</span><span>{image.deletedAt?shortDate(image.deletedAt):'已移入回收站'}</span></div><Button text icon="pi pi-replay" label="恢复" disabled={!canEdit(store,image)} onClick={()=>restore([image.id])}/></li>)}</ul>}<Dialog header="永久删除图片" visible={!!deleting} onHide={()=>setDeleting(null)} className="pt-confirm" footer={<><Button text label="取消" onClick={()=>setDeleting(null)}/><Button severity="danger" label="永久删除" onClick={remove}/></>}><p>永久删除当前范围内的 {deleting?.length} 张图片，此操作无法撤销。</p></Dialog></div>;
}
function CensorJobs({jobs,store,updateStore,notify}) {
  function setStatus(id,status){
    updateStore(draft=>{const job=draft.censorJobs.find(item=>item.id===id);if(!job||draft.projects.find(item=>item.id===job.projectId)?.archived)return;if(status==='paused'){job.pauseRequested=true;}else{job.status=status;job.pauseRequested=false;}});
    if(status==='paused')setTimeout(()=>updateStore(draft=>{const job=draft.censorJobs.find(item=>item.id===id);if(!job?.pauseRequested||job.status!=='running')return;const image=draft.images.find(item=>item.id===job.imageIds?.[job.done||0]);if(image){image.censored=true;image.censorRegions||=image.autoCensorRegions||[{x:.28,y:.4,width:.44,height:.18}];}job.done=Math.min(job.total,(job.done||0)+1);job.status=job.done>=job.total?'completed':'paused';job.pauseRequested=false;}),600);
    notify(status==='paused'?'当前图片完成后暂停，剩余图片保留在队列':status==='cancelled'?'打码任务已取消':'打码任务已恢复');
  }
  return <div className="pt-censor-jobs">{!jobs.length?<Empty>当前没有打码任务。可从项目的交付操作创建。</Empty>:jobs.map(job=><article className="pt-censor-job" key={job.id}><div><h3>{store.projects.find(item=>item.id===job.projectId)?.name}</h3><p>{job.name||'精选图片批量打码'} · <RunState status={job.status}/></p></div><div className="pt-progress"><div><span>{job.done||0} / {job.total} 张{job.failed?` · 失败 ${job.failed}`:''}</span><span>{Math.round((job.done||0)/Math.max(1,job.total)*100)}%</span></div><ProgressBar value={Math.round((job.done||0)/Math.max(1,job.total)*100)} showValue={false}/></div>{!['completed','cancelled'].includes(job.status)&&<div className="pt-toolbar"><Button text icon={job.status==='failed'?'pi pi-refresh':job.status==='paused'?'pi pi-play':'pi pi-pause'} label={job.pauseRequested?'暂停中':job.status==='failed'?'重试':job.status==='paused'?'恢复':'暂停'} disabled={job.pauseRequested||store.projects.find(item=>item.id===job.projectId)?.archived} onClick={()=>setStatus(job.id,['paused','failed'].includes(job.status)?'running':'paused')}/><Button text severity="danger" label="取消" disabled={store.projects.find(item=>item.id===job.projectId)?.archived} onClick={()=>setStatus(job.id,'cancelled')}/></div>}</article>)}</div>;
}
