import {
  Activity,
  Copy,
  Database,
  FolderTree,
  ListChecks,
  Play,
  Plus,
  Shuffle,
  Wand2,
} from "lucide-react";

import type { HeaderAction, HeaderActionTone, HeaderSpec } from "@/components/design-demo-shell/header-types";
import type { TrainingShellData, TrainingShellProject } from "./data";
import { matchRoute, type Match } from "./routes";

type TrainingShellSection = TrainingShellProject["sections"][number];
type TrainingShellDatasetRevision = TrainingShellProject["datasetRevisions"][number];

function headerAction(
  label: string,
  icon: HeaderAction["icon"],
  tone: HeaderActionTone = "default",
  href?: string,
): HeaderAction {
  return { label, icon, tone, href };
}

function trainingData(data: TrainingShellData) {
  return data.training;
}

function findProject(data: TrainingShellData, projectId?: string): TrainingShellProject | undefined {
  return trainingData(data).projects.find((project) => project.id === projectId);
}

function findProjectByDatasetRevision(
  data: TrainingShellData,
  revisionId?: string,
): { project: TrainingShellProject; revision: TrainingShellDatasetRevision } | null {
  for (const project of trainingData(data).projects) {
    const revision = project.datasetRevisions.find((item) => item.id === revisionId);
    if (revision) return { project, revision };
  }
  return null;
}

function findSection(project: TrainingShellProject | undefined, sectionId?: string): TrainingShellSection | undefined {
  return project?.sections.find((section) => section.id === sectionId);
}

function projectTitle(data: TrainingShellData, projectId?: string) {
  return findProject(data, projectId)?.title ?? "训练项目";
}

function sectionTitle(project: TrainingShellProject | undefined, sectionId?: string) {
  return findSection(project, sectionId)?.title ?? "训练小节";
}

function projectBack(projectId?: string) {
  return projectId ? { href: `/training/projects/${projectId}`, label: "返回项目" } : { href: "/training/projects", label: "返回项目" };
}

function projectMeta(project: TrainingShellProject | undefined) {
  if (!project) return undefined;
  return [
    `${project.sectionCount} 小节`,
    `${project.keptCount} 已保留`,
    `${project.captionMissingCount} 缺说明文本`,
  ];
}

function projectRouteSpec(data: TrainingShellData, match: Match): HeaderSpec {
  const projectId = match.params.trainingProjectId;
  const project = findProject(data, projectId);
  const title = projectTitle(data, projectId);

  switch (match.key) {
    case "training-project-detail":
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: "训练项目",
        title,
        subtitle: project?.profileSummary || "角色资料、数据集、生成任务和训练入口。",
        back: { href: "/training/projects", label: "返回项目列表" },
        actions: [
          headerAction("启动训练", Play, "primary", `/training/projects/${projectId}/dataset`),
          headerAction("保存为模板", Copy, "default", "/training/templates/new"),
        ],
        meta: projectMeta(project),
        status: project?.status ?? "项目总览",
      };
    case "training-project-profile":
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: "角色资料",
        title,
        subtitle: "维护角色描述、触发词、用途提示和参考图。",
        back: projectBack(projectId),
        meta: projectMeta(project),
        status: "资料",
      };
    case "training-project-sections":
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: "训练小节",
        title,
        subtitle: "管理训练集生成小节和场景描述块。",
        back: projectBack(projectId),
        actions: [
          headerAction("新增生成任务", Plus, "primary", `/training/projects/${projectId}/generation-tasks`),
        ],
        meta: projectMeta(project),
        status: "小节",
      };
    case "training-project-section-detail": {
      const section = findSection(project, match.params.sectionId);
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: title,
        title: sectionTitle(project, match.params.sectionId),
        subtitle: section?.resolvedScene ?? "编辑训练小节的场景描述和生成提示。",
        back: { href: `/training/projects/${projectId}/sections`, label: "返回小节" },
        actions: [
          headerAction(
            "生成图片",
            Wand2,
            "primary",
            `/training/projects/${projectId}/sections/${match.params.sectionId}/generation-tasks/new`,
          ),
        ],
        meta: section ? [`${section.blockCount} 块`, `${section.imageCount} 张`, section.resultStatus] : undefined,
        status: "小节详情",
      };
    }
    case "training-generation-compose": {
      const section = findSection(project, match.params.sectionId);
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: "图片生成",
        title: sectionTitle(project, match.params.sectionId),
        subtitle: "基于训练小节生成候选训练集图片。",
        back: { href: `/training/projects/${projectId}/sections/${match.params.sectionId}`, label: "返回小节" },
        meta: section ? [`${section.blockCount} 块`, `${section.imageCount} 张`] : undefined,
        status: "新建生成任务",
      };
    }
    case "training-project-results":
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: "结果池",
        title,
        subtitle: "审核、保留和补全说明文本的训练集候选图片。",
        back: projectBack(projectId),
        meta: project ? [`${project.resultCount} 结果`, `${project.keptCount} 已保留`] : undefined,
        status: "结果池",
      };
    case "training-project-dataset":
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: "数据集",
        title,
        subtitle: "冻结数据集版本并检查训练前准备状态。",
        back: projectBack(projectId),
        actions: [headerAction("训练记录", Activity, "default", `/training/projects/${projectId}/training-runs`)],
        meta: project ? [project.datasetVersion, project.readiness, `${project.datasetRevisionCount} 版本`] : undefined,
        status: "数据集",
      };
    case "training-project-training-runs":
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: "训练任务",
        title,
        subtitle: "查看项目下 LoRA 训练任务、日志和产物。",
        back: projectBack(projectId),
        actions: [headerAction("数据集", Database, "default", `/training/projects/${projectId}/dataset`)],
        meta: projectMeta(project),
        status: "训练记录",
      };
    case "training-project-generation-tasks":
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: "生成任务",
        title,
        subtitle: "查看项目下训练集图片生成任务。",
        back: projectBack(projectId),
        actions: [headerAction("小节", ListChecks, "default", `/training/projects/${projectId}/sections`)],
        meta: projectMeta(project),
        status: "生成任务",
      };
    default:
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: "训练项目",
        title,
        back: projectBack(projectId),
        meta: projectMeta(project),
        status: "训练项目",
      };
  }
}

export function findTrainingHeaderSpecForRoute(data: TrainingShellData, route: string): HeaderSpec | null {
  const match = matchRoute(route);
  const training = trainingData(data);

  switch (match.key) {
    case "not-found":
      return null;
    case "training-runs": {
      const generationRuns = training.runs.filter((run) => run.kind === "generation").length;
      const trainingRuns = training.runs.filter((run) => run.kind === "training").length;
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: "运行",
        title: "运行",
        subtitle: "训练集图片生成、角色描述文本和 LoRA 训练任务集中处理。",
        meta: [`生成 ${generationRuns}`, `训练 ${trainingRuns}`, `总计 ${training.runs.length}`],
        status: "任务队列",
      };
    }
    case "training-generation-run-detail":
    case "training-training-run-detail": {
      const runId = match.params.taskId ?? match.params.trainingRunId;
      const run = training.runs.find((item) => item.id === runId);
      const isTrainingRun = match.key === "training-training-run-detail";
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: isTrainingRun ? "训练任务" : "生成任务",
        title: run?.title ?? (isTrainingRun ? "训练任务详情" : "生成任务详情"),
        subtitle: run?.summary ?? "查看任务输入、进度、输出和错误信息。",
        back: { href: "/training/runs", label: "返回运行" },
        actions: run?.projectId
          ? [headerAction("项目详情", FolderTree, "default", `/training/projects/${run.projectId}`)]
          : undefined,
        meta: run ? [run.projectTitle, run.timestamp, run.status] : undefined,
        status: isTrainingRun ? "训练详情" : "生成详情",
      };
    }
    case "training-projects":
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: "项目",
        title: "项目",
        subtitle: "管理角色资料、最近结果、数据集版本和训练入口。",
        actions: [headerAction("新建项目", Plus, "primary", "/training/projects/new")],
        meta: [`当前 ${training.projects.filter((project) => project.status !== "archived").length}`, `已归档 ${training.projects.filter((project) => project.status === "archived").length}`],
        status: "训练项目",
      };
    case "training-project-new":
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: "训练项目",
        title: "新建训练项目",
        subtitle: "选择模板、填写角色资料，并创建初始小节。",
        back: { href: "/training/projects", label: "返回项目" },
        status: "新建",
      };
    case "training-project-detail":
    case "training-project-profile":
    case "training-project-sections":
    case "training-project-section-detail":
    case "training-generation-compose":
    case "training-project-results":
    case "training-project-dataset":
    case "training-project-training-runs":
    case "training-project-generation-tasks":
      return projectRouteSpec(data, match);
    case "training-project-dataset-revision": {
      const found = findProjectByDatasetRevision(data, match.params.revisionId);
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: found?.project.title ?? "数据集版本",
        title: found?.revision.version ?? "数据集版本",
        subtitle: "查看冻结数据集样本、说明文本快照和关联训练任务。",
        back: found
          ? { href: `/training/projects/${found.project.id}/dataset`, label: "返回数据集" }
          : { href: "/training/projects", label: "返回项目" },
        meta: found ? [`${found.revision.itemCount} 样本`, `${found.revision.captionMissingCount} 缺说明文本`, found.revision.status] : undefined,
        status: "数据集版本",
      };
    }
    case "training-presets":
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: "预制",
        title: "训练预制",
        subtitle: "管理训练模块专用的场景描述预制。",
        actions: [
          headerAction("排序规则", Shuffle, "default", "/training/presets/sort-rules"),
          headerAction("新建预制", Plus, "primary", "/training/presets/new"),
        ],
        meta: [`${training.presets.length} 个预制`],
        status: "训练预制",
      };
    case "training-preset-new":
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: "训练预制",
        title: "新建训练预制",
        subtitle: "保存可复用的训练场景描述。",
        back: { href: "/training/presets", label: "返回预制" },
        status: "新建",
      };
    case "training-preset-detail": {
      const preset = training.presets.find((item) => item.id === match.params.presetId);
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: preset?.category ?? "训练预制",
        title: preset?.title ?? "训练预制",
        subtitle: preset?.sceneDescriptionText ?? "编辑训练场景描述预制。",
        back: { href: "/training/presets", label: "返回预制" },
        meta: preset ? [preset.folder, `${preset.projectUsage.length} 项目`, `${preset.templateUsage.length} 模板`] : undefined,
        status: preset?.status ?? "预制详情",
      };
    }
    case "training-preset-sort-rules":
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: "训练预制",
        title: "排序规则",
        subtitle: "调整训练预制分类和场景描述的展示顺序。",
        back: { href: "/training/presets", label: "返回预制" },
        status: "排序",
      };
    case "training-templates":
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: "模板",
        title: "训练模板",
        subtitle: "管理训练项目模板、小节和默认生成说明。",
        actions: [headerAction("新建模板", Plus, "primary", "/training/templates/new")],
        meta: [`${training.templates.length} 个模板`],
        status: "训练模板",
      };
    case "training-template-new":
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: "训练模板",
        title: "新建训练模板",
        subtitle: "创建可复用的训练小节结构和默认说明。",
        back: { href: "/training/templates", label: "返回模板" },
        status: "新建",
      };
    case "training-template-edit": {
      const template = training.templates.find((item) => item.id === match.params.templateId);
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: "训练模板",
        title: template?.title ?? "训练模板",
        subtitle: template?.description ?? "编辑训练模板信息和小节。",
        back: { href: "/training/templates", label: "返回模板" },
        meta: template ? [`${template.sectionCount} 小节`, template.status] : undefined,
        status: "模板编辑",
      };
    }
    case "training-template-section": {
      const template = training.templates.find((item) => item.id === match.params.templateId);
      const sectionIndex = Number(match.params.sectionIndex);
      const section = Number.isInteger(sectionIndex) ? template?.sections[sectionIndex] : undefined;
      return {
        key: match.key,
        route: match.route,
        group: "LoRA 训练",
        eyebrow: template?.title ?? "训练模板",
        title: section?.title ?? "模板小节",
        subtitle: section?.scenePreview ?? "编辑模板小节的场景描述块。",
        back: { href: `/training/templates/${match.params.templateId}/edit`, label: "返回模板" },
        meta: section ? [`${section.blockCount} 块`, section.enabled ? "启用" : "停用"] : undefined,
        status: "模板小节",
      };
    }
  }
}
