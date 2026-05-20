"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { GripVertical, Plus, Save, X } from "lucide-react";

import {
  categoryHueValue,
  categoryItemCount,
  categorySlotPreview,
  categoryTypeLabel,
  type DemoCategory,
  type DemoData,
} from "../../data";
import s from "./category-form-page.library.module.css";
import { Button } from "../../shared/primitives/button";
import { EmptyPage } from "../../shared/primitives/empty-page";
import { Field } from "../../shared/primitives/field";
import { PageHeader } from "../../shared/primitives/page-header";
import { FloatingSelect } from "../../shared/primitives/floating-select";
import { cx } from "../../routing";
import { UnitRowShell } from "../../shared/patterns";

function PresetCategoryEditor({ category, categories }: { category: DemoCategory | null; categories: DemoCategory[] }) {
  const [draftType, setDraftType] = useState<"preset" | "group">(category?.type === "group" ? "group" : "preset");
  const type = category ? category.type : draftType;
  const itemCount = category ? categoryItemCount(category) : 0;
  const slots = categorySlotPreview(category, categories);
  const presetCategories = categories.filter((item) => item.type !== "group");
  const [localSlots, setLocalSlots] = useState(() => slots.length ? slots : [{ id: "new-slot", label: "主体", categoryName: presetCategories[0]?.name ?? "选择预设分类" }]);
  const [hue, setHue] = useState(() => categoryHueValue(category?.color ?? null));
  const hueColor = `hsl(${hue} 100% 43%)`;
  const hueControlStyle = {
    "--category-hue-color": hueColor,
    "--category-hue-progress": `${(hue / 359) * 100}%`,
  } as CSSProperties;

  return (
    <div className={s.categoryEditor}>
      <div className={s.categoryTypeSwitch}>
        {(["preset", "group"] as const).map((item) => (
          <button
            className={cx(s.categoryTypeButton, type === item && s.categoryTypeButtonActive)}
            disabled={Boolean(category)}
            key={item}
            onClick={() => setDraftType(item)}
            type="button"
          >
            {item === "group" ? "预设组" : "预设"}
          </button>
        ))}
      </div>
      <div className={s.categoryEditorGrid}>
        <Field label="名称" value={category?.name ?? "新分类"} />
      </div>
      <div className={s.hueControl} style={hueControlStyle}>
        <span className={s.categorySwatch} style={{ backgroundColor: hueColor }} />
        <div className={s.hueSliderFrame}>
          <input
            aria-label="分类色相"
            className={s.hueSlider}
            max={359}
            min={0}
            onChange={(event) => setHue(Number(event.currentTarget.value))}
            onInput={(event) => setHue(Number(event.currentTarget.value))}
            type="range"
            value={hue}
          />
        </div>
        <span>{hue}°</span>
      </div>
      {type === "group" ? (
        <div className={s.slotEditor}>
          <div className={s.slotEditorHeader}>
            <strong>默认槽位</strong>
            <Button icon={Plus} size="sm" tone="primary" onClick={() => setLocalSlots(prev => [...prev, { id: `slot-${Date.now()}`, label: "新槽位", categoryName: presetCategories[0]?.name ?? "选择预设分类" }])} feedback={{ title: "槽位已添加" }}>添加槽位</Button>
          </div>
          {localSlots.map((slot) => (
            <UnitRowShell
              className={s.slotRow}
              dragHandle={<GripVertical className={s.categoryDragIcon} />}
              dragHandleClassName={s.slotRowHandle}
              key={slot.id}
              mainClassName={s.slotRowMain}
              title={(
                <div className={s.slotRowControls}>
                  <FloatingSelect label="来源分类" value={slot.categoryName} />
                  <Button tone="danger" icon={X} iconOnly ariaLabel="删除槽位" onClick={() => setLocalSlots(prev => prev.filter(s => s.id !== slot.id))} />
                </div>
              )}
              titleClassName={s.slotRowTitle}
            />
          ))}
        </div>
      ) : null}
      <div className={s.categoryEditorFooter}>
        {category ? (
          <div className={s.categoryDangerZone}>
            {itemCount > 0 ? (
              <span className={cx(s.inlineNotice, s.inlineNoticeWarn)}>
                删除前需移动 {itemCount} 个条目
              </span>
            ) : null}
            <Button tone="danger" disabled={itemCount > 0}>
              删除分类
            </Button>
          </div>
        ) : null}
        <span className={s.inlineToast}>已保存</span>
      </div>
    </div>
  );
}

export function PresetCategoryFormPage({
  category,
  data,
  mode,
}: {
  category: DemoCategory | undefined;
  data: DemoData;
  mode: "new" | "edit";
}) {
  const target: DemoCategory | null = mode === "edit" ? (category ?? null) : null;

  if (mode === "edit" && !target) return <EmptyPage title="没有预设分类数据" />;

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/presets", label: "返回预设库" }}
        eyebrow="预设分类"
        title={mode === "new" ? "新建预设分类" : `编辑分类 / ${target?.name}`}
        subtitle={mode === "new" ? "创建分类后回到预设库。" : `${categoryTypeLabel(target)} · ${target ? categoryItemCount(target) : 0} 个条目`}
        actions={<Button tone="primary" icon={Save} feedback={{ title: mode === "new" ? "分类创建已排队" : "分类保存已排队" }}>{mode === "new" ? "创建分类" : "保存分类"}</Button>}
      />
      <div className={s.categoryFormLayout}>
        <section className={s.categoryFormSurface}>
          <PresetCategoryEditor category={target} categories={data.categories} />
        </section>
      </div>
    </div>
  );
}
