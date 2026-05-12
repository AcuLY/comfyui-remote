"use client";

import {
  AspectChips,
  CheckpointPicker,
  DimensionsReadout,
  KSamplerCard,
  SpecRow,
  SpecSection,
  StepperInput,
  UpscaleControl,
} from "../section-editor-components";
import { CHECKPOINT_OPTIONS } from "../section-editor-page-data";
import s from "./params-panel.section-editor.module.css";
import local from "./section-editor.module.css";
import type { SectionEditorModel } from "./use-section-editor-state";

export function ParamsPanel({ editor }: { editor: SectionEditorModel }) {
  return (
    <div className={s.sectionTabBody}>
      <SpecSection title="图像输出" hint="决定最终画幅尺寸与批量数。">
        <SpecRow label="画幅比例">
          <AspectChips value={editor.aspectRatio} onChange={editor.updateAspectRatio} />
        </SpecRow>
        <SpecRow label="短边像素" description="小于最终像素维度的一侧">
          <StepperInput
            value={editor.shortSidePx}
            onChange={editor.updateShortSidePx}
            min={256}
            max={2048}
            step={64}
            width={130}
          />
          <DimensionsReadout
            aspect={editor.aspectRatio}
            shortSide={editor.shortSidePx}
            upscale={editor.upscaleFactor}
          />
        </SpecRow>
        <SpecRow label="放大倍数">
          <UpscaleControl value={editor.upscaleFactor} onChange={editor.updateUpscaleFactor} />
        </SpecRow>
      </SpecSection>

      <SpecSection title="模型" hint="checkpoint 支持继承项目设置。">
        <SpecRow label="Checkpoint">
          <CheckpointPicker
            value={editor.checkpointName}
            projectCheckpoint={editor.section.projectCheckpointName}
            options={CHECKPOINT_OPTIONS}
            onChange={editor.updateCheckpointName}
          />
        </SpecRow>
      </SpecSection>

      <SpecSection title="采样器" hint="两个 KSampler 分别控制首次采样与放大后精修。">
        <div className={local.ksamplerStack}>
          <KSamplerCard
            label="KSampler 1"
            hint="首次生成"
            params={editor.ksampler1}
            onChange={editor.updateKSampler1}
          />
          <KSamplerCard
            label="KSampler 2"
            hint={editor.upscaleFactor === 1 ? "1× 模式未启用" : "放大后精修"}
            params={editor.ksampler2}
            disabled={editor.upscaleFactor === 1}
            onChange={editor.updateKSampler2}
          />
        </div>
      </SpecSection>
    </div>
  );
}
