"use client";

import { Save } from "lucide-react";

import type { DemoProject } from "../../data";
import s from "./project-form-page.projects.module.css";
import { Button } from "../../shared/primitives/button";
import { Field } from "../../shared/primitives/field";
import { PageHeader } from "../../shared/primitives/page-header";
import { Panel } from "../../shared/primitives/panel";
import { SelectLike } from "../../shared/primitives/select-like";
import { SwitchRow } from "../../shared/primitives/switch-row";
import { TextAreaField } from "../../shared/primitives/text-area-field";

export function ProjectFormPage({ project, mode }: { project?: DemoProject; mode: "new" | "edit" }) {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="项目"
        title={mode === "new" ? "创建新项目" : `编辑项目：${project?.title ?? "项目"}`}
        subtitle="基础信息、预设绑定、默认参数和小节种子策略。"
        actions={<Button tone="primary" icon={Save}>{mode === "new" ? "创建" : "保存"}</Button>}
      />
      <div className={s.twoCol}>
        <Panel title="基础信息">
          <div className={s.contentGrid}>
            <div className={s.formGrid}>
              <Field label="项目名称" value={project?.title ?? "新图像项目"} />
              <Field label="Slug" value={project?.slug ?? "new-project"} />
              <SelectLike label="状态" value={project?.status ?? "draft"} />
              <SelectLike label="Checkpoint" value={project?.checkpointName ?? "继承默认模型"} />
            </div>
            <TextAreaField label="备注" value={project?.notes || "项目级说明、输出目标和人工备注。"} />
          </div>
        </Panel>
        <Panel title="默认运行参数">
          <div className={s.contentGrid}>
            <SwitchRow title="继承模板参数" subtitle="创建小节时自动填充模板默认值。" />
            <div className={s.formGrid}>
              <Field label="默认比例" value="2:3" />
              <Field label="短边像素" value={768} />
              <Field label="批量数" value={2} />
              <Field label="放大倍率" value="2x" />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
