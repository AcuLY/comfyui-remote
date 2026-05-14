import type { DemoData } from "./";

export const fallbackRouteData: DemoData = {
  source: {
    loadedFromSqlite: false,
    databaseLabel: "",
    imageSourceLabel: "",
    modelBaseLabel: "",
    comfyApiLabel: "",
    warning: null,
  },
  metrics: { projects: 0, sections: 0, runs: 0, pendingImages: 0, presets: 0, templates: 0, loras: 0 },
  projectFolders: [],
  projects: [],
  runs: [],
  categories: [],
  templates: [],
  loras: [],
  models: [],
  auditLogs: [],
  images: [],
};
