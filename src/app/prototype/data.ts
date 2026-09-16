import type { DemoData } from "@/app/design-demos/data";

/* ------------------------------------------------------------------ */
/* 原型演示数据（手工编写的连贯样本；仅浏览器内存，刷新恢复）          */
/* ------------------------------------------------------------------ */

export type PrototypeTaskStatus = "running" | "submitted" | "queued" | "paused" | "done" | "failed" | "cancelled";
export type PrototypeTaskKind = "image" | "material" | "lora";
export type PrototypeModule = "generation" | "training";

export type PrototypeTask = {
  id: string;
  module: PrototypeModule;
  kind: PrototypeTaskKind;
  name: string;
  project: string;
  section: string;
  status: PrototypeTaskStatus;
  progress: number;
  count: number;
  output: number;
  time: string;
  duration: string;
  stage?: string;
  model: string;
  size: string;
  error?: string;
  attempt?: number;
};

export const initialPrototypeTasks: PrototypeTask[] = [
  { id: "G-0926", module: "generation", kind: "image", name: "雨后街角 · 傍晚", project: "城市漫游", section: "雨后街角", status: "running", progress: 62, count: 8, output: 4, time: "14:32", duration: "02:18", stage: "采样 24 / 30 步", model: "Animagine XL 4.0", size: "832 × 1216" },
  { id: "G-0927", module: "generation", kind: "image", name: "沿河步道 · 清晨", project: "城市漫游", section: "沿河步道", status: "submitted", progress: 0, count: 6, output: 0, time: "14:33", duration: "—", model: "Animagine XL 4.0", size: "1216 × 832" },
  { id: "G-0928", module: "generation", kind: "image", name: "玻璃花房 · 逆光", project: "植物手记", section: "玻璃花房", status: "queued", progress: 0, count: 4, output: 0, time: "14:35", duration: "—", model: "SDXL 1.0", size: "1024 × 1024" },
  { id: "G-0925", module: "generation", kind: "image", name: "老书店 · 窗边", project: "城市漫游", section: "老书店", status: "done", progress: 100, count: 8, output: 8, time: "14:18", duration: "04:12", model: "Animagine XL 4.0", size: "832 × 1216" },
  { id: "G-0924", module: "generation", kind: "image", name: "叶片与光影", project: "植物手记", section: "叶片", status: "failed", progress: 0, count: 4, output: 0, time: "14:06", duration: "00:42", error: "显存不足：加载模型时无法分配 1.2 GiB 显存。释放其他程序占用后可从头重试。", model: "SDXL 1.0", size: "1024 × 1024" },
  { id: "G-0923", module: "generation", kind: "image", name: "海风 · 白色灯塔", project: "海岸线", section: "灯塔", status: "done", progress: 100, count: 6, output: 6, time: "13:52", duration: "03:26", model: "Animagine XL 4.0", size: "1216 × 832" },
  { id: "G-0922", module: "generation", kind: "image", name: "午后的露台", project: "城市漫游", section: "露台", status: "paused", progress: 0, count: 4, output: 0, time: "13:40", duration: "01:06", model: "Animagine XL 4.0", size: "832 × 1216" },
  { id: "G-0921", module: "generation", kind: "image", name: "热带温室 · 雨季植物与玻璃屋顶的光影研究", project: "植物手记", section: "热带温室", status: "cancelled", progress: 0, count: 12, output: 0, time: "13:21", duration: "—", model: "SDXL 1.0", size: "1024 × 1024" },
  { id: "T-0186", module: "training", kind: "lora", name: "凛 · 人物 LoRA", project: "凛", section: "训练运行", status: "queued", progress: 0, count: 2400, output: 0, time: "14:36", duration: "—", model: "SDXL 1.0", size: "1024 × 1024" },
  { id: "T-0185", module: "training", kind: "material", name: "凛 · 正面半身", project: "凛", section: "正面半身", status: "done", progress: 100, count: 12, output: 12, time: "13:48", duration: "06:32", model: "Animagine XL 4.0", size: "832 × 1216" },
  { id: "T-0184", module: "training", kind: "lora", name: "澪 · 人物 LoRA", project: "澪", section: "训练运行", status: "failed", progress: 0, count: 1800, output: 0, time: "12:20", duration: "18:45", error: "训练进程退出（代码 1）。数据集路径不可用，请检查训练目录后重新启动。", model: "SDXL 1.0", size: "1024 × 1024" },
  { id: "T-0183", module: "training", kind: "lora", name: "澪 · 表情 LoRA", project: "澪", section: "训练运行", status: "done", progress: 100, count: 1800, output: 3, time: "11:20", duration: "42:16", model: "SDXL 1.0", size: "1024 × 1024" },
];

export const prototypeProductionProjects = [
  { name: "城市漫游", updated: "今天 14:32", active: 1, review: 3, archived: false },
  { name: "植物手记", updated: "今天 14:06", active: 0, review: 1, archived: false },
  { name: "海岸线", updated: "9月12日", active: 0, review: 0, archived: true },
];

export const prototypeTrainingProjects = [
  { name: "凛", updated: "今天 14:36", active: 1 },
  { name: "澪", updated: "今天 12:20", active: 0 },
];

export const prototypeProductionPresets = [
  { name: "雨后街角 · 傍晚", group: "城市漫游", updated: "今天 10:12" },
  { name: "柔光人像", group: "人物", updated: "9月15日" },
  { name: "夜景建筑", group: "场景", updated: "9月12日" },
];

export const prototypeTrainingPresets = [
  { name: "人物 LoRA 基础", group: "角色", updated: "9月15日" },
  { name: "服饰 LoRA", group: "角色", updated: "9月10日" },
];

export const prototypeProductionTemplates = [
  { name: "人物写真模板", source: "项目 城市漫游", updated: "9月14日" },
  { name: "夜景建筑模板", source: "预设 夜景建筑", updated: "9月12日" },
];

export const prototypeTrainingTemplates = [
  { name: "人物 LoRA 模板", source: "预制 人物 LoRA 基础", updated: "9月15日" },
];

export const prototypeModels = [
  { name: "Animagine XL 4.0", type: "Checkpoint", size: "6.9 GB", missing: false },
  { name: "SDXL 1.0", type: "Checkpoint", size: "6.5 GB", missing: false },
  { name: "凛 · 人物 LoRA", type: "LoRA", size: "218 MB", missing: false },
  { name: "旧版样本模型", type: "Checkpoint", size: "—", missing: true },
];

export const prototypeMonitorStatus = {
  checkedAt: "今天 14:32",
  comfy: "已连接",
  gpu: "RTX 4090 · 6.2 / 24 GB",
  submitted: 2,
  running: 1,
};

export const prototypeLogEntries = [
  { time: "14:33", level: "info", message: "图片任务已送入执行队列", target: "城市漫游 · 沿河步道" },
  { time: "14:32", level: "info", message: "图片任务开始执行", target: "城市漫游 · 雨后街角" },
  { time: "14:28", level: "error", message: "模型加载失败：显存不足", target: "植物手记 · 叶片" },
  { time: "14:06", level: "info", message: "素材生成完成，12 张图片可用", target: "凛 · 正面半身" },
];

/* ------------------------------------------------------------------ */
/* 外壳数据：DesignDemoShell 需要 DemoData 形状；本原型页面使用上方   */
/* 自己的样本，外壳只要求结构安全的空集合。                           */
/* ------------------------------------------------------------------ */

export const prototypeShellData: DemoData = {
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
