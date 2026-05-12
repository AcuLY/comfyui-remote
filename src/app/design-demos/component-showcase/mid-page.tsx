"use client";

import { Check, Plus, Settings, Shuffle, Trash2, Wand2 } from "lucide-react";

import type { DemoData } from "../design-demo-data";
import s from "./mid-page.showcase.module.css";
import { KSamplerCard } from "../section-editor-controls";
import { CurrentRunningProgressCard } from "../runs/current-running-progress-card";
import { QueueMetrics } from "../runs/queue-metrics";
import type { DemoCurrentRun } from "../runs/types";
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
      <PageHeader back={{ href: "/component-showcase", label: "返回总览" }} eyebrow="组件展示" title="中组件" subtitle="8 个中型组件" />

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
