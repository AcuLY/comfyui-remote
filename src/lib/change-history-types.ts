export type PresetChangeDimension = "variants" | "content";
export type PresetGroupChangeDimension = "meta" | "members";
export type SectionChangeDimension = "runParams" | "prompt" | "lora";

export type PresetHistoryEntry<Dimension extends string> = {
  id: string;
  dimension: Dimension;
  title: string;
  before: unknown;
  after: unknown;
  createdAt: string;
};

export type SectionHistoryEntry = {
  id: string;
  dimension: SectionChangeDimension;
  title: string;
  before: unknown;
  after: unknown;
  createdAt: string;
};
