"use client";

import { ArrowLeft, ArrowRight, Copy, Download, GripVertical, Plus, Rows3, Save, Trash2 } from "lucide-react";

import type { DemoTemplate } from "../../data";
import s from "./template-section-page.library.module.css";
import { Button } from "../../shared/primitives/button";
import { ButtonLink } from "../../shared/primitives/button";
import { EmptyPage } from "../../shared/primitives/empty-page";
import { Field } from "../../shared/primitives/field";
import { OperationStateStrip } from "../../shared/feedback/operation-state-strip";
import { PageHeader } from "../../shared/primitives/page-header";
import { FloatingSelect } from "../../shared/primitives/floating-select";
import { StatusBadge } from "../../shared/primitives/status-badge";
import { TemplateSectionShell, templateSectionAnchorId } from "./template-section-shell";

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
            <div className={s.formGrid}>
              <Field label="小节名" value={section.name} />
              <FloatingSelect label="比例" value={section.aspectRatio} />
              <Field label="短边像素" value={768} />
              <Field label="批量数" value={section.batchSize} />
              <FloatingSelect label="Checkpoint" value="继承模板默认" />
              <FloatingSelect label="Upscale" value="2x / 可清除" />
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
                    <FloatingSelect label="变体" value={bindingIndex === 0 ? "默认" : "继承"} />
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
                  <Button className={s.dragHandle} tone="subtle" icon={GripVertical} iconOnly ariaLabel="排序手柄" />
                  <div className={s.promptBlockContent}>
                    <div className={s.promptBlockTitle}>
                      <strong>{String(blockIndex + 1).padStart(2, "0")} · {block.label}</strong>
                      <span>template block</span>
                    </div>
                    <div className={s.promptColumns}>
                      <Field multiline features={{ resize: true, clipboard: true }} label="正向" value={block.positive} />
                      <Field multiline features={{ resize: true, clipboard: true }} label="反向" value={block.negative} />
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
                      <Button tone="subtle">触发词</Button>
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
                  <Button className={categoryIndex === 0 ? s.importCategoryActive : ""} pressed={categoryIndex === 0} tone="subtle" key={name}>
                    {name}
                  </Button>
                ))}
              </div>
              <div className={s.importPresetColumn}>
                <div className={s.presetContextBar}>
                  <StatusBadge status="template" label="根目录 / 模板候选" />
                  <StatusBadge status="ready" label="2 个变体可用" />
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
