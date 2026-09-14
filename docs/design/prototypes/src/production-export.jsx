import React, { useEffect, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Message } from 'primereact/message';
import { ProgressBar } from 'primereact/progressbar';
import { zipSync } from 'fflate';
import { exportEligibility } from './production-export-model.mjs';
import './production-export.css';

const fileName = (slug, index) => `${slug}_${String(index + 1).padStart(3, '0')}.jpg`;
async function imageBytes(image, masked) {
  const response = await fetch(image.src);
  if (!response.ok) throw new Error(`图片「${image.name || image.id}」加载失败。`);
  const blob = await response.blob();
  if (!masked) return new Uint8Array(await blob.arrayBuffer());
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    context.fillStyle = '#202020';
    for (const region of image.censorRegions || []) context.fillRect(region.x * bitmap.width, region.y * bitmap.height, region.width * bitmap.width, region.height * bitmap.height);
    const output = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .9));
    if (!output) throw new Error('打码版本转换失败，请重试。');
    return new Uint8Array(await output.arrayBuffer());
  } finally { bitmap.close(); }
}

export function ProductionExportDialog({ project, store, updateStore, visible, onHide, notify }) {
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState(''), [result, setResult] = useState(null);
  const urls = useRef([]);
  const eligibility = exportEligibility(project, store);
  const previous = (store.exports || []).find(entry => entry.projectId === project.id);
  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), []);
  useEffect(() => { setResult(null); setError(''); }, [project.id]);
  async function pack() {
    if (eligibility.issues.length || busy) return;
    setBusy(true); setError(''); setProgress(0);
    try {
      const originals = {}, files = [], { kept, covers, selected } = eligibility;
      let done = 0;
      const total = kept.length + selected.length;
      for (const [index, image] of kept.entries()) {
        const bytes = await imageBytes(image, false);
        originals[fileName(project.slug, index)] = bytes;
        if (image.id === covers[0].id) files.push({ name: 'cover.jpg', bytes });
        setProgress(Math.round(++done / total * 90));
      }
      let pixiv = 0, preview = 0;
      for (const image of selected) {
        const bytes = await imageBytes(image, true);
        if (image.tags.includes('cover')) files.push({ name: 'cover_censored.jpg', bytes });
        if (image.tags.includes('featured')) files.push({ name: 'pixiv/' + fileName(project.slug, pixiv++), bytes });
        if (image.tags.includes('preview')) files.push({ name: 'preview/' + fileName(project.slug, preview++), bytes });
        setProgress(Math.round(++done / total * 90));
      }
      const zip = zipSync(originals, { level: 0 });
      urls.current.forEach(URL.revokeObjectURL); urls.current = [];
      const downloadable = [{ name: project.slug + '.zip', bytes: zip }, ...files].map(file => {
        const url = URL.createObjectURL(new Blob([file.bytes], { type: file.name.endsWith('.zip') ? 'application/zip' : 'image/jpeg' }));
        urls.current.push(url); return { name: file.name, url };
      });
      const completedAt = new Date().toLocaleString('zh-CN');
      setResult({ files: downloadable, completedAt, count: kept.length }); setProgress(100);
      updateStore?.(draft => { draft.exports = (draft.exports || []).filter(entry => entry.projectId !== project.id); draft.exports.push({ projectId: project.id, slug: project.slug, completedAt, count: kept.length }); });
      notify('演示图片包已生成，可下载检查。');
    } catch (e) { setError(e.message || '打包失败，保留当前条件，请重试。'); }
    finally { setBusy(false); }
  }
  return <Dialog header="导出项目图片" visible={visible} onHide={() => { if (!busy) onHide(); }} className="production-export-dialog" draggable={false} blockScroll closable={!busy}
    footer={<><Button text label={result ? '关闭' : '取消'} disabled={busy} onClick={onHide}/><Button label={result ? '重新打包' : '生成交付包'} icon="pi pi-download" loading={busy} disabled={eligibility.issues.length > 0} onClick={pack}/></>}>
    <div className="pe-content"><strong>{project.name}</strong><p>保留原图打包为 ZIP，封面、P站和预览用途图分别输出。再次导出覆盖此项目的最新交付。</p>
      <dl className="pe-counts"><div><dt>保留原图</dt><dd>{eligibility.kept.length}</dd></div><div><dt>封面</dt><dd>{eligibility.covers.length}</dd></div><div><dt>P站</dt><dd>{eligibility.selected.filter(i => i.tags.includes('featured')).length}</dd></div><div><dt>预览</dt><dd>{eligibility.selected.filter(i => i.tags.includes('preview')).length}</dd></div></dl>
      {eligibility.issues.length > 0 && <div className="pe-issues" role="status">{eligibility.issues.map(issue => <p key={issue}><i className="pi pi-exclamation-circle" aria-hidden="true"/>{issue}</p>)}{eligibility.missing.length > 0 && <details><summary>查看缺少打码的图片</summary><ul>{eligibility.missing.map(image => <li key={image.id}>{store.sections.find(s => s.id === image.sectionId)?.name} · {image.name || image.id}</li>)}</ul></details>}</div>}
      {previous && !result && <p>上次演示打包：{previous.completedAt}</p>}
      {busy && <div aria-live="polite"><p>正在准备图片和打包… {progress}%</p><ProgressBar value={progress} showValue={false}/></div>}
      {error && <Message severity="error" text={error}/>}
      {result && <section className="pe-result"><h2>交付包已准备好</h2><p>{result.completedAt} · {result.count} 张保留原图</p><a className="pe-download" href={result.files[0].url} download={result.files[0].name}><i className="pi pi-download" aria-hidden="true"/>{result.files[0].name}</a><details><summary>封面与用途图片（{result.files.length - 1}）</summary><ul>{result.files.slice(1).map(file => <li key={file.name}><a href={file.url} download={file.name.split('/').at(-1)}>{file.name}</a></li>)}</ul></details></section>}
      <div className="pe-path"><span>目标路径示例</span><code>{'<EXPORT_ROOT>/' + project.name + '/' + (project.slug || 'slug') + '.zip'}</code><Button text icon="pi pi-copy" label="复制示例路径" onClick={async () => { try { await navigator.clipboard.writeText('<EXPORT_ROOT>/' + project.name + '/' + (project.slug || 'slug') + '.zip'); notify('已复制目标路径示例。'); } catch { notify('复制失败，可直接选择路径文本。', 'warn'); } }}/></div>
      <p className="pe-note">此处实际打包演示图片供下载，不写入服务器交付目录。</p>
    </div>
  </Dialog>;
}
