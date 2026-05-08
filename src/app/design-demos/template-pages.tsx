"use client";

import Link from "next/link";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import type * as React from "react";
import { ArrowLeft, ArrowRight, Copy, Download, Edit3, GripVertical, Layers3, Plus, Rows3, Save, SlidersHorizontal, Trash2 } from "lucide-react";

import type { DemoData, DemoTemplate } from "./design-demo-data";
import s from "./design-demo-styles";
import { Button, ButtonLink, EmptyPage, Field, OperationStateStrip, PageHeader, SelectLike, StatusBadge, TextAreaField } from "./design-demo-ui";
import { cx, demoHref } from "./design-demo-utils";
import type { DemoTemplateSection, TemplateSectionMode } from "./design-demo-utils";
export function TemplatesPage({ data }: { data: DemoData }) {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="模板"
        title="项目模板"
        subtitle="管理可复用的小节结构、默认参数和预设导入配置。"
        actions={<ButtonLink href="/templates/new" tone="primary" icon={Plus}>新建模板</ButtonLink>}
      />
      <div className={s.rowList}>
        {data.templates.map((template) => (
          <article className={s.templateListItem} key={template.id}>
            <div className={s.templateListMain}>
              <div className={s.templateListTitle}>
                <Link href={demoHref(`/templates/${template.id}/edit`)}>
                  <Layers3 className={s.icon} />
                  <strong>{template.name}</strong>
                </Link>
                <span>{template.description || "未填写描述"}</span>
              </div>
              <div className={s.templateSectionSummary}>
                {template.sections.slice(0, 5).map((section, index) => (
                  <Link href={demoHref(`/templates/${template.id}/sections/${index}`)} key={section.id}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {section.name}
                  </Link>
                ))}
                {template.sections.length > 5 ? <em>+{template.sections.length - 5}</em> : null}
              </div>
            </div>
            <div className={s.templateListMeta}>
              <span className={s.badge}>{template.sectionCount} 小节</span>
              <span className={s.badge}>更新 {template.updatedAt}</span>
              <div className={s.toolbar}>
                <ButtonLink href={`/templates/${template.id}/edit`} icon={Edit3}>编辑</ButtonLink>
                <Button tone="danger" icon={Trash2}>删除</Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

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
        <div className={s.fieldGrid}>
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

function TemplateSectionRow({
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
      <button className={s.dragHandle} type="button" aria-label="排序手柄">
        <GripVertical className={s.icon} />
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

export function TemplateSectionPage({ template, sectionIndex }: { template: DemoTemplate | undefined; sectionIndex: string | undefined }) {
  const index = Number(sectionIndex ?? "0");
  const safeIndex = Number.isFinite(index) ? index : 0;
  const section = template?.sections[safeIndex] ?? template?.sections[0];
  if (!template || !section) return <EmptyPage title="没有模板小节" />;
  const currentIndex = template.sections.findIndex((item) => item.id === section.id);
  const previousSection = currentIndex > 0 ? template.sections[currentIndex - 1] : null;
  const nextSection = currentIndex >= 0 && currentIndex < template.sections.length - 1 ? template.sections[currentIndex + 1] : null;
  const promptBlocks = [
    { label: "主体", positive: `${section.name} 正向提示词`, negative: "低质量、模糊" },
    { label: "风格", positive: section.notes || `${template.name} 风格提示词`, negative: "结构错误、多余手指" },
  ];

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: `/templates/${template.id}/edit`, label: "返回模板" }}
        eyebrow="模板小节"
        title={`${template.name} / ${section.name}`}
        subtitle="连续编辑参数、导入绑定、Prompt Blocks 与 LoRA 模板。"
        actions={
          <>
            <Button icon={Copy} feedback={{ title: "模板小节已复制", detail: section.name }}>复制小节</Button>
            <Button tone="primary" icon={Save} feedback={{ title: "模板小节已保存", detail: section.name }}>已保存</Button>
          </>
        }
      />
      <TemplateSectionShell activeSection={section} template={template} mode="template-section">
        <div className={s.editorSurface}>
          <div className={s.editorStickyHeader} data-section-card={section.id} id={templateSectionAnchorId(section)}>
            <div className={s.editorIdentity}>
              <span>#{String(currentIndex + 1).padStart(2, "0")}</span>
              <strong>{section.name}</strong>
              <em>{section.aspectRatio} · 批量 {section.batchSize} · 模板小节</em>
            </div>
            <div className={s.toolbar}>
              {previousSection ? (
                <ButtonLink href={`/templates/${template.id}/sections/${currentIndex - 1}`} tone="subtle" icon={ArrowLeft}>
                  上一节
                </ButtonLink>
              ) : null}
              {nextSection ? (
                <ButtonLink href={`/templates/${template.id}/sections/${currentIndex + 1}`} tone="subtle" icon={ArrowRight}>
                  下一节
                </ButtonLink>
              ) : null}
            </div>
          </div>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>运行参数</strong>
                <span>空值表示导入到项目时不覆盖项目默认参数。</span>
              </div>
              <StatusBadge status="ready" label="已保存" />
            </div>
            <div className={s.fieldGrid}>
              <Field label="小节名" value={section.name} />
              <SelectLike label="比例" value={section.aspectRatio} />
              <Field label="短边像素" value={768} />
              <Field label="批量数" value={section.batchSize} />
              <SelectLike label="Checkpoint" value="继承模板默认" />
              <SelectLike label="Upscale" value="2x / 可清除" />
            </div>
            <div className={s.editorStatusStrip}>
              <span>KSampler 1: 28 steps · CFG 7</span>
              <span>KSampler 2: 18 steps · CFG 5.5</span>
              <span>已保存</span>
            </div>
            <OperationStateStrip
              items={[
                { label: "节流保存", value: "800ms", tone: "info" },
                { label: "保存队列", value: "空", tone: "success" },
                { label: "校验", value: "通过", tone: "success" },
              ]}
            />
          </section>

          <section className={s.editorSplitBlock}>
            <div className={s.editorBlock}>
              <div className={s.editorBlockHeader}>
                <div>
                  <strong>预设绑定</strong>
                  <span>绑定可切换 variant，也可只删除当前小节中的导入内容。</span>
                </div>
                <Button icon={Download} feedback={{ title: "导入预设面板已准备" }}>导入预设</Button>
              </div>
              <div className={s.bindingList}>
                {["角色", "风格", "场景"].map((name, bindingIndex) => (
                  <div className={s.bindingRow} key={name}>
                    <div>
                      <strong>{name} · {bindingIndex === 0 ? section.name : template.name}</strong>
                      <span>{bindingIndex + 1} 个 prompt block · {bindingIndex + 1} 个 LoRA</span>
                    </div>
                    <SelectLike label="变体" value={bindingIndex === 0 ? "默认" : "继承"} />
                    <Button tone="subtle" icon={Trash2} feedback={{ tone: "warning", title: "绑定移除已排队", detail: name }}>移除</Button>
                  </div>
                ))}
              </div>
            </div>
            <aside className={s.editorAside}>
              <strong>继承预览</strong>
              <div className={s.historyDiffList}>
                <div className={s.historyDiffRow}>
                  <strong>导入到项目</strong>
                  <span>复制小节结构、Prompt Blocks、LoRA 与参数空值。</span>
                </div>
                <div className={s.historyDiffRow}>
                  <strong>项目覆盖</strong>
                  <span>项目默认 checkpoint 和尺寸参数可继续覆盖模板空值。</span>
                </div>
              </div>
              <ButtonLink href={`/templates/${template.id}/edit`} icon={Rows3}>回到小节列表</ButtonLink>
            </aside>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>Prompt Blocks</strong>
                <span>模板使用和项目小节一致的 block 结构。</span>
              </div>
              <Button icon={Plus} feedback={{ title: "Prompt Block 已添加" }}>添加 Block</Button>
            </div>
            <div className={s.promptBlockList}>
              {promptBlocks.map((block, blockIndex) => (
                <div className={s.promptBlockRow} key={block.label}>
                  <button className={s.dragHandle} type="button" aria-label="排序手柄">
                    <GripVertical className={s.icon} />
                  </button>
                  <div className={s.promptBlockContent}>
                    <div className={s.promptBlockTitle}>
                      <strong>{String(blockIndex + 1).padStart(2, "0")} · {block.label}</strong>
                      <span>template block</span>
                    </div>
                    <div className={s.promptColumns}>
                      <TextAreaField label="正向" value={block.positive} />
                      <TextAreaField label="反向" value={block.negative} />
                    </div>
                  </div>
                  <Button tone="subtle" icon={Trash2}>删除</Button>
                </div>
              ))}
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>LoRA 模板</strong>
                <span>阶段 1 / 阶段 2 与项目小节保持同样的配置密度。</span>
              </div>
              <Button icon={Plus}>添加 LoRA</Button>
            </div>
            <div className={s.loraStageGrid}>
              {["LoRA 1", "LoRA 2"].map((stage, stageIndex) => (
                <div className={s.loraStage} key={stage}>
                  <strong>{stage}</strong>
                  {[0, 1].map((itemIndex) => (
                    <div className={s.loraRow} key={`${stage}-${itemIndex}`}>
                      <span>{stageIndex === 0 ? section.name : template.name}</span>
                      <em>weight {(0.7 + itemIndex * 0.1).toFixed(2)}</em>
                      <button type="button">触发词</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>导入预设</strong>
                <span>分类、文件夹、预设组和变体选择保持在同一个导入面板。</span>
              </div>
              <Button tone="primary" icon={Plus}>追加到模板</Button>
            </div>
            <div className={s.importPresetLayout}>
              <div className={s.importCategoryColumn}>
                {["角色", "风格", "姿势", "场景"].map((name, categoryIndex) => (
                  <button className={categoryIndex === 0 ? s.importCategoryActive : ""} type="button" key={name}>
                    {name}
                  </button>
                ))}
              </div>
              <div className={s.importPresetColumn}>
                <div className={s.presetContextBar}>
                  <span className={s.badge}>根目录 / 模板候选</span>
                  <span className={s.badge}>2 个变体可用</span>
                </div>
                {["中野三玖校服", "二次元默认", "放学后教室"].map((name, presetIndex) => (
                  <div className={s.contentRow} key={name}>
                    <div className={s.contentRowHeader}>
                      <div className={s.contentRowTitle}>
                        <strong>{name}</strong>
                        <span>{presetIndex + 2} variants · prompt + LoRA</span>
                      </div>
                      <Button tone="subtle" icon={Plus}>选择</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>变更历史</strong>
                <span>模板小节按参数、Prompt、LoRA 维度记录 diff。</span>
              </div>
            </div>
            <div className={s.historyDiffList}>
              {["运行参数", "Prompt", "LoRA"].map((name, historyIndex) => (
                <div className={s.historyDiffRow} key={name}>
                  <strong>{name}</strong>
                  <span>{historyIndex === 0 ? "批量 1 → 2" : historyIndex === 1 ? "追加主体 block" : "LoRA 权重 0.60 → 0.70"}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </TemplateSectionShell>
    </div>
  );
}

function templateSectionAnchorId(section: DemoTemplateSection) {
  return `template-section-${section.id}`;
}

function templateSectionHref(template: DemoTemplate, section: DemoTemplateSection, index: number, mode: TemplateSectionMode) {
  if (mode === "template-edit") return `${demoHref(`/templates/${template.id}/edit`)}#${templateSectionAnchorId(section)}`;
  return demoHref(`/templates/${template.id}/sections/${index}`);
}

function TemplateSectionShell({
  activeSection,
  children,
  mode,
  template,
}: {
  activeSection?: DemoTemplateSection;
  children: React.ReactNode;
  mode: TemplateSectionMode;
  template: DemoTemplate;
}) {
  const defaultActiveSectionId = activeSection?.id ?? template.sections[0]?.id ?? null;
  const [activeSectionState, setActiveSectionState] = useState({
    templateId: template.id,
    sectionId: defaultActiveSectionId,
  });
  const activeSectionId = activeSectionState.templateId === template.id ? activeSectionState.sectionId : defaultActiveSectionId;
  const displayedActiveSectionId = mode === "template-section" && activeSection ? activeSection.id : activeSectionId;
  const contentRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const syncSourceRef = useRef<"content" | "rail" | null>(null);
  const unlockTimerRef = useRef<number | null>(null);

  const syncScroll = useCallback((source: "content" | "rail", targetTop: number) => {
    syncSourceRef.current = source;
    const target = source === "content" ? railRef.current : contentRef.current;
    if (target) target.scrollTop = targetTop;
    if (unlockTimerRef.current !== null) window.clearTimeout(unlockTimerRef.current);
    unlockTimerRef.current = window.setTimeout(() => {
      syncSourceRef.current = null;
      unlockTimerRef.current = null;
    }, 120);
  }, []);

  useEffect(() => {
    const contentElement = contentRef.current;
    const railElement = railRef.current;
    if (!contentElement || !railElement) return;
    const contentNode = contentElement;
    const railNode = railElement;

    function progress(element: HTMLElement) {
      const max = Math.max(element.scrollHeight - element.clientHeight, 0);
      return max === 0 ? 0 : element.scrollTop / max;
    }

    function maxTop(element: HTMLElement) {
      return Math.max(element.scrollHeight - element.clientHeight, 0);
    }

    function handleContentScroll() {
      if (syncSourceRef.current === "rail") return;
      syncScroll("content", progress(contentNode) * maxTop(railNode));

      const cards = Array.from(contentNode.querySelectorAll<HTMLElement>("[data-section-card]"));
      const containerTop = contentNode.getBoundingClientRect().top;
      let nextId = cards[0]?.dataset.sectionCard ?? null;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const card of cards) {
        const distance = Math.abs(card.getBoundingClientRect().top - containerTop - 8);
        if (distance < bestDistance) {
          bestDistance = distance;
          nextId = card.dataset.sectionCard ?? nextId;
        }
      }
      if (nextId) setActiveSectionState({ templateId: template.id, sectionId: nextId });
    }

    function handleRailScroll() {
      if (syncSourceRef.current === "content") return;
      syncScroll("rail", progress(railNode) * maxTop(contentNode));
    }

    contentNode.addEventListener("scroll", handleContentScroll, { passive: true });
    railNode.addEventListener("scroll", handleRailScroll, { passive: true });
    handleContentScroll();

    return () => {
      contentNode.removeEventListener("scroll", handleContentScroll);
      railNode.removeEventListener("scroll", handleRailScroll);
      if (unlockTimerRef.current !== null) window.clearTimeout(unlockTimerRef.current);
    };
  }, [template.id, syncScroll]);

  function handleNavigateSection(section: DemoTemplateSection) {
    setActiveSectionState({ templateId: template.id, sectionId: section.id });
    if (mode !== "template-edit") return;
    const content = contentRef.current;
    const target = content?.querySelector<HTMLElement>(`#${CSS.escape(templateSectionAnchorId(section))}`);
    if (!content || !target) return;
    const targetTop = target.getBoundingClientRect().top - content.getBoundingClientRect().top + content.scrollTop;
    content.scrollTop = targetTop;
  }

  return (
    <div className={s.projectSectionShell}>
      <div className={s.projectScrollPane} ref={contentRef}>
        {children}
      </div>
      <TemplateSectionRail
        activeSectionId={displayedActiveSectionId}
        mode={mode}
        onNavigateSection={handleNavigateSection}
        ref={railRef}
        template={template}
      />
    </div>
  );
}

const TemplateSectionRail = forwardRef<HTMLElement, {
  activeSectionId?: string | null;
  mode: TemplateSectionMode;
  onNavigateSection?: (section: DemoTemplateSection) => void;
  template: DemoTemplate;
}>(function TemplateSectionRail(
  {
    activeSectionId,
    mode,
    onNavigateSection,
    template,
  },
  ref,
) {
  const resolvedActiveId = activeSectionId ?? template.sections[0]?.id ?? null;

  return (
    <nav className={s.sectionRail} ref={ref} aria-label="模板小节导航">
      <div className={s.railHeading}>
        <strong>小节导航</strong>
        <span>{template.sections.length} 小节</span>
      </div>
      {template.sections.map((section, index) => (
        <Link
          className={cx(s.railItem, resolvedActiveId === section.id && s.railItemActive)}
          href={templateSectionHref(template, section, index, mode)}
          key={section.id}
          onClick={(event) => {
            if (mode === "template-edit") event.preventDefault();
            onNavigateSection?.(section);
          }}
        >
          <strong>{section.name}</strong>
          <span className={cx(s.small, s.muted)}>{section.aspectRatio} / 批量 {section.batchSize}</span>
        </Link>
      ))}
    </nav>
  );
});
