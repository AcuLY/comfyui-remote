"use client";

import { useState } from "react";
import { Upload, Check, AlertCircle } from "lucide-react";

type ImportState = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
  result?: {
    id: string;
    name: string;
    variableCount: number;
    nodeCount: number;
  };
};

export function WorkflowImportForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [state, setState] = useState<ImportState>({
    status: "idle",
    message: "粘贴 ComfyUI API 格式的 JSON，填写名称后导入。",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setState({ status: "error", message: "请填写模板名称。" });
      return;
    }

    let promptJson: unknown;
    try {
      promptJson = JSON.parse(jsonText);
    } catch {
      setState({ status: "error", message: "JSON 格式无效，请检查粘贴内容。" });
      return;
    }

    if (!promptJson || typeof promptJson !== "object" || Array.isArray(promptJson)) {
      setState({ status: "error", message: "JSON 必须是一个对象（不能是数组）。" });
      return;
    }

    setState({ status: "loading", message: "正在导入..." });

    try {
      const response = await fetch("/api/workflows/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || undefined,
          promptJson,
        }),
      });

      const json = await response.json();

      if (!response.ok || json.ok === false) {
        setState({
          status: "error",
          message: json.error?.message ?? `导入失败 (${response.status})`,
        });
        return;
      }

      const result = json.data ?? json;

      setState({
        status: "success",
        message: `✅ 成功导入「${result.name}」— ${result.variableCount} 个变量, ${result.nodeCount} 个节点`,
        result,
      });

      // Reset form
      setName("");
      setDescription("");
      setJsonText("");
    } catch {
      setState({ status: "error", message: "网络错误，无法连接到导入 API。" });
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        setJsonText(text);

        // Auto-fill name from filename if empty
        if (!name.trim()) {
          const baseName = file.name.replace(/\.json$/i, "").replace(/[-_]/g, " ");
          setName(baseName);
        }
      }
    };
    reader.readAsText(file);

    // Reset file input
    e.target.value = "";
  }

  const feedbackClassName =
    state.status === "error"
      ? "border-rose-500/20 bg-rose-500/10 text-rose-200"
      : state.status === "success"
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
        : "border-white/10 bg-white/[0.03] text-zinc-400";

  const FeedbackIcon = state.status === "error" ? AlertCircle : state.status === "success" ? Check : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label htmlFor="wf-name" className="mb-1 block text-xs text-zinc-500">
          模板名称 *
        </label>
        <input
          id="wf-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如: My SDXL Workflow"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-sky-500/40 focus:outline-none"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="wf-desc" className="mb-1 block text-xs text-zinc-500">
          描述（可选）
        </label>
        <input
          id="wf-desc"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="简要描述此 Workflow"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-sky-500/40 focus:outline-none"
        />
      </div>

      {/* JSON textarea + file upload */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="wf-json" className="text-xs text-zinc-500">
            ComfyUI API JSON *
          </label>
          <label className="cursor-pointer text-xs text-sky-400 hover:text-sky-300">
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
            或上传 JSON 文件
          </label>
        </div>
        <textarea
          id="wf-json"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          rows={8}
          placeholder='在 ComfyUI 中点击 "Save (API Format)" 导出 JSON，然后粘贴到这里...'
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-sky-500/40 focus:outline-none"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={state.status === "loading"}
        className="inline-flex items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-2.5 text-sm text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
      >
        <Upload className="size-4" />
        {state.status === "loading" ? "导入中..." : "导入 Workflow"}
      </button>

      {/* Feedback */}
      <div className={`flex items-start gap-2 rounded-2xl border px-3 py-2 text-xs leading-5 ${feedbackClassName}`}>
        {FeedbackIcon && <FeedbackIcon className="mt-0.5 size-3.5 shrink-0" />}
        <span>{state.message}</span>
      </div>
    </form>
  );
}
