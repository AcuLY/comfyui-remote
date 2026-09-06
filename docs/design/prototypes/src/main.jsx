import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PrimeReactProvider } from 'primereact/api';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { MultiSelect } from 'primereact/multiselect';
import { Checkbox } from 'primereact/checkbox';
import { RadioButton } from 'primereact/radiobutton';
import { InputSwitch } from 'primereact/inputswitch';
import { SelectButton } from 'primereact/selectbutton';
import { Tag } from 'primereact/tag';
import { Message } from 'primereact/message';
import { ProgressBar } from 'primereact/progressbar';
import { Skeleton } from 'primereact/skeleton';
import { TabView, TabPanel } from 'primereact/tabview';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import '@fontsource-variable/geist';
import '@fontsource-variable/noto-sans-sc';
import '@fontsource/ibm-plex-mono/latin-400.css';
import 'primeicons/primeicons.css';
import 'primereact/resources/themes/lara-light-teal/theme.css';
import './tokens.css';
import './prototype.css';

const preferenceKey = 'cm-prototype-preference-v1';
const moduleOptions = [{ label: '图像生产', value: 'image' }, { label: 'LoRA 训练', value: 'training' }];
const themeOptions = [{ label: '系统', value: 'system' }, { label: '浅色', value: 'light' }, { label: '深色', value: 'dark' }];
const densityOptions = [{ label: '紧凑', value: 'compact' }, { label: '标准', value: 'standard' }, { label: '舒展', value: 'relaxed' }];
const sections = [['colors', '色彩与主题'], ['typography', '字体与排版'], ['dimensions', '尺寸与密度'], ['components', '基础组件'], ['feedback', '状态与反馈'], ['decisions', '确认清单']];
const colorSpecs = [
  ['canvas', '页面底色', '承托整页内容'], ['surface', '主要表面', '表单与编辑区域'],
  ['surface-secondary', '次级表面', '工具栏和分组'], ['border-control', '控件边界', '清楚标示输入区域'],
  ['text', '主要文字', '名称、内容、操作'], ['text-secondary', '次要文字', '说明与补充信息'],
  ['image', '图像生产', '青绿色模块强调'], ['training', 'LoRA 训练', '粉色模块强调'],
];
const statusSpecs = [['success', '已完成', 'pi-check-circle'], ['info', '运行中', 'pi-play-circle'], ['warning', '已暂停', 'pi-pause-circle'], ['danger', '失败', 'pi-exclamation-circle']];
const typeSpecs = [
  ['32 / 44', 'page', '让层级清晰，让内容好读。', '页面标题'],
  ['24 / 34', 'section', '当前任务与近期结果', '主要分区'],
  ['20 / 28', 'subheading', '保存之后，继续创作', '面板标题'],
  ['16 / 24', 'body-large', '用于较长说明，让阅读保持自然的节奏。', '说明正文'],
  ['14 / 22', 'body', '编辑参数、选择素材、查看状态。紧凑，但不挤。', '表单与列表'],
  ['12 / 18', 'caption', '辅助信息保持可读，不把重要内容藏进小字。', '辅助文字'],
];

function readPreference() {
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey) || '{}');
    return {
      theme: ['light', 'dark'].includes(saved.theme) ? saved.theme : 'system',
      module: saved.module === 'training' ? 'training' : 'image',
      density: ['compact', 'relaxed'].includes(saved.density) ? saved.density : 'standard',
    };
  } catch { return { theme: 'system', module: 'image', density: 'standard' }; }
}

function Section({ id, title, description, children }) {
  return <section id={id} className="design-section" aria-labelledby={`${id}-title`}>
    <div className="section-heading"><h2 id={`${id}-title`}>{title}</h2><p>{description}</p></div>
    {children}
  </section>;
}

function Specimen({ title, hint, children, className = '' }) {
  return <div className={`specimen ${className}`}><div className="specimen-heading"><h3>{title}</h3>{hint ? <span>{hint}</span> : null}</div>{children}</div>;
}

function Field({ id, label, hint, error, children }) {
  return <div className="field"><label htmlFor={id}>{label}</label>{children}
    {hint ? <small id={`${id}-hint`}>{hint}</small> : null}
    {error ? <small id={`${id}-error`} className="field-error"><i className="pi pi-exclamation-circle" aria-hidden="true" />{error}</small> : null}
  </div>;
}

function App() {
  const [preference, setPreference] = useState(readPreference);
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const [previewName, setPreviewName] = useState('基础组件样本');
  const [previewModel, setPreviewModel] = useState('标准');
  const [previewChecked, setPreviewChecked] = useState(true);
  const [savedPreview, setSavedPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [sampleText, setSampleText] = useState('保持清晰，专注创作。');
  const [amount, setAmount] = useState(4);
  const [dropdown, setDropdown] = useState('标准');
  const [multiValue, setMultiValue] = useState(['名称']);
  const [checked, setChecked] = useState(true);
  const [switchOn, setSwitchOn] = useState(true);
  const [radio, setRadio] = useState('标准');
  const [view, setView] = useState('网格');
  const [contentState, setContentState] = useState('内容');
  const [showDialog, setShowDialog] = useState(false);
  const [copied, setCopied] = useState('');
  const [colorValues, setColorValues] = useState({});
  const toast = useRef(null);
  const saveTimer = useRef(null);
  const copyTimer = useRef(null);
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
    root.dataset.density = preference.density;
    const computed = getComputedStyle(root);
    setColorValues(Object.fromEntries(colorSpecs.map(([token]) => [token, computed.getPropertyValue(`--${token}`).trim()])));
    try { localStorage.setItem(preferenceKey, JSON.stringify(preference)); } catch { /* Preview still works when storage is unavailable. */ }
  }, [preference, theme]);
  useEffect(() => () => { clearTimeout(saveTimer.current); clearTimeout(copyTimer.current); }, []);

  function updatePreference(key, value) {
    if (value) setPreference((old) => ({ ...old, [key]: value }));
  }
  async function copyToken(token) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(token);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(''), 1800);
    } catch { toast.current.show({ severity: 'info', summary: '请手动复制', detail: value, life: 4000 }); }
  }
  function submitPreview(event) {
    event.preventDefault();
    setSavedPreview(false);
    if (!previewName.trim()) { setPreviewError('请输入名称，再试一次。'); return; }
    setPreviewError(''); setSaving(true);
    saveTimer.current = setTimeout(() => { setSaving(false); setSavedPreview(true); }, 1000);
  }

  return <PrimeReactProvider value={{ ripple: false }}>
    <a className="skip-link" href="#colors">跳到设计内容</a>
    <header className="app-header">
      <a href="#colors" className="wordmark">ComfyUI <span>Manager</span></a>
      <span className="header-divider" aria-hidden="true" />
      <span className="header-context">基础设计</span>
      <span className="review-status"><span className="review-dot" />待审核</span>
      <div className="header-controls">
        <SelectButton value={preference.module} options={moduleOptions} onChange={(e) => updatePreference('module', e.value)} aria-label="模块色" allowEmpty={false} />
        <SelectButton value={preference.theme} options={themeOptions} onChange={(e) => updatePreference('theme', e.value)} aria-label="主题偏好" allowEmpty={false} />
      </div>
    </header>

    <div className="workspace">
      <aside className="design-sidebar">
        <div className="sidebar-title">设计基础</div>
        <nav aria-label="基础设计目录">{sections.map(([id, label]) => <a key={id} href={`#${id}`}>{label}<i className="pi pi-arrow-up-right" aria-hidden="true" /></a>)}</nav>
        <div className="sidebar-note"><strong>先确定基础，再组合页面。</strong><p>这一页是可操作的设计样本。具体色值与尺寸，等你看过后确认。</p><a href="./README.md">查看设计清单<i className="pi pi-arrow-up-right" aria-hidden="true" /></a></div>
        <div className="sidebar-footer">PrimeReact 10.9.9<br />Impeccable 4.2.1</div>
      </aside>

      <main>
        <div className="page-heading"><div><h1>先把基础，设计清楚。</h1><p>同一套组件，两种创作模式。调整顶部选项，直接感受它们在真实界面中的变化。</p></div><a className="text-link" href="#decisions">查看待确认项<i className="pi pi-arrow-down" aria-hidden="true" /></a></div>

        <Section id="colors" title="色彩与主题" description="中性色承托内容，模块色标识操作；成功、失败等状态使用各自的语义色。">
          <div className="color-layout">
            <div className="palette-area">
              <div className="color-grid">{colorSpecs.map(([token, title, detail]) => <button type="button" className={`color-swatch swatch-${token}`} key={token} onClick={() => copyToken(token)} aria-label={`复制${title}色值`}>
                <span className="color-chip" /><span className="swatch-label">{title}<i className={`pi ${copied === token ? 'pi-check' : 'pi-copy'}`} aria-hidden="true" /></span><span className="swatch-value mono">{colorValues[token] || '—'}</span><span className="swatch-description">{detail}</span>
              </button>)}</div>
              <div className="semantic-strip">{statusSpecs.map(([severity, label, icon]) => <Tag key={severity} severity={severity} value={label} icon={`pi ${icon}`} />)}</div>
              <p className="color-note" aria-live="polite">{copied ? '色值已复制。' : `当前${theme === 'light' ? '浅色' : '深色'}主题 · ${preference.theme === 'system' ? '实时跟随系统' : '已手动选择'}`}
                {preference.theme !== 'system' ? <button className="inline-link" onClick={() => updatePreference('theme', 'system')}>改为跟随系统</button> : null}
              </p>
            </div>
            <form className="live-preview" onSubmit={submitPreview}>
              <div className="preview-heading"><h3>组件预览</h3><span>可操作样本</span></div>
              <Field id="preview-name" label="名称" error={previewError}><InputText id="preview-name" value={previewName} onChange={(e) => { setPreviewName(e.target.value); setSavedPreview(false); }} invalid={Boolean(previewError)} aria-describedby={previewError ? 'preview-name-error' : undefined} /></Field>
              <Field id="preview-mode" label="参数方案"><Dropdown inputId="preview-mode" value={previewModel} options={['标准', '精细']} onChange={(e) => setPreviewModel(e.value)} /></Field>
              <div className="choice-row"><InputSwitch inputId="preview-auto" checked={previewChecked} onChange={(e) => setPreviewChecked(e.value)} /><label htmlFor="preview-auto">保留本次选择</label></div>
              <div className="preview-actions"><Button type="submit" label={saving ? '保存中' : '试试保存'} icon="pi pi-check" loading={saving} disabled={saving} /><Button type="button" label="重置" outlined onClick={() => { setPreviewName('基础组件样本'); setPreviewModel('标准'); setPreviewChecked(true); setPreviewError(''); setSavedPreview(false); }} disabled={saving} /></div>
              <div className="preview-feedback" aria-live="polite">{savedPreview ? <Message severity="success" text="样本已保存，仅用于交互演示。" /> : <p>清空名称可查看校验；保存可查看加载与成功反馈。</p>}</div>
            </form>
          </div>
        </Section>

        <Section id="typography" title="字体与排版" description="用清晰的无衬线字体承载界面；代码、路径和参数才使用等宽字体。">
          <div className="font-summary"><div><strong>Geist</strong><span>英文与数字</span></div><div><strong>Noto Sans SC</strong><span>中文正文与标题</span></div><div><strong className="mono">IBM Plex Mono</strong><span>代码与精确数值</span></div></div>
          <div className="type-scale">{typeSpecs.map(([measure, className, sample, purpose]) => <div className="type-row" key={className}><span className="type-measure mono">{measure}</span><span className={`type-sample type-${className}`}>{sample}</span><span className="type-purpose">{purpose}</span></div>)}</div>
          <div className="type-playground"><Field id="font-sample" label="换一句自己的文案"><InputText id="font-sample" value={sampleText} onChange={(e) => setSampleText(e.target.value)} /></Field><p className="editable-sample">{sampleText || '输入文字，查看中文与英文的混排效果。'}</p><div className="mono code-sample">seed: 284701 &nbsp; · &nbsp; 1024 × 1536 &nbsp; · &nbsp; 00:42.8</div></div>
        </Section>

        <Section id="dimensions" title="尺寸与密度" description="4px 为间距基准。组内紧凑，组间留白；用稳定尺寸适配长时间操作。">
          <div className="dimension-grid"><Specimen title="间距刻度" hint="4 / 8 / 12 / 16 / 24 / 32 / 48">
            <div className="spacing-scale">{[4, 8, 12, 16, 24, 32, 48].map((n) => <div key={n}><span className="mono">{n}</span><span className={`spacing-bar spacing-${n}`} /></div>)}</div>
          </Specimen><Specimen title="圆角与层次" hint="控件 8px · 面板 12px">
            <div className="shape-row"><div className="shape-control">8px<span>控件</span></div><div className="shape-panel">12px<span>面板</span></div><div className="shape-float">浮层<span>柔和阴影</span></div></div>
          </Specimen></div>
          <div className="density-preview"><div><h3>试试不同密度</h3><p>字号保持不变，只调整控件高度和行间距。</p></div><SelectButton value={preference.density} options={densityOptions} onChange={(e) => updatePreference('density', e.value)} allowEmpty={false} aria-label="内容密度" /><div className="density-sample"><InputText aria-label="密度预览输入" placeholder="输入名称或关键词" /><Button label="主要操作" icon="pi pi-plus" onClick={() => toast.current.show({ severity: 'info', summary: '密度样本', detail: '同一套控件随密度选择变化。', life: 2500 })} /></div></div>
        </Section>

        <Section id="components" title="基础组件" description="统一操作层级与字段状态，直接使用组件库现有能力。所有示例均可操作。">
          <Specimen title="按钮" hint="主要 / 次要 / 文字 / 危险">
            <div className="button-row"><Button label="主要操作" icon="pi pi-plus" onClick={() => toast.current.show({ severity: 'success', summary: '操作反馈', detail: '这是主要按钮的交互样本。', life: 2500 })} /><Button label="次要操作" outlined onClick={() => setShowDialog(true)} /><Button label="文字操作" text onClick={() => toast.current.show({ severity: 'info', summary: '文字按钮', detail: '适合低优先级的辅助操作。', life: 2500 })} /><Button label="删除样本" severity="danger" outlined onClick={() => setShowDialog(true)} /><Button label="不可用" disabled /><Button label="处理中" loading disabled /></div>
            <p className="spec-note">悬停与按下查看反馈；按 Tab 查看焦点。危险操作使用独立语义色。</p>
          </Specimen>
          <Specimen title="输入与校验" hint="默认 / 帮助 / 错误 / 只读 / 禁用">
            <div className="field-grid"><Field id="normal-field" label="名称" hint="简短明确，便于在列表中辨认。"><InputText id="normal-field" placeholder="请输入名称" aria-describedby="normal-field-hint" /></Field><Field id="invalid-field" label="校验错误样本" error="名称不能为空，请填写后重试。"><InputText id="invalid-field" placeholder="请输入名称" invalid aria-describedby="invalid-field-error" /></Field><Field id="readonly-field" label="只读内容" hint="只读仍可选中与复制。"><InputText id="readonly-field" value="已归档的内容" readOnly aria-describedby="readonly-field-hint" /></Field><Field id="disabled-field" label="不可编辑" hint="当前状态暂不支持修改。"><InputText id="disabled-field" value="默认参数" disabled aria-describedby="disabled-field-hint" /></Field><Field id="amount-field" label="数量"><InputNumber inputId="amount-field" value={amount} onValueChange={(e) => setAmount(e.value)} min={1} max={16} showButtons buttonLayout="horizontal" incrementButtonIcon="pi pi-plus" decrementButtonIcon="pi pi-minus" pt={{ incrementButton: { "aria-label": "增加数量" }, decrementButton: { "aria-label": "减少数量" } }} /></Field><Field id="select-field" label="单项选择"><Dropdown inputId="select-field" value={dropdown} options={['标准', '精细', '自定义']} onChange={(e) => setDropdown(e.value)} /></Field></div>
            <div className="field-grid field-grid-wide"><Field id="textarea-field" label="补充说明"><InputTextarea id="textarea-field" rows={3} placeholder="输入多行内容，查看正文、行高与边界。" autoResize /></Field><Field id="multi-field" label="多项选择" hint="搜索并选择需要显示的字段。"><MultiSelect inputId="multi-field" value={multiValue} options={['名称', '状态', '时间', '来源']} onChange={(e) => setMultiValue(e.value)} display="chip" filter placeholder="选择字段" aria-describedby="multi-field-hint" /></Field></div>
          </Specimen>
          <div className="dimension-grid"><Specimen title="选择控件" hint="明确的已选状态"><div className="selection-examples"><div className="choice-row"><Checkbox inputId="example-check" checked={checked} onChange={(e) => setChecked(e.checked)} /><label htmlFor="example-check">选中当前项</label></div><div className="choice-row"><InputSwitch inputId="example-switch" checked={switchOn} onChange={(e) => setSwitchOn(e.value)} /><label htmlFor="example-switch">开启此选项</label></div><div className="radio-row" role="group" aria-label="质量选项">{['标准', '精细'].map((option) => <div className="choice-row" key={option}><RadioButton inputId={`radio-${option}`} name="quality" value={option} checked={radio === option} onChange={(e) => setRadio(e.value)} /><label htmlFor={`radio-${option}`}>{option}</label></div>)}</div></div></Specimen><Specimen title="分段与页签" hint="同级视图切换"><SelectButton value={view} options={['网格', '列表']} onChange={(e) => { if (e.value) setView(e.value); }} allowEmpty={false} aria-label="视图样本" /><TabView><TabPanel header="参数"><p className="tab-sample">数量 <strong className="mono">{amount ?? '—'}</strong> · 方案 <strong>{dropdown}</strong></p></TabPanel><TabPanel header="说明"><p className="tab-sample">页签保留当前位置，切换同一对象的不同内容。</p></TabPanel></TabView></Specimen></div>
        </Section>

        <Section id="feedback" title="状态与反馈" description="状态带文字和图标。加载保持布局，错误说明原因并提供恢复动作。">
          <div className="feedback-grid"><Message severity="success" text="已保存，可以继续编辑。" /><Message severity="info" text="正在处理，请稍候。" /><Message severity="warn" text="部分选项尚未填写。" /><Message severity="error" text="保存失败，输入内容已保留。" /></div>
          <div className="state-workbench"><div className="state-toolbar"><h3>内容状态样本</h3><SelectButton value={contentState} options={['内容', '加载', '空内容', '失败']} onChange={(e) => { if (e.value) setContentState(e.value); }} allowEmpty={false} aria-label="内容状态" /></div>
            <div className="state-stage" aria-live="polite">
              {contentState === '内容' ? <div className="sample-row"><div className="sample-icon"><i className="pi pi-file" aria-hidden="true" /></div><div className="sample-info"><strong>基础样本</strong><span>用于比较名称、说明与状态的层级</span></div><Tag severity="success" value="已完成" icon="pi pi-check-circle" /><Button aria-label="查看样本说明" icon="pi pi-arrow-right" text onClick={() => toast.current.show({ severity: 'info', summary: '样本说明', detail: '名称、说明和操作在同一行内保持对齐。', life: 3000 })} /></div> : null}
              {contentState === '加载' ? <div className="skeleton-row" aria-label="正在加载样本" aria-busy="true"><Skeleton width="44px" height="44px" borderRadius="8px" /><div><Skeleton width="8rem" height="16px" /><Skeleton width="15rem" height="12px" /></div><Skeleton width="72px" height="24px" /></div> : null}
              {contentState === '空内容' ? <div className="empty-sample"><i className="pi pi-folder-open" aria-hidden="true" /><div><strong>还没有内容</strong><p>创建一个样本，开始查看布局效果。</p></div><Button label="创建样本" icon="pi pi-plus" outlined onClick={() => setContentState('内容')} /></div> : null}
              {contentState === '失败' ? <div className="empty-sample error-sample"><i className="pi pi-exclamation-circle" aria-hidden="true" /><div><strong>内容暂时无法加载</strong><p>当前选择已保留，可以重新尝试。</p></div><Button label="重试" icon="pi pi-refresh" outlined onClick={() => setContentState('内容')} /></div> : null}
            </div>
          </div>
          <div className="progress-sample"><label htmlFor="progress-demo">进度样本 <span className="mono">64%</span></label><ProgressBar id="progress-demo" value={64} showValue={false} aria-label="样本进度" /><p>进度表示过程；模块色不替代完成与失败状态。</p></div>
        </Section>

        <Section id="decisions" title="这轮先确认这些" description="方向已有依据，具体数值仍可调整。确认基础后，再扩展导航外壳和业务组合。">
          <div className="decision-table"><div><span>F-01～F-03</span><strong>主题、模块色与语义色</strong><p>明暗同等支持；青绿与粉色保持同等权重。</p></div><div><span>F-04～F-07</span><strong>字体、间距与基础尺寸</strong><p>14px 正文、4px 间距基准、8px / 12px 圆角。</p></div><div><span>F-08～F-12</span><strong>控件与状态</strong><p>操作层级清晰；字段、焦点、加载与错误保持一致。</p></div><div><span>F-13～F-14</span><strong>主题操作与交互适配</strong><p>实时跟随系统；小屏重排，触摸目标至少 44px。</p></div></div>
          <div className="next-step"><p>你可以按编号提出调整，例如“F-04 字体换成另一种”或“F-07 控件再紧凑一点”。</p><a className="text-link" href="./README.md">打开完整设计清单<i className="pi pi-arrow-up-right" aria-hidden="true" /></a></div>
        </Section>
        <footer className="page-footer"><span>ComfyUI Manager · 基础设计原型</span><span>仅示例数据 · 尚未接入业务接口</span></footer>
      </main>
    </div>
    <Dialog header="确认操作样本" visible={showDialog} onHide={() => setShowDialog(false)} className="sample-dialog" draggable={false} footer={<><Button label="取消" outlined onClick={() => setShowDialog(false)} /><Button label="确认示例" severity="danger" onClick={() => { setShowDialog(false); toast.current.show({ severity: 'info', summary: '示例已确认', detail: '没有修改或删除任何业务数据。', life: 3000 }); }} /></>}>
      <p>确认框应写清操作对象和影响范围。这是交互演示，不会删除任何内容。</p>
    </Dialog>
    <Toast ref={toast} position="bottom-right" />
  </PrimeReactProvider>;
}

createRoot(document.getElementById('root')).render(<App />);
