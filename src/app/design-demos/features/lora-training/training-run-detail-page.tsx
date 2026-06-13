"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Copy, FileText, History, ImagePlus, Play, RotateCcw } from "lucide-react";

import type { DemoData } from "../../data";
import { ImagePreviewFrame } from "../../shared/media/image-preview-frame";
import { ImagePreviewLarge } from "../../shared/media/image-preview-large";
import { ImageListSmall } from "../../shared/media/image-list-small";
import { Button, ButtonLink } from "../../shared/primitives/button";
import { EmptyPage } from "../../shared/primitives/empty-page";
import { Field } from "../../shared/primitives/field";
import { PageHeader } from "../../shared/primitives/page-header";
import { Panel } from "../../shared/primitives/panel";
import { StatusBadge } from "../../shared/primitives/status-badge";
import { buildLoraTrainingDemoData } from "./fixtures";
import type { LoraTrainingRun, LoraTrainingTaskKind } from "./types";
import s from "./training-run-detail-page.module.css";

type RetryDraft = {
  runId: string;
  projectTitle: string;
  title: string;
  provider: string;
  queuedAt: string;
  sourceStatus: LoraTrainingRun["status"];
  datasetVersion?: string;
};

type ActiveSampleState = {
  index: number;
  runId: string;
};

type CopiedCaptionState = {
  caption: string;
  runId: string;
  sampleId: string;
};

function runStatusBadge(run: LoraTrainingRun) {
  if (run.status === "completed") return <StatusBadge status="done" label="已完成" />;
  if (run.status === "running") return <StatusBadge status="running" label="进行中" />;
  if (run.status === "queued") return <StatusBadge status="queued" label="排队中" />;
  return <StatusBadge status="failed" label="失败" />;
}

function findRun(data: DemoData, kind: LoraTrainingTaskKind, runId: string | undefined) {
  const training = buildLoraTrainingDemoData(data);
  return training.runs.find((run) => run.kind === kind && run.id === runId)
    ?? training.runs.find((run) => run.kind === kind);
}

function progressPercent(run: LoraTrainingRun) {
  return Math.round(Math.max(0, Math.min(100, run.progress ?? (run.status === "completed" ? 100 : 0))));
}

function trainingConfigText(run: LoraTrainingRun) {
  if (!run.trainingConfig?.length) return run.finalInput ?? "未记录训练参数";
  return run.trainingConfig
    .map((row) => `${row.label}: ${row.value}${row.detail ? ` · ${row.detail}` : ""}`)
    .join("\n");
}

function createTrainingPresetHref(run: LoraTrainingRun) {
  const params = new URLSearchParams({
    category: "训练产物",
    folder: "LoRA 产物",
    sourceRun: run.id,
    project: run.projectTitle,
  });
  params.set("artifact", run.artifactName ?? run.finalLoraArtifactId ?? "");
  return `/training/presets/new?${params.toString()}`;
}

export function LoraTrainingRunDetailPage({
  data,
  kind,
  runId,
}: {
  data: DemoData;
  kind: LoraTrainingTaskKind;
  runId?: string;
}) {
  const [activeSampleState, setActiveSampleState] = useState<ActiveSampleState | null>(null);
  const [copiedCaption, setCopiedCaption] = useState<CopiedCaptionState | null>(null);
  const [retryDraft, setRetryDraft] = useState<RetryDraft | null>(null);
  const training = buildLoraTrainingDemoData(data);
  const run = findRun(data, kind, runId);
  const project = run ? training.projects.find((item) => item.id === run.projectId) : undefined;
  const percent = run ? progressPercent(run) : 0;

  if (!run) return <EmptyPage title={kind === "generation" ? "没有生成任务数据" : "没有训练任务数据"} />;

  const isGeneration = run.kind === "generation";
  const currentRetryDraft = run.status === "failed" && retryDraft?.runId === run.id ? retryDraft : null;
  const isRetryQueued = Boolean(currentRetryDraft);
  const projectHref = `/training/projects/${run.projectId}`;
  const datasetHref = run.datasetRevisionId ? `${projectHref}/dataset/revisions/${run.datasetRevisionId}` : `${projectHref}/dataset`;
  const datasetSamples = isGeneration ? [] : run.datasetSamples ?? [];
  const activeSample = activeSampleState?.runId === run.id ? datasetSamples[activeSampleState.index] ?? null : null;
  const isActiveCaptionCopied = activeSample ? copiedCaption?.runId === run.id && copiedCaption?.sampleId === activeSample.id : false;
  const canCreatePreset = !isGeneration && Boolean(run.finalLoraArtifactId) && !run.presetCreatedAt;
  const logText = run.trainingLogLines?.length ? run.trainingLogLines.join("\n") : "尚未创建训练日志";

  function handleCopyActiveCaption() {
    if (!activeSample) return;
    const caption = activeSample.caption;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(caption).catch(() => undefined);
    }
    setCopiedCaption({ caption, runId: run.id, sampleId: activeSample.id });
  }

  function setActiveSampleOffset(offset: -1 | 1) {
    setActiveSampleState((current) => {
      const index = current?.runId === run.id ? current.index : 0;
      return { index: (index + datasetSamples.length + offset) % datasetSamples.length, runId: run.id };
    });
  }

  function handleQueueRetry() {
    if (!run) return;
    setRetryDraft({
      runId: run.id,
      projectTitle: run.projectTitle,
      title: run.title,
      provider: run.provider ?? (isGeneration ? "生成服务" : "本地训练"),
      queuedAt: new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
      sourceStatus: run.status,
      datasetVersion: project?.datasetVersion,
    });
  }

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/training/runs", label: "返回运行" }}
        title={`${run.projectTitle} / ${run.title}`}
        actions={(
            <>
              <ButtonLink href={projectHref} icon={FileText}>项目详情</ButtonLink>
              {!isGeneration ? <ButtonLink href={datasetHref} icon={History}>数据集版本</ButtonLink> : null}
            {run.status === "failed" && !isRetryQueued ? <Button tone="primary" icon={RotateCcw} onClick={handleQueueRetry} feedback={{ title: "已加入重试队列", detail: run.title }}>重试</Button> : null}
            {isRetryQueued ? <StatusBadge status="pending" label="已排队重试" /> : null}
          </>
        )}
      />

      <section className={s.statusSurface} aria-label="任务状态">
        <div>
          {isRetryQueued ? <StatusBadge status="pending" label="已排队重试" /> : runStatusBadge(run)}
          <strong>{run.provider ?? (isGeneration ? "生成服务" : "本地训练")}</strong>
          <span>{isRetryQueued ? "已加入重试队列，等待训练服务重新调度。" : run.schedulerMessage ?? run.waitReason ?? run.errorMessage ?? run.outputLabel ?? "任务记录已同步"}</span>
        </div>
        <div className={s.progressBlock}>
          <span>{percent}%</span>
          <div className={s.progressTrack} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <i style={{ width: `${percent}%` }} />
          </div>
        </div>
      </section>

      {currentRetryDraft ? (
        <section className={s.retryDraftPanel} aria-label="重试队列草稿">
          <div className={s.retryDraftTop}>
            <div>
              <StatusBadge status="pending" label="重试队列草稿" />
              <strong>{currentRetryDraft.projectTitle} / {currentRetryDraft.title}</strong>
            </div>
            <span>
              <Clock3 aria-hidden="true" />
              {currentRetryDraft.queuedAt}
            </span>
          </div>
          <p>失败记录已整理成本地重试草稿，可继续核对数据集版本、执行服务和失败来源后提交到训练队列。</p>
          <dl className={s.retryDraftMeta}>
            <div><dt>执行服务</dt><dd>{currentRetryDraft.provider}</dd></div>
            <div><dt>来源状态</dt><dd>{currentRetryDraft.sourceStatus === "failed" ? "失败记录" : currentRetryDraft.sourceStatus}</dd></div>
            <div><dt>数据集版本</dt><dd>{currentRetryDraft.datasetVersion ?? "生成任务无数据集版本"}</dd></div>
          </dl>
        </section>
      ) : null}

      <div className={s.detailGrid}>
        <Panel
          title={isGeneration ? "最终输入" : "训练配置"}
          subtitle={isGeneration ? "与生图运行详情一致，只展示最终请求输入，保留来源脉络。" : "训练任务只展示可复现所需配置和数据集版本。"}
        >
          <div className={s.stack}>
            <Field readOnly multiline features={{ clipboard: true }} label={isGeneration ? "最终请求" : "训练参数快照"} value={isGeneration ? run.finalInput ?? "未记录最终输入" : trainingConfigText(run)} />
            {!isGeneration && run.trainingConfig?.length ? (
              <dl className={s.configGrid}>
                {run.trainingConfig.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                    {row.detail ? <span>{row.detail}</span> : null}
                  </div>
                ))}
              </dl>
            ) : null}
            {isGeneration && project ? (
              <div className={s.referenceStrip}>
                <strong>关联项目参考</strong>
                <ImageListSmall images={project.images} limit={4} showCounts />
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel
          title={isGeneration ? "输出" : "训练产物"}
          subtitle={isGeneration ? "文本任务直接展示应用结果，图片任务展示进入结果池的样本。" : "完成后产出模型文件；未完成状态保留进度与日志入口。"}
          actions={canCreatePreset ? <ButtonLink href={createTrainingPresetHref(run)} icon={ImagePlus} tone="primary">创建预制</ButtonLink> : null}
        >
          <div className={s.stack}>
            {run.status === "failed" ? (
              <div className={s.callout} data-tone="danger">
                <AlertTriangle aria-hidden="true" />
                <span>{run.errorMessage}</span>
              </div>
            ) : null}
            {run.status === "queued" ? (
              <div className={s.callout}>
                <Play aria-hidden="true" />
                <span>{run.waitReason ?? "等待训练服务调度"}</span>
              </div>
            ) : null}
            {run.status === "completed" ? (
              <div className={s.callout} data-tone="success">
                <CheckCircle2 aria-hidden="true" />
                <span>{run.outputText ?? run.artifactName ?? run.outputLabel ?? "任务已完成"}</span>
              </div>
            ) : null}
            {!isGeneration ? (
              <dl className={s.statGrid}>
                <div><dt>数据集</dt><dd>{project?.datasetVersion ?? "未记录"}</dd></div>
                <div><dt>图片</dt><dd>{project?.keptCount ?? 0} 张已保留</dd></div>
                <div><dt>LoRA 文件</dt><dd>{run.finalLoraArtifactId ? run.artifactName ?? run.finalLoraArtifactId : "尚未生成 LoRA 文件"}</dd></div>
                <div><dt>预制</dt><dd>{canCreatePreset ? "可创建" : run.presetCreatedAt ? "已创建" : "等待 LoRA 文件"}</dd></div>
              </dl>
            ) : null}
          </div>
        </Panel>
      </div>

      {!isGeneration ? (
        <div className={s.trainingEvidenceGrid}>
          <Panel
            title="训练集样本"
            subtitle="冻结数据集的缩略图与说明快照；点击后按审核图方式放大。"
          >
            {datasetSamples.length > 0 ? (
              <div className={s.trainingSampleGrid}>
                {datasetSamples.map((sample, index) => (
                  <button
                    className={s.trainingSampleCard}
                    data-status={sample.status}
                    key={sample.id}
                    type="button"
                    onClick={() => setActiveSampleState({ index, runId: run.id })}
                  >
                    <ImagePreviewFrame image={sample.image} />
                    <span className={s.sampleMeta}>
                      <strong>{sample.label}</strong>
                      <em>{sample.sectionTitle}</em>
                    </span>
                    <p className={s.sampleCaption}>{sample.caption}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className={s.empty}>当前训练任务没有冻结样本</div>
            )}
          </Panel>

          <Panel
            title="训练日志"
            subtitle={run.trainingLogArtifactName ? `日志文件 ${run.trainingLogArtifactName}` : "训练服务日志预览"}
          >
            <pre className={s.trainingLog}>{logText}</pre>
          </Panel>
        </div>
      ) : null}

      {activeSample ? (
        <ImagePreviewLarge
          image={activeSample.image}
          title={`${activeSample.label} · ${activeSample.sectionTitle}`}
          meta={activeSample.caption}
          onClose={() => setActiveSampleState(null)}
          onNext={() => setActiveSampleOffset(1)}
          onPrevious={() => setActiveSampleOffset(-1)}
          actions={(
            <Button
              icon={Copy}
              onClick={handleCopyActiveCaption}
              pressed={isActiveCaptionCopied}
              ariaLabel={`复制说明文本：${activeSample.label}`}
              feedback={{ title: isActiveCaptionCopied ? "说明文本已再次复制" : "说明文本已复制", detail: activeSample.caption }}
            >
              {isActiveCaptionCopied ? "已复制说明文本" : "复制说明文本"}
            </Button>
          )}
        />
      ) : null}
    </div>
  );
}
