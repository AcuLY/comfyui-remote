"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { CheckSquare, CopyPlus, Trash2 } from "lucide-react";

import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";
import { Button, ButtonLink } from "@/components/design-demo-ui/primitives/button";
import { PageHeader } from "@/components/design-demo-ui/primitives/page-header";
import { SortableList } from "@/components/design-demo-ui/primitives/sortable";
import { SelectionBatchBar } from "@/components/design-demo-ui/patterns";
import { buildLoraTrainingData } from "@/features/training/build";
import type { TrainingAppData } from "@/features/training/data";
import { createProjectFromTemplateHref, isProductionTrainingPath } from "./training-resource-page-utils";
import { orderTrainingTemplatesByIds } from "./training-template-page-utils";
import { TrainingTemplateListItem, readAndClearTrainingTemplateListAnchor } from "./training-template-list-primitives";
import s from "./training-resource-pages.module.css";

export function LoraTrainingTemplatesPage({ data }: { data: TrainingAppData }) {
  const pathname = usePathname();
  const { pushToast } = useDemoFeedback();
  const training = buildLoraTrainingData(data);
  const listRef = useRef<HTMLDivElement>(null);
  const [fromTemplateId] = useState(readAndClearTrainingTemplateListAnchor);
  const [orderedTemplateIds, setOrderedTemplateIds] = useState(() => training.templates.reduce<string[]>((ids, template) => [...ids, template.id], []));
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(() => new Set());
  const [hiddenTemplateIds, setHiddenTemplateIds] = useState<Set<string>>(() => new Set());
  const [isDeletingTemplates, setIsDeletingTemplates] = useState(false);
  const orderedTemplates = orderTrainingTemplatesByIds(training.templates, orderedTemplateIds);
  const visibleTemplates = orderedTemplates.filter((template) => !hiddenTemplateIds.has(template.id));
  const visibleTemplateIds = visibleTemplates.map((template) => template.id);
  const selectedVisibleTemplates = visibleTemplates.filter((template) => selectedTemplateIds.has(template.id));
  const selectedVisibleCount = selectedVisibleTemplates.length;
  const allVisibleSelected = visibleTemplates.length > 0 && selectedVisibleCount === visibleTemplates.length;
  const projectTemplateSource = selectedVisibleTemplates.length === 1 ? selectedVisibleTemplates[0] : null;
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);

  useLayoutEffect(() => {
    if (!fromTemplateId) return;
    const target = listRef.current?.querySelector(`[data-training-template-id="${fromTemplateId}"]`);
    target?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [fromTemplateId]);

  async function hideTemplate(templateId: string) {
    const applyLocalDelete = (ids: Iterable<string>) => {
      const removed = new Set(ids);
      setHiddenTemplateIds((current) => new Set([...current, ...removed]));
      setSelectedTemplateIds((current) => new Set([...current].filter((id) => !removed.has(id))));
    };

    if (!isProductionTrainingRoute) {
      applyLocalDelete([templateId]);
      return;
    }

    if (isDeletingTemplates) return;

    setIsDeletingTemplates(true);
    try {
      const response = await fetch(`/api/training/templates/${templateId}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "训练模板删除失败",
          detail: payload?.error?.message ?? "训练模板删除请求失败",
        });
        return;
      }
      applyLocalDelete([templateId]);
      pushToast({
        tone: "warning",
        title: "训练模板已移除",
        detail: templateId,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "训练模板删除失败",
        detail: error instanceof Error ? error.message : "训练模板删除请求失败",
      });
    } finally {
      setIsDeletingTemplates(false);
    }
  }

  function toggleTemplateSelection(templateId: string) {
    setSelectedTemplateIds((current) => {
      const next = new Set(current);
      if (next.has(templateId)) next.delete(templateId);
      else next.add(templateId);
      return next;
    });
  }

  function toggleVisibleTemplates() {
    setSelectedTemplateIds((current) => {
      if (allVisibleSelected) {
        const next = new Set(current);
        visibleTemplates.forEach((template) => next.delete(template.id));
        return next;
      }
      return new Set([...current, ...visibleTemplateIds]);
    });
  }

  async function handleRemoveSelectedTemplates() {
    const selectedVisibleIds = new Set(visibleTemplates.filter((template) => selectedTemplateIds.has(template.id)).map((template) => template.id));

    const applyLocalDelete = (ids: Iterable<string>) => {
      const removed = new Set(ids);
      setHiddenTemplateIds((current) => new Set([...current, ...removed]));
      setSelectedTemplateIds((current) => new Set([...current].filter((id) => !removed.has(id))));
    };

    if (!isProductionTrainingRoute) {
      applyLocalDelete(selectedVisibleIds);
      return;
    }

    if (isDeletingTemplates || selectedVisibleIds.size === 0) return;

    setIsDeletingTemplates(true);
    try {
      const responses = await Promise.all(
        [...selectedVisibleIds].map(async (templateId) => {
          const response = await fetch(`/api/training/templates/${templateId}`, {
            method: "DELETE",
          });
          const payload = await response.json().catch(() => null);
          return { templateId, response, payload };
        }),
      );
      const completedIds = new Set(
        responses
          .filter(({ response, payload }) => response.ok && payload?.ok)
          .map(({ templateId }) => templateId),
      );
      if (completedIds.size > 0) {
        applyLocalDelete(completedIds);
      }
      const failedResponse = responses.find(({ response, payload }) => !response.ok || !payload?.ok);
      if (failedResponse) {
        pushToast({
          tone: "error",
          title: "训练模板删除失败",
          detail: failedResponse.payload?.error?.message ?? "训练模板删除请求失败",
        });
        return;
      }
      pushToast({
        tone: "warning",
        title: "训练模板已移除",
        detail: `${completedIds.size} 个训练模板`,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "训练模板删除失败",
        detail: error instanceof Error ? error.message : "训练模板删除请求失败",
      });
    } finally {
      setIsDeletingTemplates(false);
    }
  }

  function handleReorderTemplates(nextVisibleIds: string[]) {
    const visibleTemplateIdSet = new Set(visibleTemplateIds);
    const reorderedVisibleIds = [...nextVisibleIds];
    const previousIds = orderedTemplateIds;
    const nextOrderedIds = orderedTemplateIds.map((templateId) =>
      visibleTemplateIdSet.has(templateId) ? reorderedVisibleIds.shift() ?? templateId : templateId,
    );
    setOrderedTemplateIds(nextOrderedIds);

    if (!isProductionTrainingRoute) return;

    void (async () => {
      try {
        const response = await fetch("/api/training/templates/reorder", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            orderedTemplateIds: nextOrderedIds,
          }),
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.ok) {
          setOrderedTemplateIds(previousIds);
          pushToast({
            tone: "error",
            title: "训练模板排序保存失败",
            detail: payload?.error?.message ?? "训练模板排序保存请求失败",
          });
        }
      } catch (error) {
        setOrderedTemplateIds(previousIds);
        pushToast({
          tone: "error",
          title: "训练模板排序保存失败",
          detail: error instanceof Error ? error.message : "训练模板排序保存请求失败",
        });
      }
    })();
  }

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="LoRA 训练"
        title="训练模板"
        subtitle="模板提供创建训练项目时的初始小节结构；项目创建后会独立编辑。"
        actions={projectTemplateSource ? (
          <ButtonLink
            href={createProjectFromTemplateHref(projectTemplateSource)}
            icon={CopyPlus}
            ariaLabel={`从训练模板创建项目：${projectTemplateSource.title}`}
          >
            从模板创建项目
          </ButtonLink>
        ) : undefined}
      />
      <div className={s.trainingTemplateListToolbar}>
        <div>
          <strong>模板列表</strong>
          <span>{visibleTemplates.length} 个模板{selectedVisibleCount ? ` · 已选 ${selectedVisibleCount}` : ""}</span>
        </div>
        <Button icon={CheckSquare} onClick={toggleVisibleTemplates} disabled={visibleTemplates.length === 0}>
          {allVisibleSelected ? "取消全选" : "全选"}
        </Button>
      </div>
      {selectedVisibleCount > 0 ? (
        <SelectionBatchBar
          className={s.trainingTemplateBatchBar}
          selectedCount={selectedVisibleCount}
          subject="个训练模板"
          onClear={() => setSelectedTemplateIds(new Set())}
          actions={(
            <Button tone="danger" icon={Trash2} onClick={handleRemoveSelectedTemplates} feedback={{ tone: "warning", title: "训练模板已从列表移除", detail: `${selectedVisibleCount} 个训练模板` }}>
              删除所选
            </Button>
          )}
        />
      ) : null}
      <div className={s.trainingTemplateListSurface}>
        <div className={s.trainingTemplateList} ref={listRef}>
          <SortableList items={visibleTemplateIds} onReorder={handleReorderTemplates}>
            {visibleTemplates.map((template) => (
              <TrainingTemplateListItem
                createProjectHref={createProjectFromTemplateHref(template)}
                key={template.id}
                onDelete={() => hideTemplate(template.id)}
                onToggleSelected={() => toggleTemplateSelection(template.id)}
                selected={selectedTemplateIds.has(template.id)}
                template={template}
              />
            ))}
          </SortableList>
          {visibleTemplates.length === 0 ? (
            <div className={s.emptyInline}>
              <strong>暂无训练模板</strong>
              <span>当前本地视图里的模板都已移除，可通过新建模板重新开始。</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
