"use client";

import Link from "next/link";
import { Copy, GripVertical, Plus, Save, SlidersHorizontal, Trash2 } from "lucide-react";

import type { DemoTemplate } from "../../data";
import { demoHref } from "../../routing";
import type { DemoTemplateSection } from "../../routing";
import s from "./template-form-page.library.module.css";
import { Button } from "../../shared/primitives/button";
import { ButtonLink } from "../../shared/primitives/button";
import { Field } from "../../shared/primitives/field";
import { OperationStateStrip } from "../../shared/feedback/operation-state-strip";
import { PageHeader } from "../../shared/primitives/page-header";
import { StatusBadge } from "../../shared/primitives/status-badge";
import { TextAreaField } from "../../shared/primitives/text-area-field";
import { TemplateSectionShell, templateSectionAnchorId } from "./template-section-shell";

export function TemplateFormPage({ template, mode }: { template?: DemoTemplate; mode: "new" | "edit" }) {
  const sections = template?.sections ?? [];
  const content = (
    <div className={s.editorSurface}>
      <section className={s.editorBlock}>
        <div className={s.editorBlockHeader}>
          <div>
            <strong>模板信息</strong>
            <span>{mode === "new" ? "先填写模板信息，再配置小节。" : "右侧小节导航同步当前列表。"}</span>
          </div>
          <StatusBadge status={mode === "new" ? "queued" : "ready"} label={mode === "new" ? "草稿" : "已保存"} />
        </div>
        <div className={s.formGrid}>
          <Field label="名称" value={template?.name ?? "新项目模板"} />
          <TextAreaField label="描述" value={template?.description || "记录模板用途、默认预设绑定和生成流程。"} />
        </div>
      </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>小节配置</strong>
                <span>排序、复制、删除，点击行进入小节编辑。</span>
          </div>
          <Button icon={Plus} feedback={{ title: "小节草稿已添加" }}>添加小节</Button>
        </div>
            <div className={s.templateSectionList}>
              {sections.length ? (
            sections.map((section, index) => (
              <TemplateSectionRow
                index={index}
                key={section.id}
                section={section}
                template={template}
              />
            ))
          ) : (
            <div className={s.empty}>创建模板后可以添加第一个小节</div>
              )}
            </div>
            <OperationStateStrip
              items={[
                { label: "排序", value: "拖拽释放后保存", tone: "info" },
                { label: "保存队列", value: mode === "new" ? "待创建" : "空", tone: mode === "new" ? "warning" : "success" },
                { label: "错误", value: "0", tone: "success" },
              ]}
            />
          </section>
    </div>
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

export function TemplateSectionRow({
  index,
  section,
  template,
}: {
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
      <Button className={s.dragHandle} tone="subtle" icon={GripVertical} iconOnly ariaLabel="排序手柄" />
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
