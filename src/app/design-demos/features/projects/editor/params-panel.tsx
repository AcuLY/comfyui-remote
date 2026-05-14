"use client";

import {
  CheckpointPicker,
  ImageSizeControlGroup,
  KSamplerCard,
  SpecRow,
  SpecSection,
} from "./editor-parts";
import { CHECKPOINT_OPTIONS } from "./editor-page-data";
import s from "./params-panel.editor.module.css";
import local from "./editor.module.css";
import type { SectionEditorModel } from "./use-section-editor-state";

export function ParamsPanel({ editor }: { editor: SectionEditorModel }) {
  return (
    <div className={s.sectionTabBody}>
      <ImageSizeControlGroup
        aspectRatio={editor.aspectRatio}
        onAspectRatioChange={editor.updateAspectRatio}
        onShortSideChange={editor.updateShortSidePx}
        onUpscaleChange={editor.updateUpscaleFactor}
        shortSidePx={editor.shortSidePx}
        upscaleFactor={editor.upscaleFactor}
      />

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
