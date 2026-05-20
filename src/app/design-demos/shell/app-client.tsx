"use client";

import { usePathname } from "next/navigation";

import type { DemoData } from "../data";
import { DesignDemoShell } from "./app-shell";
import { LoginPage } from "../features/auth";
import { ModelsPage } from "../features/models";
import { PresetsPage, PresetCategoryFormPage, PresetEditPage, PresetGroupPage, SortRulesPage } from "../features/presets";
import { BatchCreatePage, RootPage, ProjectsPage, ProjectDetailPage, ProjectFormPage, SectionEditorPage } from "../features/projects";
import { QueuePage, ReviewPage } from "../features/runs";
import { SettingsPage, LogsPage, MonitorPage, NotFoundPage } from "../features/settings";
import { TemplatesPage, TemplateFormPage, TemplateSectionPage } from "../features/templates";
import { findCategory, findGroup, findPreset, findProject, findRun, findSection, findTemplate } from "../routing";
import { matchRoute, productRouteFromPathname } from "../routing";
import type { DemoTheme, Match } from "../routing";
import { ComponentShowcaseFamilyPage } from "../showcase/pages/family-page";
import { ComponentShowcaseIndex } from "../showcase/pages/index-page";
import { getShowcaseFamilyIdByRoute } from "../showcase/registry";

function CurrentPage({ match, data }: { match: Match; data: DemoData }) {
  const project = findProject(data, match.params.projectId);
  const section = findSection(project, match.params.sectionId);
  const template = findTemplate(data, match.params.templateId);

  switch (match.key) {
    case "root":
      return <RootPage data={data} />;
    case "queue":
      return <QueuePage data={data} />;
    case "queue-review":
      return <ReviewPage data={data} run={findRun(data, match.params.runId)} />;
    case "projects":
      return <ProjectsPage data={data} />;
    case "project-new":
      return <ProjectFormPage mode="new" data={data} />;
    case "project-detail":
      return <ProjectDetailPage project={project} />;
    case "project-edit":
      return <ProjectFormPage mode="edit" project={project} data={data} />;
    case "project-results":
      return <ProjectDetailPage project={project} initialView="results" />;
    case "project-batch":
      return <BatchCreatePage project={project} data={data} />;
    case "section-editor":
      return <SectionEditorPage data={data} project={project} section={section} />;
    case "models":
      return <ModelsPage data={data} />;
    case "loras":
      return <ModelsPage data={data} />;
    case "presets":
      return <PresetsPage data={data} />;
    case "preset-category-new":
      return <PresetCategoryFormPage data={data} mode="new" category={undefined} />;
    case "preset-category-edit":
      return <PresetCategoryFormPage data={data} mode="edit" category={findCategory(data, match.params.categoryId)} />;
    case "preset-edit":
      return <PresetEditPage data={data} preset={findPreset(data, match.params.presetId)} />;
    case "preset-groups":
      return <PresetGroupPage data={data} group={findGroup(data, match.params.groupId)} />;
    case "sort-rules":
      return <SortRulesPage data={data} />;
    case "templates":
      return <TemplatesPage data={data} />;
    case "template-new":
      return <TemplateFormPage mode="new" data={data} />;
    case "template-edit":
      return <TemplateFormPage mode="edit" template={template} data={data} />;
    case "template-section":
      return <TemplateSectionPage template={template} sectionIndex={match.params.sectionIndex} data={data} />;
    case "settings":
      return <SettingsPage data={data} />;
    case "logs":
      return <LogsPage data={data} />;
    case "monitor":
      return <MonitorPage data={data} />;
    case "component-showcase":
      return <ComponentShowcaseIndex data={data} />;
    case "login":
      return <LoginPage />;
    default:
      if (match.key.startsWith("component-showcase-")) {
        const familyId = getShowcaseFamilyIdByRoute(match.route);
        if (familyId) return <ComponentShowcaseFamilyPage data={data} familyId={familyId} />;
      }
      return <NotFoundPage route={match.route} />;
  }
}

export function DesignDemoApp({
  initialRouteSegments,
  data,
  initialTheme,
}: {
  initialRouteSegments: string[];
  data: DemoData;
  initialTheme: DemoTheme;
}) {
  const pathname = usePathname();
  const currentRoute = productRouteFromPathname(pathname, initialRouteSegments);
  const match = matchRoute(currentRoute);

  return (
    <DesignDemoShell data={data} currentRoute={currentRoute} initialTheme={initialTheme}>
      <CurrentPage match={match} data={data} />
    </DesignDemoShell>
  );
}
