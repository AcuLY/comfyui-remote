"use client";

import { usePathname } from "next/navigation";

import { resolveTrainingShellData } from "@/features/training/data";
import type { TrainingAppData } from "@/features/training/data";
import { TrainingShell, matchRoute, NotFoundPage } from "@/features/training/runtime";
import type { Match, TrainingTheme } from "@/features/training/runtime";
import {
  LoraTrainingGenerationComposePage,
  LoraTrainingPresetDetailPage,
  LoraTrainingPresetsPage,
  LoraTrainingPresetSortRulesPage,
  LoraTrainingProjectDatasetPage,
  LoraTrainingProjectDatasetRevisionPage,
  LoraTrainingProjectDetailPage,
  LoraTrainingProjectFormPage,
  LoraTrainingProjectProfilePage,
  LoraTrainingProjectResultsPage,
  LoraTrainingProjectsPage,
  LoraTrainingProjectScopedRunsPage,
  LoraTrainingProjectSectionDetailPage,
  LoraTrainingProjectSectionsPage,
  LoraTrainingRunDetailPage,
  LoraTrainingRunsPage,
  LoraTrainingTemplateFormPage,
  LoraTrainingTemplatesPage,
  LoraTrainingTemplateSectionPage,
} from "@/features/training/ui";

function CurrentTrainingPage({ data, match }: { data: TrainingAppData; match: Match }) {
  switch (match.key) {
    case "training-runs":
      return <LoraTrainingRunsPage data={data} />;
    case "training-generation-run-detail":
      return <LoraTrainingRunDetailPage data={data} kind="generation" runId={match.params.taskId} />;
    case "training-training-run-detail":
      return <LoraTrainingRunDetailPage data={data} kind="training" runId={match.params.trainingRunId} />;
    case "training-projects":
      return <LoraTrainingProjectsPage data={data} />;
    case "training-project-new":
      return <LoraTrainingProjectFormPage data={data} />;
    case "training-project-detail":
      return <LoraTrainingProjectDetailPage data={data} projectId={match.params.trainingProjectId} />;
    case "training-project-profile":
      return <LoraTrainingProjectProfilePage data={data} projectId={match.params.trainingProjectId} />;
    case "training-project-sections":
      return <LoraTrainingProjectSectionsPage data={data} projectId={match.params.trainingProjectId} />;
    case "training-project-section-detail":
      return <LoraTrainingProjectSectionDetailPage data={data} projectId={match.params.trainingProjectId} sectionId={match.params.sectionId} />;
    case "training-generation-compose":
      return <LoraTrainingGenerationComposePage data={data} projectId={match.params.trainingProjectId} sectionId={match.params.sectionId} />;
    case "training-project-results":
      return <LoraTrainingProjectResultsPage data={data} projectId={match.params.trainingProjectId} />;
    case "training-project-dataset":
      return <LoraTrainingProjectDatasetPage data={data} projectId={match.params.trainingProjectId} />;
    case "training-project-dataset-revision":
      return <LoraTrainingProjectDatasetRevisionPage data={data} projectId={match.params.trainingProjectId} revisionId={match.params.revisionId} />;
    case "training-project-training-runs":
      return <LoraTrainingProjectScopedRunsPage data={data} kind="training" projectId={match.params.trainingProjectId} />;
    case "training-project-generation-tasks":
      return <LoraTrainingProjectScopedRunsPage data={data} kind="generation" projectId={match.params.trainingProjectId} />;
    case "training-presets":
      return <LoraTrainingPresetsPage data={data} />;
    case "training-preset-new":
      return <LoraTrainingPresetDetailPage data={data} mode="new" />;
    case "training-preset-detail":
      return <LoraTrainingPresetDetailPage data={data} presetId={match.params.presetId} />;
    case "training-preset-sort-rules":
      return <LoraTrainingPresetSortRulesPage data={data} />;
    case "training-templates":
      return <LoraTrainingTemplatesPage data={data} />;
    case "training-template-new":
      return <LoraTrainingTemplateFormPage data={data} mode="new" />;
    case "training-template-edit":
      return <LoraTrainingTemplateFormPage data={data} mode="edit" templateId={match.params.templateId} />;
    case "training-template-section":
      return <LoraTrainingTemplateSectionPage data={data} templateId={match.params.templateId} sectionIndex={match.params.sectionIndex} />;
    default:
      return <NotFoundPage route={match.route} />;
  }
}

export function TrainingApp({
  data,
  initialTheme,
}: {
  data: TrainingAppData;
  initialTheme: TrainingTheme;
}) {
  const pathname = usePathname();
  const currentRoute = pathname === "/training" ? "/training/runs" : pathname ?? "/training/runs";
  const match = matchRoute(currentRoute);
  const shellData = resolveTrainingShellData(data) ?? (data as never);

  return (
    <TrainingShell
      currentRoute={currentRoute}
      data={shellData}
      hrefForRoute={(route) => route}
      initialTheme={initialTheme}
    >
      <CurrentTrainingPage data={data} match={match} />
    </TrainingShell>
  );
}
