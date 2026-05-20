"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, GripVertical, Plus, Save, SlidersHorizontal, Trash2 } from "lucide-react";

import type { DemoData, DemoTemplate } from "../../data";
import { demoHref } from "../../routing";
import type { DemoTemplateSection } from "../../routing";
import s from "./template-form-page.library.module.css";
import { Button } from "../../shared/primitives/button";
import { ButtonLink } from "../../shared/primitives/button";
import { Field } from "../../shared/primitives/field";
import { OperationStateStrip } from "../../shared/feedback/operation-state-strip";
import { EditorBlock, WorkbenchSurface } from "../../shared/patterns";
import { PageHeader } from "../../shared/primitives/page-header";
import { FloatingSelect } from "../../shared/primitives/floating-select";
import { StatusBadge } from "../../shared/primitives/status-badge";
import { TemplateSectionShell, templateSectionAnchorId } from "./template-section-shell";
import { SortableList, useDemoSortable } from "../../shared/primitives/sortable";

export function TemplateFormPage({ template, mode, data }: { template?: DemoTemplate; mode: "new" | "edit"; data?: DemoData }) {
  const sections = template?.sections ?? [];
  const content = (
    <WorkbenchSurface className={s.editorSurface}>
      <EditorBlock
        actions={<StatusBadge status={mode === "new" ? "queued" : "ready"} label={mode === "new" ? "草稿" : "已保存"} />}
        className={s.editorBlock}
        contentClassName={s.formGrid}
        description={mode === "new" ? "先填写模板信息，再配置小节。" : "右侧小节导航同步当前列表。"}
        headerClassName={s.editorBlockHeader}
        title="模板信息"
      >
        <Field label="名称" value={template?.name ?? "新项目模板"} />
        <Field multiline features={{ resize: true, clipboard: true }} label="描述" value={template?.description || "记录模板用途、默认预设绑定和生成流程。"} />
        {data ? <FloatingSelect label="默认 Checkpoint" value="继承系统默认" options={["继承系统默认", ...data.models.filter(m => m.modelType === "checkpoint").map(c => c.name)]} /> : null}
      </EditorBlock>

      <EditorBlock
        actions={<Button icon={Plus} feedback={{ title: "小节草稿已添加" }}>添加小节</Button>}
        className={s.editorBlock}
        contentClassName={s.sectionBlockContent}
        description="排序、复制、删除，点击行进入小节编辑。"
        headerClassName={s.editorBlockHeader}
        title="小节配置"
      >
        <SortableSectionList sections={sections} template={template} />
        <OperationStateStrip
          items={[
            { label: "排序", value: "拖拽释放后保存", tone: "info" },
            { label: "保存队列", value: mode === "new" ? "待创建" : "空", tone: mode === "new" ? "warning" : "success" },
            { label: "错误", value: "0", tone: "success" },
          ]}
        />
      </EditorBlock>
    </WorkbenchSurface>
  );

  if (mode === "edit" && template) {
    return (
      <div className={s.page}>
        <PageHeader
          back={{ href: "/templates", label: "返回模板列表" }}
          eyebrow="模板"
          title={template.name}
          subtitle={`${template.sectionCount} 个小节`}
          actions={
            <Button icon={Plus} feedback={{ title: "小节草稿已添加", detail: template.name }}>添加小节</Button>
          }
        />
        <TemplateSectionShell template={template} mode="template-edit">
          {content}
        </TemplateSectionShell>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/templates", label: "返回模板列表" }}
        eyebrow="模板"
        title="新建项目模板"
        subtitle="先填写模板信息，再添加可复用的小节配置。"
        actions={<Button tone="primary" icon={Save} feedback={{ title: "模板创建已排队" }}>创建模板</Button>}
      />
      {content}
    </div>
  );
}

function SortableSectionList({ sections, template }: { sections: DemoTemplateSection[]; template?: DemoTemplate }) {
  const [orderedIds, setOrderedIds] = useState(() => sections.map((sec) => sec.id));
  const sectionMap = Object.fromEntries(sections.map((sec) => [sec.id, sec]));

  if (!sections.length) {
    return (
      <div className={s.templateSectionList}>
        <div className={s.empty}>创建模板后可以添加第一个小节</div>
      </div>
    );
  }

  return (
    <div className={s.templateSectionList}>
      <SortableList items={orderedIds} onReorder={setOrderedIds}>
        {orderedIds.map((id, index) => {
          const section = sectionMap[id];
          if (!section) return null;
          return (
            <SortableSectionRow key={id} index={index} section={section} template={template} />
          );
        })}
      </SortableList>
    </div>
  );
}

function SortableSectionRow({ index, section, template }: { index: number; section: DemoTemplateSection; template?: DemoTemplate }) {
  const { ref, style, handleProps } = useDemoSortable(section.id);
  return (
    <div ref={ref} style={style}>
      <TemplateSectionRow index={index} section={section} template={template} handleProps={handleProps} />
    </div>
  );
}

export function TemplateSectionRow({
  handleProps,
  index,
  section,
  template,
}: {
  handleProps?: Record<string, unknown>;
  index: number;
  section: DemoTemplateSection;
  template?: DemoTemplate;
}) {
  const href = template ? `/templates/${template.id}/sections/${index}` : "/templates/new";

  return (
    <article
      className={s.templateSectionRow}
      data-section-card={section.id}
      id={templateSectionAnchorId(section)}
    >
      <button
        type="button"
        className={s.dragHandle}
        aria-label="排序手柄"
        style={{ cursor: handleProps ? "grab" : undefined }}
        {...(handleProps ?? {})}
      >
        <GripVertical aria-hidden="true" />
      </button>
      <Link className={s.templateSectionRowMain} href={demoHref(href)}>
        <span className={s.templateSectionTitleLine}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{section.name || "未命名小节"}</strong>
        </span>
        <p>{section.notes || "继承模板默认备注"}</p>
        <div className={s.sectionMetaGrid}>
          <span>{section.aspectRatio}</span>
          <span>批量 {section.batchSize}</span>
          <span>KSampler 继承</span>
          <span>Prompt / LoRA</span>
        </div>
      </Link>
      <div className={s.templateSectionRowActions}>
        <ButtonLink href={href} icon={SlidersHorizontal}>编辑</ButtonLink>
        <Button tone="subtle" icon={Copy} feedback={{ title: "模板小节已复制", detail: section.name }}>复制</Button>
        <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "删除小节需要确认", detail: section.name }}>删除</Button>
      </div>
    </article>
  );
}
