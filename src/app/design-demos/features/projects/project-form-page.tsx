"use client";

import { Save } from "lucide-react";

import type { DemoData, DemoProject } from "../../data";
import s from "./project-form-page.projects.module.css";
import { Button } from "../../shared/primitives/button";
import { Field } from "../../shared/primitives/field";
import { PageHeader } from "../../shared/primitives/page-header";
import { Panel } from "../../shared/primitives/panel";
import { FloatingSelect } from "../../shared/primitives/floating-select";
import { SwitchRow } from "../../shared/primitives/switch-row";

export function ProjectFormPage({ project, mode, data }: { project?: DemoProject; mode: "new" | "edit"; data?: DemoData }) {
  const checkpoints = data?.models.filter(m => m.modelType === "checkpoint") ?? [];

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="项目"
        title={mode === "new" ? "创建新项目" : project?.title ?? "项目"}
        subtitle="基础信息、预设绑定、默认参数和小节种子策略。"
        actions={<Button tone="primary" icon={Save}>{mode === "new" ? "创建" : "保存"}</Button>}
      />
      <div className={s.twoCol}>
        <Panel title="基础信息">
          <div className={s.contentGrid}>
            <div className={s.formGrid}>
              <Field label="项目名称" value={project?.title ?? "新图像项目"} />
              <FloatingSelect label="状态" value={project?.status ?? "draft"} />
              <FloatingSelect label="Checkpoint" value={project?.checkpointName ?? "继承默认模型"} options={["继承默认模型", ...checkpoints.map(c => c.name)]} />
            </div>
            <Field multiline features={{ resize: true, clipboard: true }} label="备注" value={project?.notes || "项目级说明、输出目标和人工备注。"} />
          </div>
        </Panel>
        {data && data.categories.length > 0 ? (
          <Panel title="预设绑定">
            <div className={s.contentGrid}>
              {data.categories.map(cat => (
                <div key={cat.id} className={s.formGrid}>
                  <FloatingSelect label={cat.name} value={project?.presetNames?.find(n => cat.presets.some(p => p.name === n)) ?? "未绑定"} options={["未绑定", ...cat.presets.map(p => p.name)]} />
                </div>
              ))}
            </div>
          </Panel>
        ) : null}
        {mode === "new" && data && data.templates.length > 0 ? (
          <Panel title="从模板创建">
            <div className={s.contentGrid}>
              <div className={s.formGrid}>
                <FloatingSelect label="选择模板" value="不使用模板" options={["不使用模板", ...data.templates.map(t => t.name)]} />
              </div>
            </div>
          </Panel>
        ) : null}
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
