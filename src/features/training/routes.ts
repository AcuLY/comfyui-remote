export type TrainingRouteKey =
  | "training-runs"
  | "training-generation-run-detail"
  | "training-training-run-detail"
  | "training-projects"
  | "training-project-new"
  | "training-project-detail"
  | "training-project-profile"
  | "training-project-sections"
  | "training-project-section-detail"
  | "training-generation-compose"
  | "training-project-results"
  | "training-project-dataset"
  | "training-project-dataset-revision"
  | "training-project-training-runs"
  | "training-project-generation-tasks"
  | "training-presets"
  | "training-preset-new"
  | "training-preset-detail"
  | "training-preset-sort-rules"
  | "training-templates"
  | "training-template-new"
  | "training-template-edit"
  | "training-template-section"
  | "not-found";

export type Match = {
  key: TrainingRouteKey;
  params: Record<string, string>;
  route: string;
};

const TRAINING_ROUTE_PATTERNS: Array<{ key: Exclude<TrainingRouteKey, "not-found">; pattern: string }> = [
  { key: "training-generation-run-detail", pattern: "/training/runs/generation/:taskId" },
  { key: "training-training-run-detail", pattern: "/training/runs/training/:trainingRunId" },
  { key: "training-runs", pattern: "/training/runs" },
  { key: "training-project-new", pattern: "/training/projects/new" },
  { key: "training-generation-compose", pattern: "/training/projects/:trainingProjectId/sections/:sectionId/generation-tasks/new" },
  { key: "training-project-dataset-revision", pattern: "/training/projects/:trainingProjectId/dataset/revisions/:revisionId" },
  { key: "training-project-section-detail", pattern: "/training/projects/:trainingProjectId/sections/:sectionId" },
  { key: "training-project-profile", pattern: "/training/projects/:trainingProjectId/profile" },
  { key: "training-project-sections", pattern: "/training/projects/:trainingProjectId/sections" },
  { key: "training-project-results", pattern: "/training/projects/:trainingProjectId/results" },
  { key: "training-project-dataset", pattern: "/training/projects/:trainingProjectId/dataset" },
  { key: "training-project-training-runs", pattern: "/training/projects/:trainingProjectId/training-runs" },
  { key: "training-project-generation-tasks", pattern: "/training/projects/:trainingProjectId/generation-tasks" },
  { key: "training-project-detail", pattern: "/training/projects/:trainingProjectId" },
  { key: "training-projects", pattern: "/training/projects" },
  { key: "training-preset-sort-rules", pattern: "/training/presets/sort-rules" },
  { key: "training-preset-new", pattern: "/training/presets/new" },
  { key: "training-preset-detail", pattern: "/training/presets/:presetId" },
  { key: "training-presets", pattern: "/training/presets" },
  { key: "training-template-new", pattern: "/training/templates/new" },
  { key: "training-template-section", pattern: "/training/templates/:templateId/sections/:sectionIndex" },
  { key: "training-template-edit", pattern: "/training/templates/:templateId/edit" },
  { key: "training-templates", pattern: "/training/templates" },
];

function matchPattern(pattern: string, route: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const routeParts = route.split("/").filter(Boolean);
  if (patternParts.length !== routeParts.length) return null;

  const params: Record<string, string> = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index];
    const routePart = routeParts[index];
    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = decodeURIComponent(routePart);
    } else if (patternPart !== routePart) {
      return null;
    }
  }

  return params;
}

export function matchRoute(route: string): Match {
  const normalized = route === "" ? "/" : route;
  for (const definition of TRAINING_ROUTE_PATTERNS) {
    const params = matchPattern(definition.pattern, normalized);
    if (params) {
      return {
        key: definition.key,
        params,
        route: normalized,
      };
    }
  }

  return {
    key: "not-found",
    params: {},
    route: normalized,
  };
}
