import { ModelFileManager } from "./model-file-manager";
import { modelKindFromSearchParam, modelPathFromSearchParam } from "@/lib/model-asset-navigation";

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string | string[]; path?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialKind = modelKindFromSearchParam(firstSearchParam(params.kind) ?? null);
  const initialPath = modelPathFromSearchParam(firstSearchParam(params.path) ?? null);

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-4">
      <div className="border-b border-white/5 pb-3">
        <h1 className="text-lg font-semibold text-zinc-100">模型</h1>
        <p className="mt-1 text-xs text-zinc-500">管理 ComfyUI 的 checkpoints 和 LoRA 文件。</p>
      </div>
      <ModelFileManager initialKind={initialKind} initialPath={initialPath} />
    </div>
  );
}
