"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, CopyPlus, Edit3, GripVertical, Plus, Save, Shuffle, Trash2 } from "lucide-react";

import type { DemoData } from "../../data";
import { cx, demoHref } from "../../routing";
import { Button, ButtonLink } from "../../shared/primitives/button";
import { EmptyPage } from "../../shared/primitives/empty-page";
import { Field } from "../../shared/primitives/field";
import { FloatingSelect } from "../../shared/primitives/floating-select";
import { PageHeader } from "../../shared/primitives/page-header";
import { Panel } from "../../shared/primitives/panel";
import { StatusBadge } from "../../shared/primitives/status-badge";
import { buildLoraTrainingDemoData } from "./fixtures";
import type { LoraTrainingPreset, LoraTrainingSectionBlock, LoraTrainingTemplate } from "./types";
import s from "./training-resource-pages.module.css";

function presetStatus(preset: LoraTrainingPreset) {
  return preset.status === "active" ? <StatusBadge status="ready" label="启用" /> : <StatusBadge status="archived" label="停用" />;
}

function findPreset(data: DemoData, presetId?: string) {
  const training = buildLoraTrainingDemoData(data);
  return training.presets.find((preset) => preset.id === presetId) ?? training.presets[0];
}

function findTemplate(data: DemoData, templateId?: string) {
  const training = buildLoraTrainingDemoData(data);
  return training.templates.find((template) => template.id === templateId) ?? training.templates[0];
}

function TemplateSceneBlockCard({
  block,
  index,
  total,
}: {
  block: LoraTrainingSectionBlock;
  index: number;
  total: number;
}) {
  return (
    <article className={s.templateSceneBlockCard}>
      <div className={s.templateSceneBlockBody}>
        <span>{block.source === "预制" ? "预制块" : "本地块"}</span>
        <strong>{block.title}</strong>
        <p>{block.text}</p>
      </div>
      <div className={s.templateSceneBlockActions} aria-label={`${block.title} 操作`}>
        <Button size="sm" icon={Edit3} ariaLabel={`编辑模板场景块：${block.title}`} feedback={{ title: "编辑模板场景块入口已预览", detail: block.title }}>编辑</Button>
        <Button size="sm" icon={ArrowUp} disabled={index === 0} ariaLabel={`上移模板场景块：${block.title}`} feedback={{ title: "模板块排序已预览", detail: `上移 ${block.title}` }}>上移</Button>
        <Button size="sm" icon={ArrowDown} disabled={index === total - 1} ariaLabel={`下移模板场景块：${block.title}`} feedback={{ title: "模板块排序已预览", detail: `下移 ${block.title}` }}>下移</Button>
        <Button size="sm" icon={Trash2} tone="danger" ariaLabel={`删除模板场景块：${block.title}`} feedback={{ tone: "warning", title: "删除模板场景块需要确认", detail: block.title }}>删除</Button>
      </div>
    </article>
  );
}

export function LoraTrainingPresetsPage({ data }: { data: DemoData }) {
  const training = buildLoraTrainingDemoData(data);
  const categories = [...new Set(training.presets.map((preset) => preset.category))];

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="LoRA 训练"
        title="训练预制"
        subtitle="训练预制只是一段 scene description，不包含普通预设库的 variants / positive / negative / LoRA 结构。"
        actions={(
          <>
            <ButtonLink href="/training/presets/sort-rules" icon={Shuffle}>排序规则</ButtonLink>
            <Button icon={Plus} tone="primary" feedback={{ title: "新建训练预制入口已预览" }}>新建</Button>
          </>
        )}
      />
      <div className={s.resourceLayout}>
        <aside className={s.resourceRail}>
          <strong>分类</strong>
          {categories.map((category, index) => (
            <button className={cx(index === 0 && s.railItemActive)} type="button" key={category}>
              <span>{category}</span>
              <em>{training.presets.filter((preset) => preset.category === category).length}</em>
            </button>
          ))}
        </aside>
        <section className={s.resourceWorkspace}>
          <div className={s.resourceGrid}>
            {training.presets.map((preset, index) => (
              <Link className={s.resourceRow} href={demoHref(`/training/presets/${preset.id}`)} key={preset.id}>
                <GripVertical className={s.grip} aria-hidden="true" />
                <div>
                  <strong>{preset.title}</strong>
                  <span>{String(index + 1).padStart(2, "0")} · {preset.category} / {preset.folder} · 更新 {preset.updatedAt}</span>
                  <p>{preset.sceneDescriptionText}</p>
                </div>
                {presetStatus(preset)}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function LoraTrainingPresetDetailPage({ data, presetId }: { data: DemoData; presetId?: string }) {
  const preset = findPreset(data, presetId);
  if (!preset) return <EmptyPage title="没有训练预制数据" />;

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/training/presets", label: "返回训练预制" }}
        eyebrow="训练预制"
        title={preset.title}
        subtitle={`${preset.category} / ${preset.folder} · 更新 ${preset.updatedAt}`}
        actions={<Button tone="primary" icon={Save} feedback={{ title: "训练预制已保存", detail: preset.title }}>保存</Button>}
      />
      <div className={s.twoCol}>
        <Panel title="预制内容" subtitle="训练预制只维护 sceneDescriptionText。">
          <div className={s.stack}>
            <Field label="名称" value={preset.title} />
            <FloatingSelect label="分类" value={preset.category} options={[preset.category, "光线", "环境", "构图"]} />
            <FloatingSelect label="文件夹" value={preset.folder} options={[preset.folder, "舞台", "城市", "训练净图"]} />
            <Field multiline features={{ resize: true, clipboard: true }} label="场景描述" value={preset.sceneDescriptionText} />
          </div>
        </Panel>
        <Panel title="删除影响" subtitle="删除前需要展示项目侧和模板侧引用，确认后只移除 mutable refs。">
          <div className={s.usageList}>
            {[...preset.projectUsage, ...preset.templateUsage].map((usage) => (
              <div className={s.usageRow} key={usage}>
                <strong>{usage}</strong>
                <span>引用当前 scene block</span>
              </div>
            ))}
            {preset.projectUsage.length + preset.templateUsage.length === 0 ? <div className={s.emptyInline}>没有引用</div> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function LoraTrainingPresetSortRulesPage({ data }: { data: DemoData }) {
  const training = buildLoraTrainingDemoData(data);
  const categories = [...new Set(training.presets.map((preset) => preset.category))];

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/training/presets", label: "返回训练预制" }}
        eyebrow="训练预制"
        title="排序规则"
        subtitle="管理合成顺序和分类内顺序；训练预制没有普通预设库的正反向维度。"
        actions={<Button tone="primary" icon={Save} feedback="排序规则已保存">保存全部</Button>}
      />
      <div className={s.sortGrid}>
        <Panel title="合成顺序">
          <div className={s.usageList}>
            {categories.map((category, index) => (
              <div className={s.sortRow} key={category}>
                <GripVertical className={s.grip} aria-hidden="true" />
                <strong>{String(index + 1).padStart(2, "0")} · {category}</strong>
                <span>{training.presets.filter((preset) => preset.category === category).length} 个预制</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="分类内顺序">
          <div className={s.usageList}>
            {training.presets.map((preset, index) => (
              <div className={s.sortRow} key={preset.id}>
                <GripVertical className={s.grip} aria-hidden="true" />
                <strong>{String(index + 1).padStart(2, "0")} · {preset.title}</strong>
                <span>{preset.category} / {preset.folder}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function templateStatus(template: LoraTrainingTemplate) {
  return template.status === "active" ? <StatusBadge status="ready" label="可用" /> : <StatusBadge status="archived" label="归档" />;
}

export function LoraTrainingTemplatesPage({ data }: { data: DemoData }) {
  const training = buildLoraTrainingDemoData(data);

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="LoRA 训练"
        title="训练模板"
        subtitle="模板是创建训练项目的一次性 seed；创建项目后不会 live 回写模板。"
        actions={(
          <>
            <ButtonLink href="/training/projects/new" icon={CopyPlus}>从模板创建项目</ButtonLink>
            <ButtonLink href="/training/templates/new" tone="primary" icon={Plus}>新建模板</ButtonLink>
          </>
        )}
      />
      <div className={s.resourceGrid}>
        {training.templates.map((template) => (
          <article className={s.templateRow} key={template.id}>
            <div>
              <Link href={demoHref(`/training/templates/${template.id}/edit`)}>
                <strong>{template.title}</strong>
              </Link>
              <span>{template.description}</span>
              <div className={s.templateSections}>
                {template.sections.map((section, index) => (
                  <Link href={demoHref(`/training/templates/${template.id}/sections/${index}`)} key={section.id}>
                    {String(index + 1).padStart(2, "0")} · {section.title}
                  </Link>
                ))}
              </div>
            </div>
            <div className={s.templateMeta}>
              {templateStatus(template)}
              <StatusBadge status="template" label={`${template.sectionCount} 小节`} />
              <ButtonLink href={`/training/templates/${template.id}/edit`} icon={Edit3}>编辑</ButtonLink>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function LoraTrainingTemplateFormPage({ data, mode, templateId }: { data: DemoData; mode: "new" | "edit"; templateId?: string }) {
  const template = mode === "edit" ? findTemplate(data, templateId) : undefined;
  const title = mode === "new" ? "新建训练模板" : template?.title ?? "训练模板";

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/training/templates", label: "返回训练模板" }}
        eyebrow="训练模板"
        title={title}
        subtitle="编辑 project-level guidance、section settings、preset/local blocks。"
        actions={<Button tone="primary" icon={Save} feedback={{ title: mode === "new" ? "训练模板已创建" : "训练模板已保存" }}>{mode === "new" ? "创建模板" : "保存模板"}</Button>}
      />
      <div className={s.twoCol}>
        <Panel title="模板信息">
          <div className={s.stack}>
            <Field label="名称" value={template?.title ?? "新角色 LoRA 模板"} />
            <Field multiline features={{ resize: true, clipboard: true }} label="描述" value={template?.description ?? "用于新角色 LoRA 训练项目的起始模板。"} />
            <Field multiline features={{ resize: true, clipboard: true }} label="图片提示词指引" value="每次生成 1 张干净训练图，优先保证角色身份稳定、轮廓清晰。" />
            <Field multiline features={{ resize: true, clipboard: true }} label="Caption 生成指引" value="先写 LoRA 触发词，再补充姿态、服装、光线、镜头和背景。" />
          </div>
        </Panel>
        <Panel title="小节配置" actions={<Button icon={Plus} feedback="小节草稿已添加">添加小节</Button>}>
          <div className={s.usageList}>
            {(template?.sections ?? buildLoraTrainingDemoData(data).templates[0]?.sections ?? []).map((section, index) => (
              <Link className={s.usageRow} href={demoHref(`/training/templates/${template?.id ?? "new-template"}/sections/${index}`)} key={section.id}>
                <strong>{section.title}</strong>
                <span>{section.blockCount} 个场景块 · {section.scenePreview}</span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function LoraTrainingTemplateSectionPage({ data, templateId, sectionIndex }: { data: DemoData; templateId?: string; sectionIndex?: string }) {
  const template = findTemplate(data, templateId);
  const index = Number(sectionIndex ?? "0");
  const section = template?.sections[Number.isFinite(index) ? index : 0] ?? template?.sections[0];
  if (!template || !section) return <EmptyPage title="没有模板小节数据" />;

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: `/training/templates/${template.id}/edit`, label: "返回模板" }}
        eyebrow="模板小节"
        title={`${template.title} / ${section.title}`}
        subtitle="模板小节与项目小节保持相同的场景块编辑心智。"
        actions={<Button tone="primary" icon={Save} feedback={{ title: "模板小节已保存", detail: section.title }}>保存小节</Button>}
      />
      <div className={s.twoCol}>
        <Panel title="运行参数">
          <div className={s.stack}>
            <Field label="小节名" value={section.title} />
            <FloatingSelect label="启用状态" value={section.enabled ? "启用" : "停用"} options={["启用", "停用"]} />
            <Field label="场景块数量" value={section.blockCount} />
          </div>
        </Panel>
        <Panel
          title="场景块"
          subtitle="模板导入项目时会复制这些块；预制块保持引用，本地块复制文本。"
          actions={(
            <>
              <Button size="sm" icon={CopyPlus} feedback={{ title: "导入预制入口已预览", detail: section.title }}>导入预制</Button>
              <Button size="sm" icon={Plus} feedback={{ title: "添加本地块入口已预览", detail: section.title }}>添加本地块</Button>
            </>
          )}
        >
          <div className={s.templateSceneBlockList}>
            {section.blocks.map((block, blockIndex) => (
              <TemplateSceneBlockCard block={block} index={blockIndex} key={block.id} total={section.blocks.length} />
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="合成预览" subtitle="模板小节保存的是可读业务文案，导入项目后仍可继续改。">
        <div className={s.templateResolvedPreview}>
          <Field readOnly multiline features={{ clipboard: true }} label="合成场景描述" value={section.resolvedScene} />
          <Field readOnly multiline features={{ clipboard: true }} label="小节摘要" value={section.scenePreview} />
        </div>
      </Panel>
    </div>
  );
}
