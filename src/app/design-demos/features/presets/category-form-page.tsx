"use client";

import { useState } from "react";
import { GripVertical, Plus, Save, X } from "lucide-react";

import {
  categoryColorValue,
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
import { SelectLike } from "../../shared/primitives/select-like";
import { cx } from "../../routing";

function PresetCategoryEditor({ category, categories }: { category: DemoCategory | null; categories: DemoCategory[] }) {
  const [draftType, setDraftType] = useState<"preset" | "group">(category?.type === "group" ? "group" : "preset");
  const type = category ? category.type : draftType;
  const itemCount = category ? categoryItemCount(category) : 0;
  const slots = categorySlotPreview(category, categories);
  const presetCategories = categories.filter((item) => item.type !== "group");

  return (
    <div className={s.categoryEditor}>
      <div className={s.categoryEditorHeader}>
        <strong>{category ? "编辑分类" : "新建分类"}</strong>
        <span>{category ? "分类类型已锁定" : "选择预设或预设组"}</span>
      </div>
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
        <Field label="Slug" value={category?.slug ?? "new-category"} />
      </div>
      <div className={s.hueControl}>
        <span className={s.categorySwatch} style={{ backgroundColor: categoryColorValue(category?.color ?? null) }} />
        <input className={s.hueSlider} type="range" min={0} max={359} defaultValue={categoryHueValue(category?.color ?? null)} />
        <span>{categoryHueValue(category?.color ?? null)}°</span>
      </div>
      {type === "group" ? (
        <div className={s.slotEditor}>
          <div className={s.slotEditorHeader}>
            <strong>默认槽位</strong>
            <Button icon={Plus}>添加槽位</Button>
          </div>
          {(slots.length ? slots : [{ id: "new-slot", label: "主体", categoryName: presetCategories[0]?.name ?? "选择预设分类" }]).map((slot) => (
            <div className={s.slotRow} key={slot.id}>
              <GripVertical className={s.categoryDragIcon} />
              <SelectLike label="来源分类" value={slot.categoryName} />
              <Field label="槽位标签" value={slot.label} />
              <Button tone="danger" icon={X} iconOnly size="sm" ariaLabel="删除槽位" />
            </div>
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
