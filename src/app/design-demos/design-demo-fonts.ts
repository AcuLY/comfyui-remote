export type DemoFontKey = "noto" | "misans" | "harmonyos" | "alibaba" | "lxgw";

export type DemoFontChoice = {
  key: DemoFontKey;
  label: string;
  family: string;
  license: string;
  summary: string;
  note: string;
};

export const DESIGN_DEMO_FONT_STORAGE_KEY = "comfyui-manager:design-demo-font";
export const DESIGN_DEMO_FONT_EVENT = "comfyui-manager:design-demo-font-change";
export const DEFAULT_DESIGN_DEMO_FONT_KEY: DemoFontKey = "noto";

export const DEMO_FONT_CHOICES: DemoFontChoice[] = [
  {
    key: "misans",
    label: "MiSans",
    family: "MiSans",
    license: "Apache 2.0",
    summary: "最接近现代系统 UI 的候选，和 Geist 的气质最顺。",
    note: "清爽、克制、稳定，适合把 demo 的中文部分收得更紧。",
  },
  {
    key: "harmonyos",
    label: "HarmonyOS Sans SC",
    family: "HarmonyOS Sans SC",
    license: "Unlicense",
    summary: "结构更硬朗，产品感强，适合密集后台界面。",
    note: "字形更利落，中文存在感会比 MiSans 更明显一点。",
  },
  {
    key: "alibaba",
    label: "Alibaba PuHuiTi 3",
    family: "AlibabaPuHuiTi",
    license: "OFL 1.1",
    summary: "更稳重的商业产品风格，阅读压力低。",
    note: "整体更厚实，适合高信息密度的控制台和配置页。",
  },
  {
    key: "lxgw",
    label: "LXGW Neo XiHei",
    family: "LXGW Neo XiHei",
    license: "OFL 1.1",
    summary: "中文气质更强，字形辨识度更高。",
    note: "偏个性，不是最贴 Geist 的方向，但很适合做反差对照。",
  },
  {
    key: "noto",
    label: "Noto Sans SC Variable",
    family: "Noto Sans SC Variable",
    license: "OFL 1.1",
    summary: "基线方案，稳定、完整，但你已经觉得它偏离预期。",
    note: "保留作对照基准，方便确认新方案到底差多少。",
  },
];

export function isDemoFontKey(value: string | null): value is DemoFontKey {
  return value === "noto" || value === "misans" || value === "harmonyos" || value === "alibaba" || value === "lxgw";
}

export function resolveDemoFontKey(value: string | null | undefined): DemoFontKey {
  const key = value ?? null;
  return isDemoFontKey(key) ? key : DEFAULT_DESIGN_DEMO_FONT_KEY;
}

export function applyDesignDemoFont(nextFont: DemoFontKey) {
  window.localStorage.setItem(DESIGN_DEMO_FONT_STORAGE_KEY, nextFont);
  window.dispatchEvent(new CustomEvent<DemoFontKey>(DESIGN_DEMO_FONT_EVENT, { detail: nextFont }));
}
