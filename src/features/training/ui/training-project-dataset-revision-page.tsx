"use client";

import { EmptyPage } from "@/components/design-demo-ui/primitives/empty-page";
import { Panel } from "@/components/design-demo-ui/primitives/panel";
import { buildLoraTrainingData } from "@/features/training/build";
import type { TrainingAppData } from "@/features/training/data";

import { findProject } from "./project-page-utils";
import { ProjectHeader } from "./project-page-shell";
import { RunRows } from "./project-run-rows";
import { TrainingResultGrid } from "./training-result-grid";
import s from "./training-project-pages.module.css";

function useTraining(data: TrainingAppData) {
  return buildLoraTrainingData(data);
}

export function LoraTrainingProjectDatasetRevisionPage({ data, projectId, revisionId }: { data: TrainingAppData; projectId?: string; revisionId?: string }) {
  const training = useTraining(data);
  const project = findProject(data, projectId);
  const revision = project?.datasetRevisions.find((item) => item.id === revisionId);
  if (!project || !revision) return <EmptyPage title="没有冻结版本数据" />;
  const revisionResults = revision.samples.map((sample) => ({
    id: sample.id,
    sectionId: sample.sectionTitle,
    sectionTitle: sample.sectionTitle,
    image: sample.image,
    reviewStatus: "kept" as const,
    caption: sample.captionSnapshot,
    sourceLabel: `${sample.label} · ${sample.filePathSnapshot}`,
  }));
  const relatedRuns = training.runs.filter((run) => revision.relatedTrainingRunIds.includes(run.id) || run.datasetRevisionId === revision.id);

  return (
    <div className={s.page}>
      <ProjectHeader active="dataset" project={project} title={`${project.title} / 数据集 ${revision.version}`} />
      <div className={s.twoCol}>
        <Panel title="版本快照">
          <dl className={s.statGrid}>
            <div><dt>状态</dt><dd>{revision.status}</dd></div>
            <div><dt>图片</dt><dd>{revision.itemCount} 张</dd></div>
            <div><dt>缺说明文本</dt><dd>{revision.captionMissingCount}</dd></div>
            <div><dt>文件清单</dt><dd>{revision.manifestName}</dd></div>
          </dl>
        </Panel>
        <Panel title="关联训练">
          <RunRows project={project} runs={relatedRuns} />
        </Panel>
      </div>
      <Panel title="样本快照与说明文本">
        <TrainingResultGrid results={revisionResults} title={`${revision.version} 样本快照`} />
      </Panel>
      <Panel title="文件清单">
        <div className={s.manifestListSurface}>
          <ol className={s.manifestList}>
            {revision.manifestRows.map((row) => <li key={row}>{row}</li>)}
          </ol>
        </div>
      </Panel>
    </div>
  );
}
