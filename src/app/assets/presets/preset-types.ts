import type {
  PresetChangeDimension,
  PresetGroupChangeDimension,
} from "@/server/services/preset-change-history-service";

export type PresetQueryPatch = {
  category?: string | null;
  folder?: string | null;
  preset?: string | null;
  variant?: string | null;
};

export type ChangeHistoryTabs<Dimension extends string> = Array<{
  key: Dimension;
  label: string;
}>;

export const PRESET_HISTORY_TABS: ChangeHistoryTabs<PresetChangeDimension> = [
  { key: "variants", label: "关联变体" },
  { key: "content", label: "提示词/LoRA" },
];

export const GROUP_HISTORY_TABS: ChangeHistoryTabs<PresetGroupChangeDimension> = [
  { key: "meta", label: "基础信息" },
  { key: "members", label: "成员" },
];

export type LinkedVariantRef = { presetId: string; variantId: string };

export type VariantDraft = {
  id?: string; // undefined = new variant
  name: string;
  slug: string;
  prompt: string;
  negativePrompt: string;
  lora1: import("@/lib/lora-types").LoraBinding[];
  lora2: import("@/lib/lora-types").LoraBinding[];
  linkedVariants: LinkedVariantRef[];
};
