import { ModelFileManager } from "./model-file-manager";

export default function ModelsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl min-w-0 space-y-4">
      <div className="border-b border-white/5 pb-3">
        <h1 className="text-lg font-semibold text-zinc-100">模型</h1>
        <p className="mt-1 text-xs text-zinc-500">管理 ComfyUI 的 checkpoints 和 LoRA 文件。</p>
      </div>
      <ModelFileManager />
    </div>
  );
}
