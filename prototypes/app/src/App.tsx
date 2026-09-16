import { useEffect, useState } from "react";
import { Panel } from "primereact/panel";

import { FeedbackProvider } from "./feedback";
import { ModelsPage, MonitorPage, PresetsPage, ProjectsPage, SettingsPage, TemplatesPage } from "./pages/LightPages";
import { TasksPage } from "./pages/TasksPage";
import { navigateTo, useHashRoute } from "./router";
import { buildNavLinks, headerFor, matchRoute } from "./routes";
import type { PrototypeMatch } from "./routes";
import { Shell } from "./shell/Shell";
import { applyTheme, readStoredTheme } from "./theme";
import type { PrototypeTheme } from "./theme";
import { usePrototypeTasks } from "./tasks/useTasks";
import type { PrototypeTasksState } from "./tasks/useTasks";
import { setPrototypeWorkMode, usePrototypeWorkMode } from "./workMode";

function NotFoundPage() {
  return (
    <div className="page">
      <Panel className="panel-clean" header={<span>未匹配页面</span>}>
        <p className="empty-line">没有与当前地址匹配的页面。</p>
      </Panel>
    </div>
  );
}

function CurrentPage({ match, tasksState }: { match: PrototypeMatch; tasksState: PrototypeTasksState }) {
  switch (match.key) {
    case "production-tasks":
      return <TasksPage key={match.key} module="generation" state={tasksState} />;
    case "training-tasks":
      return <TasksPage key={match.key} module="training" state={tasksState} />;
    case "production-projects":
      return <ProjectsPage module="generation" />;
    case "training-projects":
      return <ProjectsPage module="training" />;
    case "production-presets":
      return <PresetsPage module="generation" />;
    case "training-presets":
      return <PresetsPage module="training" />;
    case "production-templates":
      return <TemplatesPage module="generation" />;
    case "training-templates":
      return <TemplatesPage module="training" />;
    case "tools-models":
      return <ModelsPage />;
    case "tools-monitor":
      return <MonitorPage />;
    case "tools-settings":
      return <SettingsPage />;
    default:
      return <NotFoundPage />;
  }
}

export default function App() {
  const route = useHashRoute();
  const workMode = usePrototypeWorkMode();
  const [theme, setTheme] = useState<PrototypeTheme>(readStoredTheme);
  const tasksState = usePrototypeTasks();
  const match = matchRoute(route);
  const routeMode = route.startsWith("/training/")
    ? "lora_training"
    : route.startsWith("/production/")
      ? "generation"
      : null;

  // 进入模块路由即切换模块上下文；全局工具页保留已存模式。
  useEffect(() => {
    if (routeMode && routeMode !== workMode) setPrototypeWorkMode(routeMode);
  }, [routeMode, workMode]);

  const effectiveMode = routeMode ?? workMode;
  const navLinks = buildNavLinks(effectiveMode);
  const header = headerFor(match.key);

  function toggleTheme() {
    setTheme((current) => {
      const next: PrototypeTheme = current === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }

  return (
    <FeedbackProvider>
      <Shell
        currentRoute={route}
        workMode={effectiveMode}
        theme={theme}
        navLinks={navLinks}
        header={header}
        onNavigate={navigateTo}
        onToggleTheme={toggleTheme}
      >
        <CurrentPage match={match} tasksState={tasksState} />
      </Shell>
    </FeedbackProvider>
  );
}
