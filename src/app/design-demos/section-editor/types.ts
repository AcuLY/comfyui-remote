import type { DemoData, DemoImage, DemoProject, DemoSection } from "../design-demo-data";

export type SectionEditorLoadedProps = {
  data: DemoData;
  project: DemoProject;
  section: DemoSection;
};

export type HistoryDimKey = "all" | "params" | "preset" | "prompt" | "lora";

export type ResultsFilter = "all" | "pending" | "kept" | "trashed" | "featured";

export type ImageStatus = DemoImage["status"];
