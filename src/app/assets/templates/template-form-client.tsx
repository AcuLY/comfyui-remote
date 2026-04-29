"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Copy, Plus, Trash2, GripVertical, Save } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  copyProjectTemplateSection,
  createProjectTemplate,
  updateProjectTemplate,
} from "@/lib/actions";
import { resolveResolution } from "@/lib/aspect-ratio-utils";
import type { ProjectTemplateSectionData } from "@/lib/server-data";
import { type LoraEntry } from "@/lib/lora-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  templateId?: string;
  initialName?: string;
  initialDescription?: string | null;
  initialSections?: ProjectTemplateSectionData[];
};

// ---------------------------------------------------------------------------
// TemplateFormClient
// ---------------------------------------------------------------------------

export function TemplateFormClient({
  templateId,
  initialName = "",
  initialDescription = null,
  initialSections = [],
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [sections, setSections] = useState<ProjectTemplateSectionData[]>(initialSections);
  const [isPending, startTransition] = useTransition();
  const savedMetaRef = useRef({
    name: initialName.trim(),
    description: initialDescription ?? "",
  });

  const isEdit = !!templateId;
  const dndId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Section management ──

  function createDefaultSection(index: number): ProjectTemplateSectionData {
    return {
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      sortOrder: index,
      name: null,
      aspectRatio: "2:3",
      shortSidePx: 512,
      batchSize: 2,
      seedPolicy1: "random",
      seedPolicy2: "random",
      ksampler1: null,
      ksampler2: null,
      upscaleFactor: 2,
      checkpointName: null,
      loraConfig: { lora1: [], lora2: [] },
      extraParams: null,
      promptBlocks: [],
    };
  }

  function addSection() {
    if (isEdit && !name.trim()) {
      toast.error("请输入模板名称");
      return;
    }

    const nextSection = createDefaultSection(sections.length);
    const nextSections = [...sections, nextSection];
    setSections(nextSections);

    if (!isEdit) {
      return;
    }

    startTransition(async () => {
      try {
        await updateProjectTemplate({
          id: templateId,
          name: name.trim(),
          description: description.trim() || null,
          sections: nextSections,
        });
        toast.success("小节已添加");
        router.push(`/assets/templates/${templateId}/sections/${nextSections.length - 1}`);
      } catch (e: unknown) {
        setSections(sections);
        toast.error(e instanceof Error ? e.message : "添加小节失败");
      }
    });
  }

  function removeSection(id: string) {
    const nextSections = sections.filter((s) => s.id !== id).map((s, i) => ({ ...s, sortOrder: i }));
    const previousSections = sections;
    setSections(nextSections);

    if (!isEdit) return;
    saveSections(nextSections, "小节已删除", () => setSections(previousSections));
  }

  function copySection(section: ProjectTemplateSectionData) {
    if (!isEdit || section.id.startsWith("new-")) return;

    startTransition(async () => {
      try {
        const copiedId = await copyProjectTemplateSection(section.id);
        if (!copiedId) throw new Error("小节不存在");
        const copiedSection: ProjectTemplateSectionData = {
          ...section,
          id: copiedId,
          sortOrder: sections.length,
          name: section.name ? `${section.name} (副本)` : null,
        };
        setSections((prev) => [...prev, copiedSection]);
        toast.success("小节已复制");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "复制失败");
      }
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const nextSections = arrayMove(sections, oldIndex, newIndex).map((s, i) => ({ ...s, sortOrder: i }));
    const previousSections = sections;
    setSections(nextSections);

    if (isEdit) {
      saveSections(nextSections, "小节顺序已保存", () => setSections(previousSections));
    }
  }

  // ── Save ──

  function saveSections(nextSections: ProjectTemplateSectionData[], successMessage: string, rollback?: () => void) {
    if (!isEdit) return;
    if (!name.trim()) {
      toast.error("请输入模板名称");
      rollback?.();
      return;
    }

    startTransition(async () => {
      try {
        await updateProjectTemplate({
          id: templateId,
          name: name.trim(),
          description: description.trim() || null,
          sections: nextSections,
        });
        toast.success(successMessage);
        router.refresh();
      } catch (e: unknown) {
        rollback?.();
        toast.error(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  function handleMetaBlur() {
    if (!isEdit) return;
    const nextName = name.trim();
    const nextDescription = description.trim();
    if (!nextName) {
      toast.error("请输入模板名称");
      return;
    }

    if (
      savedMetaRef.current.name === nextName &&
      savedMetaRef.current.description === nextDescription
    ) {
      return;
    }

    startTransition(async () => {
      try {
        await updateProjectTemplate({
          id: templateId,
          name: nextName,
          description: nextDescription || null,
        });
        savedMetaRef.current = { name: nextName, description: nextDescription };
        toast.success("模板已保存");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  function handleSave() {
    if (!name.trim()) {
      toast.error("请输入模板名称");
      return;
    }
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateProjectTemplate({
            id: templateId,
            name: name.trim(),
            description: description.trim() || null,
            sections,
          });
          toast.success("模板已更新");
        } else {
          const id = await createProjectTemplate({
            name: name.trim(),
            description: description.trim() || null,
            sections,
          });
          toast.success("模板已创建");
          router.push(`/assets/templates/${id}/edit`);
        }
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-4">
      <Link
        href="/assets/templates"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200"
      >
        <ArrowLeft className="size-4" /> 返回模板列表
      </Link>

      {/* Template metadata */}
      <div className="space-y-3 border-t border-white/5 pt-3">
        <div>
          <label className="text-xs text-zinc-500">模板名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleMetaBlur}
            placeholder="例如：4 宫格角色展示"
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500">描述（可选）</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleMetaBlur}
            placeholder="模板用途说明"
            rows={2}
            className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30"
          />
        </div>
      </div>

      {/* Sections list — sortable with dnd-kit */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-300">
            小节配置 ({sections.length})
          </span>
          <button
            type="button"
            disabled={isPending}
            onClick={addSection}
            className="inline-flex items-center gap-1 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-400 transition hover:border-sky-500/30 hover:text-sky-300 disabled:opacity-50"
          >
            <Plus className="size-3" /> 添加小节
          </button>
        </div>

        {sections.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/10 p-4 text-center text-xs text-zinc-500">
            暂无小节，点击上方按钮添加
          </div>
        )}

        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="grid grid-cols-1 gap-3 justify-items-center md:grid-cols-2">
              {sections.map((section, si) => (
                <SortableSectionCard
                  key={section.id}
                  section={section}
                  index={si}
                  templateId={templateId}
                  onRemove={() => removeSection(section.id)}
                  onCopy={() => copySection(section)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {!isEdit && (
        <button
          disabled={isPending || !name.trim()}
          onClick={handleSave}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2.5 text-sm font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
        >
          <Save className="size-4" /> {isPending ? "保存中…" : "创建模板"}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableSectionCard — drag-and-drop card with dnd-kit
// ---------------------------------------------------------------------------

function SortableSectionCard({
  section,
  index,
  templateId,
  onRemove,
  onCopy,
}: {
  section: ProjectTemplateSectionData;
  index: number;
  templateId?: string;
  onRemove: () => void;
  onCopy: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const aspectRatio = section.aspectRatio || "2:3";
  const res = resolveResolution(aspectRatio, section.shortSidePx ?? 512);
  const resDisplay = `${res.width}x${res.height}`;

  const loraConfig = (section.loraConfig as { lora1: LoraEntry[]; lora2: LoraEntry[] }) || { lora1: [], lora2: [] };
  const loraCount = loraConfig.lora1.length + loraConfig.lora2.length;
  const blockCount = (section.promptBlocks || []).length;
  const checkpointLabel = section.checkpointName ? section.checkpointName.split("/").pop() : null;

  // If no templateId yet (new template) or the section is not persisted yet,
  // do not expose a route that the server cannot resolve.
  const href = templateId && !section.id.startsWith("new-")
    ? `/assets/templates/${templateId}/sections/${index}`
    : null;

  const CardWrapper = href
    ? ({ children }: { children: React.ReactNode }) => (
        <Link href={href} className="contents">
          {children}
        </Link>
      )
    : ({ children }: { children: React.ReactNode }) => <>{children}</>;

  return (
    <CardWrapper>
      <div ref={setNodeRef} style={style} className={`w-full rounded-lg border border-white/10 bg-white/[0.02] p-3 md:max-w-[500px] transition ${isDragging ? "z-10 shadow-lg" : ""} ${href ? "hover:border-white/20 hover:bg-white/[0.04] cursor-pointer" : ""}`}>
        {/* Header */}
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab text-zinc-600 hover:text-zinc-400 active:cursor-grabbing touch-none"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <GripVertical className="size-4" />
          </button>
          <span className="shrink-0 text-xs text-zinc-500">#{index + 1}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
            {section.name || "未命名小节"}
          </span>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCopy(); }}
            disabled={!href}
            title="复制小节"
            className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-500 transition hover:border-sky-500/20 hover:bg-sky-500/10 hover:text-sky-300 disabled:opacity-40"
          >
            <Copy className="size-3" />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
            className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-500 transition hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-300"
          >
            <Trash2 className="size-3" />
          </button>
        </div>

        {/* Summary metadata */}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-400">
          <span>{aspectRatio}</span>
          <span>{resDisplay}</span>
          <span>batch {section.batchSize ?? "—"}</span>
          <span>{section.upscaleFactor ?? 2}x</span>
          {checkpointLabel && <span className="max-w-full truncate">ckpt {checkpointLabel}</span>}
        </div>
        <div className="mt-1 flex gap-3 text-[11px] text-zinc-500">
          {blockCount > 0 && <span>{blockCount} 个 prompt</span>}
          {loraCount > 0 && <span>{loraCount} 个 LoRA</span>}
          {blockCount === 0 && loraCount === 0 && <span>未配置内容</span>}
        </div>
      </div>
    </CardWrapper>
  );
}
