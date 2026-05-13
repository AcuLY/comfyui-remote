"use client";

import { Check, Plus, Settings, Shuffle, Trash2, Wand2 } from "lucide-react";

import type { DemoData, DemoRun } from "../design-demo-data";
import s from "./mid-page.showcase.module.css";
import { KSamplerCard } from "../section-editor-controls";
import { CurrentRunningProgressCard } from "../runs/current-running-progress-card";
import { DemoPager } from "../runs/demo-pager";
import { PendingReviewGroups } from "../runs/pending-review-groups";
import { QueueMetrics } from "../runs/queue-metrics";
import { ReviewMetaCard } from "../runs/review-meta-card";
import { RunList } from "../runs/run-list";
import type { DemoCurrentRun, QueueProjectGroup, QueueReviewRow } from "../runs/types";
import { Button } from "../ui/button";
import { DemoFeedbackProvider } from "../ui/feedback";
import { EmptyPage } from "../ui/empty-page";
import { Field } from "../ui/field";
import { PageHeader } from "../ui/page-header";
import { Panel } from "../ui/panel";
import { RouteTable } from "../ui/route-table";
import { ShowcaseItem } from "./showcase-item";

export function ComponentShowcaseMid({ data }: { data: DemoData }) {
  return (
    <div className={s.showcasePage}>
      <PageHeader back={{ href: "/component-showcase", label: "返回总览" }} eyebrow="组件展示" title="中组件" subtitle="12 个中型组件" />

      {/* 2.1 PageHeader */}
      <ShowcaseItem name="PageHeader" desc="页面顶部标题栏">
        <PageHeader eyebrow="项目" title="夏日人像合集" subtitle="12 个小节 · 3 个预制" actions={<><Button tone="primary" icon={Plus}>新增小节</Button><Button icon={Settings}>设置</Button></>} />
        <hr className={s.showcaseDivider} />
        <PageHeader back={{ href: "/design-demos/projects", label: "返回项目" }} eyebrow="小节" title="肖像 - 女性角色" subtitle="2:3 · 512×768 · 4 张" />
      </ShowcaseItem>

      {/* 2.2 Panel */}
      <ShowcaseItem name="Panel" desc="面板容器">
        <Panel title="采样参数" subtitle="调整 KSampler 参数" actions={<Button tone="subtle" icon={Shuffle}>随机种子</Button>}>
          <div className={s.showcaseRow}>
            <Field label="Steps" value={20} />
            <Field label="CFG" value={7} />
            <Field label="Denoise" value={0.85} />
          </div>
        </Panel>
      </ShowcaseItem>

      {/* 2.3 RouteTable */}
      <ShowcaseItem name="RouteTable" desc="完整页面路径表格">
        <RouteTable data={data} />
      </ShowcaseItem>

      {/* 2.4 DemoFeedbackProvider / Toast */}
      <ShowcaseItem name="DemoFeedbackProvider" desc="Toast 提示 Context Provider">
        <DemoFeedbackProvider>
          <ToastDemoButtons />
        </DemoFeedbackProvider>
      </ShowcaseItem>

      {/* 2.5 EmptyPage */}
      <ShowcaseItem name="EmptyPage" desc="空状态页面">
        <EmptyPage title="暂无数据" />
      </ShowcaseItem>

      {/* 2.6 KSamplerCard */}
      <ShowcaseItem name="KSamplerCard" desc="KSampler 参数卡片">
        <KSamplerCard
          label="KSampler 1"
          hint="第一次采样"
          params={{
            steps: 20,
            cfg: 7,
            denoise: 0.85,
            sampler_name: "euler",
            scheduler: "normal",
            seedPolicy: "randomize",
          }}
        />
        <hr className={s.showcaseDivider} />
        <KSamplerCard
          label="KSampler 2"
          hint="第二次采样（可禁用）"
          params={{
            steps: 12,
            cfg: 4,
            denoise: 0.5,
            sampler_name: "dpmpp_2m",
            scheduler: "karras",
            seedPolicy: "fixed",
          }}
          disabled
        />
      </ShowcaseItem>

      {/* 2.7 QueueMetrics */}
      <ShowcaseItem name="QueueMetrics" desc="队列指标卡片区">
        <QueueMetrics pendingImages={48} reviewGroups={3} runningCount={2} failedCount={1} />
      </ShowcaseItem>

      {/* 2.8 CurrentRunningProgressCard */}
      <ShowcaseItem name="CurrentRunningProgressCard" desc="当前运行任务进度卡片">
        <CurrentRunningProgressCard runs={MOCK_CURRENT_RUNS} />
      </ShowcaseItem>

      {/* 2.9 DemoPager */}
      <ShowcaseItem name="DemoPager" desc="分页器控件">
        <div className={s.showcaseStack}>
          <DemoPager currentPage={1} totalPages={1} />
          <hr className={s.showcaseDivider} />
          <DemoPager currentPage={3} totalPages={10} />
          <hr className={s.showcaseDivider} />
          <DemoPager currentPage={10} totalPages={10} />
        </div>
      </ShowcaseItem>

      {/* 2.10 RunList */}
      <ShowcaseItem name="RunList" desc="运行/失败任务列表（可分组、选择、批量操作）">
        <div className={s.showcaseStack}>
          <RunList title="运行中" runs={MOCK_RUNNING_RUNS} empty="暂无运行中任务" mode="running" collapsedGroups={new Set()} onToggleGroup={() => {}} />
          <hr className={s.showcaseDivider} />
          <RunList title="失败" runs={MOCK_FAILED_RUNS} empty="暂无失败任务" mode="failed" collapsedGroups={new Set()} onToggleGroup={() => {}} />
        </div>
      </ShowcaseItem>

      {/* 2.11 PendingReviewGroups */}
      <ShowcaseItem name="PendingReviewGroups" desc="待审核分组列表（按项目折叠 + 分页）">
        <PendingReviewGroups
          groups={MOCK_REVIEW_GROUPS}
          reviewRows={MOCK_REVIEW_ROWS}
          totalPending={12}
          totalPages={2}
          collapsedGroups={new Set()}
          onToggleGroup={() => {}}
        />
      </ShowcaseItem>

      {/* 2.12 ReviewMetaCard */}
      <ShowcaseItem name="ReviewMetaCard" desc="运行参数信息卡片（可折叠，含 KSampler/Prompt/LoRA）">
        <div className={s.showcaseStack}>
          <ReviewMetaCard section={{ name: "肖像 - 女性角色" }} run={MOCK_REVIEW_RUN} meta={MOCK_REVIEW_RUN.executionMeta} />
          <hr className={s.showcaseDivider} />
          <ReviewMetaCard section={{ name: "风景写意" }} run={MOCK_REVIEW_RUN_SIMPLE} meta={null} />
        </div>
      </ShowcaseItem>
    </div>
  );
}

function ToastDemoButtons() {
  return (
    <div className={s.showcaseRow}>
      <Button icon={Check} feedback={{ title: "保存成功", detail: "参数已更新" }}>触发成功 Toast</Button>
      <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "已加入删除队列", detail: "3 张图片" }}>触发警告 Toast</Button>
      <Button tone="primary" icon={Wand2} feedback={{ tone: "error", title: "操作失败", detail: "请重试" }}>触发错误 Toast</Button>
    </div>
  );
}

const MOCK_CURRENT_RUNS: DemoCurrentRun[] = [
  {
    run: { id: "r1", projectId: "p1", sectionId: "s1", projectTitle: "夏日人像合集", sectionName: "肖像 - 女性角色", status: "running", runIndex: 3, createdAt: "2026-05-11 10:00", startedAt: "2026-05-11 10:01", finishedAt: null, errorMessage: null, imageCount: 0, pendingCount: 0, executionMeta: null, images: [] },
    progress: { percent: 65, currentStep: 13, totalSteps: 20, elapsed: "45s", remaining: "24s", rate: "0.29 it/s", stage: 1 },
  },
  {
    run: { id: "r2", projectId: "p2", sectionId: "s2", projectTitle: "风景写意", sectionName: "山川晨雾", status: "running", runIndex: 1, createdAt: "2026-05-11 09:55", startedAt: "2026-05-11 09:56", finishedAt: null, errorMessage: null, imageCount: 0, pendingCount: 0, executionMeta: null, images: [] },
    progress: { percent: 100, currentStep: 20, totalSteps: 20, elapsed: "1m 12s", remaining: null, rate: "0.28 it/s", stage: 2 },
  },
];

const MOCK_RUNNING_RUNS: DemoRun[] = [
  { id: "r1", projectId: "p1", sectionId: "s1", projectTitle: "夏日人像合集", sectionName: "肖像 - 女性角色", status: "running", runIndex: 3, createdAt: "2026-05-11 10:00", startedAt: "2026-05-11 10:01", finishedAt: null, errorMessage: null, imageCount: 4, pendingCount: 0, executionMeta: null, images: [] },
  { id: "r2", projectId: "p1", sectionId: "s3", projectTitle: "夏日人像合集", sectionName: "全身照 - 街景", status: "queued", runIndex: 5, createdAt: "2026-05-11 10:05", startedAt: null, finishedAt: null, errorMessage: null, imageCount: 2, pendingCount: 0, executionMeta: null, images: [] },
  { id: "r3", projectId: "p2", sectionId: "s2", projectTitle: "风景写意", sectionName: "山川晨雾", status: "running", runIndex: 1, createdAt: "2026-05-11 09:55", startedAt: "2026-05-11 09:56", finishedAt: null, errorMessage: null, imageCount: 0, pendingCount: 0, executionMeta: null, images: [] },
];

const MOCK_FAILED_RUNS: DemoRun[] = [
  { id: "f1", projectId: "p1", sectionId: "s1", projectTitle: "夏日人像合集", sectionName: "特写 - 眼部", status: "failed", runIndex: 2, createdAt: "2026-05-11 09:30", startedAt: "2026-05-11 09:31", finishedAt: "2026-05-11 09:32", errorMessage: "ComfyUI 返回空结果或连接超时", imageCount: 0, pendingCount: 0, executionMeta: null, images: [] },
  { id: "f2", projectId: "p2", sectionId: "s2", projectTitle: "风景写意", sectionName: "溪流石径", status: "failed", runIndex: 4, createdAt: "2026-05-11 08:20", startedAt: "2026-05-11 08:21", finishedAt: "2026-05-11 08:22", errorMessage: "CUDA out of memory", imageCount: 0, pendingCount: 0, executionMeta: null, images: [] },
];

const MOCK_REVIEW_ROWS: QueueReviewRow[] = [
  { run: { id: "rv1", projectId: "p1", sectionId: "s1", projectTitle: "夏日人像合集", sectionName: "肖像 - 女性角色", status: "success", runIndex: 3, createdAt: "2026-05-11 10:00", startedAt: "2026-05-11 10:01", finishedAt: "2026-05-11 10:05", errorMessage: null, imageCount: 4, pendingCount: 3, executionMeta: null, images: [] }, pendingCount: 3 },
  { run: { id: "rv2", projectId: "p1", sectionId: "s3", projectTitle: "夏日人像合集", sectionName: "全身照 - 街景", status: "success", runIndex: 5, createdAt: "2026-05-11 10:05", startedAt: "2026-05-11 10:06", finishedAt: "2026-05-11 10:10", errorMessage: null, imageCount: 2, pendingCount: 2, executionMeta: null, images: [] }, pendingCount: 2 },
  { run: { id: "rv3", projectId: "p2", sectionId: "s2", projectTitle: "风景写意", sectionName: "山川晨雾", status: "success", runIndex: 1, createdAt: "2026-05-11 09:55", startedAt: "2026-05-11 09:56", finishedAt: "2026-05-11 10:02", errorMessage: null, imageCount: 6, pendingCount: 4, executionMeta: null, images: [] }, pendingCount: 4 },
  { run: { id: "rv4", projectId: "p2", sectionId: "s4", projectTitle: "风景写意", sectionName: "溪流石径", status: "success", runIndex: 2, createdAt: "2026-05-11 09:40", startedAt: "2026-05-11 09:41", finishedAt: "2026-05-11 09:48", errorMessage: null, imageCount: 3, pendingCount: 3, executionMeta: null, images: [] }, pendingCount: 3 },
];

const MOCK_REVIEW_GROUPS: QueueProjectGroup<QueueReviewRow>[] = [
  { id: "p1", title: "夏日人像合集", latestCreatedAt: "2026-05-11 10:05", rows: MOCK_REVIEW_ROWS.filter((r) => r.run.projectId === "p1") },
  { id: "p2", title: "风景写意", latestCreatedAt: "2026-05-11 09:55", rows: MOCK_REVIEW_ROWS.filter((r) => r.run.projectId === "p2") },
];

const MOCK_REVIEW_RUN: DemoRun = {
  id: "rv1", projectId: "p1", sectionId: "s1", projectTitle: "夏日人像合集", sectionName: "肖像 - 女性角色",
  status: "success", runIndex: 3, createdAt: "2026-05-11 10:00", startedAt: "2026-05-11 10:01", finishedAt: "2026-05-11 10:05",
  errorMessage: null, imageCount: 4, pendingCount: 3, images: [],
  executionMeta: {
    ks1Seed: "3847562109", ks1Steps: 20, ks1Cfg: 7, ks1Denoise: 1, ks1Sampler: "euler",
    ks2Steps: 12, ks2Cfg: 4, ks2Denoise: 0.5, ks2Sampler: "dpmpp_2m",
    aspectRatio: "2:3", shortSidePx: 512, batchSize: 4, upscaleFactor: 2,
    checkpointName: "dreamshaper_v8.safetensors", workflowId: "workflow-portrait-v2",
    lora1: [{ path: "add_detail.safetensors", weight: 0.8, enabled: true }, { path: "skin_texture.safetensors", weight: 0.5, enabled: true }],
    lora2: [{ path: "sharp_details.safetensors", weight: 0.6, enabled: true }],
    positivePrompt: "masterpiece, best quality, 1girl, portrait BREAK detailed skin, realistic lighting",
    negativePrompt: "lowres, bad anatomy, bad hands, worst quality",
  },
};

const MOCK_REVIEW_RUN_SIMPLE: DemoRun = {
  id: "rv2", projectId: "p2", sectionId: "s2", projectTitle: "风景写意", sectionName: "山川晨雾",
  status: "success", runIndex: 1, createdAt: "2026-05-11 09:55", startedAt: "2026-05-11 09:56", finishedAt: "2026-05-11 10:02",
  errorMessage: null, imageCount: 6, pendingCount: 4, executionMeta: null, images: [],
};
