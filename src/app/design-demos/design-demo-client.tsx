"use client";

import { usePathname } from "next/navigation";

import type { DemoData } from "./design-demo-data";
import { DesignDemoShell } from "./design-demo-shell";
import { ModelsPage } from "./model-pages";
import { PresetsPage, PresetCategoryFormPage, PresetEditPage, PresetGroupPage, SortRulesPage } from "./preset-pages";
import { BatchCreatePage } from "./batch-create-page";
import { RootPage, ProjectsPage, ProjectDetailPage, ProjectFormPage } from "./project-pages";
import { ImageListComponentsPage } from "./image-list-components-page";
import { ComponentShowcaseIndex, ComponentShowcaseAtoms, ComponentShowcaseMid, ComponentShowcaseImages, ComponentShowcaseEditor } from "./component-showcase-page";
import { IconShowcasePage } from "./icon-showcase-page";
import { QueuePage, ReviewPage } from "./runs-page";
import { SectionEditorPage as SectionEditorPageV2 } from "./section-editor-page";
import { SettingsPage, LogsPage, MonitorPage, LoginPage, NotFoundPage } from "./system-pages";
import { TemplatesPage, TemplateFormPage, TemplateSectionPage } from "./template-pages";
import { findCategory, findGroup, findPreset, findProject, findRun, findSection, findTemplate, matchRoute, productRouteFromPathname } from "./design-demo-utils";
import type { Match } from "./design-demo-utils";

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
      return <ProjectFormPage mode="new" />;
    case "project-detail":
      return <ProjectDetailPage project={project} />;
    case "project-edit":
      return <ProjectFormPage mode="edit" project={project} />;
    case "project-results":
      return <ProjectDetailPage project={project} initialView="results" />;
    case "project-batch":
      return <BatchCreatePage project={project} data={data} />;
    case "section-editor":
      return <SectionEditorPageV2 data={data} project={project} section={section} />;
    case "models":
      return <ModelsPage />;
    case "loras":
      return <ModelsPage />;
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
      return <TemplateFormPage mode="new" />;
    case "template-edit":
      return <TemplateFormPage mode="edit" template={template} />;
    case "template-section":
      return <TemplateSectionPage template={template} sectionIndex={match.params.sectionIndex} />;
    case "settings":
      return <SettingsPage data={data} />;
    case "logs":
      return <LogsPage data={data} />;
    case "monitor":
      return <MonitorPage data={data} />;
    case "image-list-components":
      return <ImageListComponentsPage data={data} />;
    case "component-showcase":
      return <ComponentShowcaseIndex data={data} />;
    case "component-showcase-atoms":
      return <ComponentShowcaseAtoms />;
    case "component-showcase-mid":
      return <ComponentShowcaseMid data={data} />;
    case "component-showcase-images":
      return <ComponentShowcaseImages data={data} />;
    case "component-showcase-editor":
      return <ComponentShowcaseEditor data={data} />;
    case "component-showcase-icons":
      return <IconShowcasePage />;
    case "login":
      return <LoginPage />;
    default:
      return <NotFoundPage route={match.route} />;
  }
}

export function DesignDemoApp({
  initialRouteSegments,
  data,
}: {
  initialRouteSegments: string[];
  data: DemoData;
}) {
  const pathname = usePathname();
  const currentRoute = productRouteFromPathname(pathname, initialRouteSegments);
  const match = matchRoute(currentRoute);

  return (
    <DesignDemoShell data={data} currentRoute={currentRoute}>
      <CurrentPage match={match} data={data} />
    </DesignDemoShell>
  );
}
