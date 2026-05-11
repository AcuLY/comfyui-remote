"use client";

import { useState } from "react";
import { Activity, Check, FlaskConical, Plus, Settings, Star, Trash2 } from "lucide-react";

import s from "../styles/showcase.module.css";
import { AspectChips, CheckpointPicker, DimensionsReadout, SelectChip, SpecSection, SpecRow, StepperInput, UpscaleControl, VariantSwitcher } from "../section-editor-controls";
import { SectionNameEditor, SaveStatusPill } from "../section-editor-header";
import { Button } from "../ui/button";
import { ButtonLink } from "../ui/button-link";
import { DemoTabs } from "../ui/demo-tabs";
import { EmptyRows } from "../ui/empty-rows";
import { Field } from "../ui/field";
import { MetricCard } from "../ui/metric-card";
import { OperationStateStrip } from "../ui/operation-state-strip";
import { PageHeader } from "../ui/page-header";
import { SegmentedControl } from "../ui/segmented-control";
import { SelectLike } from "../ui/select-like";
import { StatusBadge } from "../ui/status-badge";
import { Switch } from "../ui/switch";
import { SwitchRow } from "../ui/switch-row";
import { TextAreaField } from "../ui/text-area-field";
import { ShowcaseItem } from "./showcase-item";

export function ComponentShowcaseAtoms() {
  const [tabValue, setTabValue] = useState("params");
  const [stepperVal, setStepperVal] = useState(4);
  const [cfgVal, setCfgVal] = useState(7);
  const [denoiseVal, setDenoiseVal] = useState(0.85);
  const [sectionName, setSectionName] = useState("肖像 - 女性角色");
  const [segValue, setSegValue] = useState("euler");
  const [switchChecked, setSwitchChecked] = useState(true);
  const [switchSmChecked, setSwitchSmChecked] = useState(false);
  const [checkpointValue, setCheckpointValue] = useState("");
  const [aspectValue, setAspectValue] = useState("2:3");
  const [upscaleValue, setUpscaleValue] = useState(2);
  const [selectChipValue, setSelectChipValue] = useState("normal");
  const [variantId, setVariantId] = useState("v1");

  return (
    <div className={s.showcasePage}>
      <PageHeader back={{ href: "/component-showcase", label: "返回总览" }} eyebrow="组件展示" title="原子 / 小组件" subtitle="基础组件，调整浏览器窗口宽度查看响应式表现" />

      {/* 1.1 Button */}
      <ShowcaseItem name="Button" desc="通用按钮，5 种色调">
        <div className={s.showcaseGroup}>
          <div className={s.showcaseGroupTitle}>Tone 变体</div>
          <div className={s.showcaseRow}>
            <Button>Default</Button>
            <Button tone="subtle">Subtle</Button>
            <Button tone="primary">Primary</Button>
            <Button tone="pink">Pink</Button>
            <Button tone="danger">Danger</Button>
          </div>
        </div>
        <div className={s.showcaseGroup}>
          <div className={s.showcaseGroupTitle}>带图标</div>
          <div className={s.showcaseRow}>
            <Button icon={Plus}>新增</Button>
            <Button icon={Settings} tone="primary">设置</Button>
            <Button icon={Trash2} tone="danger">删除</Button>
          </div>
        </div>
        <div className={s.showcaseGroup}>
          <div className={s.showcaseGroupTitle}>纯 Icon</div>
          <div className={s.showcaseRow}>
            <Button icon={Plus} iconOnly ariaLabel="新增" />
            <Button icon={Settings} iconOnly tone="primary" ariaLabel="设置" />
            <Button icon={Star} iconOnly tone="pink" ariaLabel="精选" />
            <Button icon={Trash2} iconOnly tone="danger" ariaLabel="删除" />
            <Button icon={Check} iconOnly pressed ariaLabel="已选择" />
          </div>
        </div>
        <div className={s.showcaseGroup}>
          <div className={s.showcaseGroupTitle}>状态</div>
          <div className={s.showcaseRow}>
            <Button pending>Pending</Button>
            <Button disabled>Disabled</Button>
            <Button pressed>Pressed</Button>
            <Button icon={Check} feedback={{ title: "操作成功", detail: "1 项已处理" }}>带反馈</Button>
          </div>
        </div>
      </ShowcaseItem>

      {/* 1.2 ButtonLink */}
      <ShowcaseItem name="ButtonLink" desc="按钮外观的 Link">
        <div className={s.showcaseRow}>
          <ButtonLink href="/design-demos">Default</ButtonLink>
          <ButtonLink href="/design-demos" tone="primary" icon={Plus}>Primary</ButtonLink>
          <ButtonLink href="/design-demos" tone="pink">Pink</ButtonLink>
          <ButtonLink href="/design-demos" tone="subtle" icon={Settings} iconOnly ariaLabel="设置" />
        </div>
      </ShowcaseItem>

      {/* 1.3 StatusBadge */}
      <ShowcaseItem name="StatusBadge" desc="状态标签">
        <div className={s.showcaseRow}>
          <StatusBadge status="running" label="运行中" />
          <StatusBadge status="done" label="完成" />
          <StatusBadge status="pending" label="待审" />
          <StatusBadge status="failed" label="失败" />
          <StatusBadge status="draft" label="草稿" />
        </div>
      </ShowcaseItem>

      {/* 1.4 Field */}
      <ShowcaseItem name="Field" desc="只读文本输入字段">
        <div className={s.showcaseStack}>
          <Field label="项目名称" value="夏日人像合集" />
          <Field label="画幅比例" value="2:3" />
          <Field label="步数" value={20} />
        </div>
      </ShowcaseItem>

      {/* 1.5 TextAreaField */}
      <ShowcaseItem name="TextAreaField" desc="只读多行文本字段">
        <TextAreaField label="正向提示词" value="masterpiece, best quality, 1girl, portrait, detailed face, studio lighting, bokeh background" />
      </ShowcaseItem>

      {/* 1.6 SelectLike */}
      <ShowcaseItem name="SelectLike" desc="只读下拉选择样式字段">
        <SelectLike label="Checkpoint" value="dreamshaper_v8.safetensors" />
      </ShowcaseItem>

      {/* 1.7 SwitchRow */}
      <ShowcaseItem name="SwitchRow" desc="开关行（纯展示）">
        <div className={s.showcaseStack}>
          <SwitchRow title="启用 LoRA" subtitle="加载关联的 LoRA 模型" />
          <SwitchRow title="SFW 模式" subtitle="隐藏敏感内容" />
        </div>
      </ShowcaseItem>

      {/* 1.8 DemoTabs */}
      <ShowcaseItem name="DemoTabs" desc="通用 Tab 切换器">
        <DemoTabs
          tabs={[
            { key: "params", label: "参数" },
            { key: "presets", label: "预制", count: 3 },
            { key: "prompts", label: "提示词" },
            { key: "lora", label: "LoRA", count: 2 },
            { key: "results", label: "结果", count: 48 },
          ]}
          value={tabValue}
          onChange={setTabValue}
        />
      </ShowcaseItem>

      {/* 1.9 MetricCard */}
      <ShowcaseItem name="MetricCard" desc="指标卡片">
        <div className={s.showcaseCardGrid}>
          <MetricCard icon={FlaskConical} label="运行中" value={3} meta="2 个小节" />
          <MetricCard icon={Check} label="已完成" value={127} meta="今天 +12" />
          <MetricCard icon={Activity} label="待审核" value={48} meta="3 次运行" tone="amber" />
          <MetricCard icon={Trash2} label="已删除" value={5} meta="可恢复" tone="danger" />
        </div>
      </ShowcaseItem>

      {/* 1.10 EmptyRows */}
      <ShowcaseItem name="EmptyRows" desc="空状态文字">
        <EmptyRows label="暂无运行记录" />
      </ShowcaseItem>

      {/* 1.11 OperationStateStrip */}
      <ShowcaseItem name="OperationStateStrip" desc="横向操作状态条">
        <OperationStateStrip
          items={[
            { label: "保留", value: "32", tone: "success" },
            { label: "删除", value: "8", tone: "warning" },
            { label: "失败", value: "2", tone: "error" },
          ]}
        />
      </ShowcaseItem>

      {/* 1.13 SectionNameEditor */}
      <ShowcaseItem name="SectionNameEditor" desc="点击编辑小节名">
        <SectionNameEditor initialName={sectionName} onChange={setSectionName} />
      </ShowcaseItem>

      {/* 1.14 SaveStatusPill */}
      <ShowcaseItem name="SaveStatusPill" desc="保存状态指示">
        <div className={s.showcaseRow}>
          <SaveStatusPill status="idle" />
          <SaveStatusPill status="saving" />
          <SaveStatusPill status="saved" />
        </div>
      </ShowcaseItem>

      {/* 1.15 SpecSection / SpecRow */}
      <ShowcaseItem name="SpecSection / SpecRow" desc="参数表单的分组和行布局">
        <SpecSection title="采样参数" hint="调整采样器参数以控制生成质量">
          <SpecRow label="步数" description="更多步数通常更精细">
            <StepperInput value={stepperVal} onChange={setStepperVal} min={1} max={50} />
          </SpecRow>
          <SpecRow label="CFG Scale" description="提示词相关性">
            <StepperInput value={cfgVal} onChange={setCfgVal} min={1} max={30} step={0.5} decrementSteps={[1, 0.5]} incrementSteps={[0.5, 1]} width={220} />
          </SpecRow>
        </SpecSection>
      </ShowcaseItem>

      {/* 1.18 StepperInput */}
      <ShowcaseItem name="StepperInput" desc="步进数值输入">
        <div className={s.showcaseStack}>
          <div className={s.showcaseRow}>
            <StepperInput value={stepperVal} onChange={setStepperVal} min={1} max={50} />
            <StepperInput value={cfgVal} onChange={setCfgVal} min={1} max={30} step={0.5} decrementSteps={[1, 0.5]} incrementSteps={[0.5, 1]} width={220} />
          </div>
          <StepperInput value={denoiseVal} onChange={setDenoiseVal} min={0.1} max={1} step={0.05} decrementSteps={[0.1, 0.05]} incrementSteps={[0.05, 0.1]} width={236} />
        </div>
      </ShowcaseItem>

      {/* 1.19 DimensionsReadout */}
      <ShowcaseItem name="DimensionsReadout" desc="图像尺寸计算与展示">
        <DimensionsReadout aspect="2:3" shortSide={512} upscale={2} />
        <hr className={s.showcaseDivider} />
        <DimensionsReadout aspect="1:1" shortSide={1024} upscale={1} />
      </ShowcaseItem>

      {/* 1.7 Switch */}
      <ShowcaseItem name="Switch" desc="可交互开关">
        <div className={s.showcaseRow}>
          <Switch checked={switchChecked} onCheckedChange={setSwitchChecked} ariaLabel="开关 md" />
          <Switch checked={switchSmChecked} onCheckedChange={setSwitchSmChecked} size="sm" ariaLabel="开关 sm" />
          <Switch defaultChecked={false} ariaLabel="默认关闭" />
        </div>
      </ShowcaseItem>

      {/* 1.9 SegmentedControl */}
      <ShowcaseItem name="SegmentedControl" desc="通用分段控制器">
        <div className={s.showcaseStack}>
          <SegmentedControl
            ariaLabel="采样器选择"
            items={["euler", "euler_ancestral", "dpmpp_2m", "dpmpp_2m_sde"].map((v) => ({ value: v, label: v }))}
            onChange={setSegValue}
            value={segValue}
          />
          <hr className={s.showcaseDivider} />
          <SegmentedControl
            ariaLabel="紧凑模式"
            compact
            items={[1, 2, 4, 8, 16].map((v) => ({ value: v, label: v }))}
            onChange={() => {}}
            value={4}
          />
        </div>
      </ShowcaseItem>

      {/* 1.18 CheckpointPicker */}
      <ShowcaseItem name="CheckpointPicker" desc="Checkpoint 下拉选择器">
        <CheckpointPicker
          value={checkpointValue}
          projectCheckpoint="dreamshaper_v8.safetensors"
          options={["dreamshaper_v8.safetensors", "sdxl_base_1.0.safetensors", "realisticVision_v5.safetensors"]}
          onChange={setCheckpointValue}
        />
      </ShowcaseItem>

      {/* 1.19 AspectChips */}
      <ShowcaseItem name="AspectChips" desc="画幅比例芯片组选择器">
        <AspectChips value={aspectValue} onChange={setAspectValue} />
      </ShowcaseItem>

      {/* 1.22 UpscaleControl */}
      <ShowcaseItem name="UpscaleControl" desc="放大倍数芯片组">
        <UpscaleControl value={upscaleValue} onChange={setUpscaleValue} />
      </ShowcaseItem>

      {/* 1.24 SelectChip */}
      <ShowcaseItem name="SelectChip" desc="芯片式下拉选择器">
        <SelectChip
          value={selectChipValue}
          options={["normal", "karras", "exponential", "simple"]}
          onChange={setSelectChipValue}
        />
      </ShowcaseItem>

      {/* 1.25 VariantSwitcher */}
      <ShowcaseItem name="VariantSwitcher" desc="变体切换下拉">
        <VariantSwitcher
          variants={[
            { id: "v1", name: "默认" },
            { id: "v2", name: "高细节" },
            { id: "v3", name: "低步数" },
          ]}
          currentVariantId={variantId}
          onChange={setVariantId}
        />
      </ShowcaseItem>

    </div>
  );
}
