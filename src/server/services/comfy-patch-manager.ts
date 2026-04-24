/**
 * ComfyUI Patch Manager
 *
 * Automatically detects and applies patches to ComfyUI custom nodes
 * that are needed for stable operation. Patches are identified by
 * marker comments and re-applied if missing (e.g. after ComfyUI updates).
 *
 * Currently patches:
 * - ComfyUI-Manager/prestartup_script.py: OSError [Errno 22] fix
 *   (wraps write+flush in try/except to prevent crashes on Windows)
 */

import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import path from "node:path";
import fs from "node:fs/promises";

const log = createLogger({ module: "comfy-patch" });

// ---------------------------------------------------------------------------
// Patch definitions
// ---------------------------------------------------------------------------

/**
 * Patch definitions using simple string-based search & replace.
 * Each patch looks for a specific code pattern and replaces it with
 * the patched version, inserting a marker comment.
 *
 * IMPORTANT: The search patterns must match the EXACT whitespace of the
 * upstream (unpatched) code. These were taken from the ComfyUI-Manager
 * repository source. If ComfyUI-Manager updates and the code changes,
 * the patch will report "failed" and need manual review.
 */
type SimplePatch = {
  id: string;
  description: string;
  /** Relative path from ComfyUI root (COMFY_LAUNCH_CWD) */
  targetFile: string;
  /** Marker comment that indicates this patch is already applied */
  marker: string;
  /** Search pattern (exact match including whitespace) */
  search: string;
  /** Replacement (includes marker comment) */
  replace: string;
};

const SIMPLE_PATCHES: SimplePatch[] = [
  {
    id: "oserror-sync_write",
    description:
      "Wrap sync_write write+flush in try/except to prevent OSError on Windows",
    targetFile: path.join(
      "custom_nodes",
      "ComfyUI-Manager",
      "prestartup_script.py",
    ),
    marker: "# COMFYUI-REMOTE-PATCH: oserror-sync_write",
    // Unpatched sync_write method: the "if not file_only" block
    // Source: https://github.com/ltdrdata/ComfyUI-Manager/blob/main/prestartup_script.py
    search: [
      "            if not file_only:",
      "                with std_log_lock:",
      "                    if self.is_stdout:",
      "                        write_stdout(message)",
      "                        original_stdout.flush()",
      "                    else:",
      "                        write_stderr(message)",
      "                        original_stderr.flush()",
    ].join("\n"),
    replace: [
      "            if not file_only:",
      "                with std_log_lock:",
      "                    # COMFYUI-REMOTE-PATCH: oserror-sync_write",
      "                    try:",
      "                        if self.is_stdout:",
      "                            write_stdout(message)",
      "                            original_stdout.flush()",
      "                        else:",
      "                            write_stderr(message)",
      "                            original_stderr.flush()",
      "                    except (OSError, ValueError):",
      "                        pass",
    ].join("\n"),
  },
  {
    id: "oserror-write-tqdm",
    description:
      "Wrap write() tqdm progress path write+flush in try/except to prevent OSError",
    targetFile: path.join(
      "custom_nodes",
      "ComfyUI-Manager",
      "prestartup_script.py",
    ),
    marker: "# COMFYUI-REMOTE-PATCH: oserror-write-tqdm",
    // Unpatched write method: tqdm progress bar else branch
    // Source: https://github.com/ltdrdata/ComfyUI-Manager/blob/main/prestartup_script.py
    search: [
      "                    if '100%' in message:",
      "                        self.sync_write(message)",
      "                    else:",
      "                        write_stderr(message)",
      "                        original_stderr.flush()",
    ].join("\n"),
    replace: [
      "                    if '100%' in message:",
      "                        self.sync_write(message)",
      "                    else:",
      "                        # COMFYUI-REMOTE-PATCH: oserror-write-tqdm",
      "                        try:",
      "                            write_stderr(message)",
      "                            original_stderr.flush()",
      "                        except (OSError, ValueError):",
      "                            pass",
    ].join("\n"),
  },
];

// ---------------------------------------------------------------------------
// Patch application logic
// ---------------------------------------------------------------------------

export type PatchResult = {
  id: string;
  status:
    | "already_applied"
    | "applied"
    | "not_needed"
    | "failed"
    | "target_not_found";
  message: string;
};

/**
 * Check and apply all patches to ComfyUI custom nodes.
 * Called before ComfyUI starts to ensure patches are present.
 */
export async function applyComfyPatches(): Promise<PatchResult[]> {
  const comfyCwd = env.comfyLaunchCwd.trim();
  if (!comfyCwd) {
    log.debug("COMFY_LAUNCH_CWD not set, skipping patch checks");
    return [];
  }

  const results: PatchResult[] = [];

  for (const patch of SIMPLE_PATCHES) {
    const result = await applySinglePatch(comfyCwd, patch);
    results.push(result);
  }

  const applied = results.filter((r) => r.status === "applied");
  const alreadyApplied = results.filter((r) => r.status === "already_applied");
  const failed = results.filter((r) => r.status === "failed");

  if (applied.length > 0) {
    log.info(`Applied ${applied.length} ComfyUI patch(es)`, {
      applied: applied.map((r) => r.id),
    });
  }
  if (failed.length > 0) {
    log.warn(`Failed to apply ${failed.length} ComfyUI patch(es)`, {
      failed: failed.map((r) => ({ id: r.id, message: r.message })),
    });
  }
  if (applied.length === 0 && failed.length === 0) {
    log.debug("All ComfyUI patches already applied", {
      patches: alreadyApplied.map((r) => r.id),
    });
  }

  return results;
}

async function applySinglePatch(
  comfyCwd: string,
  patch: SimplePatch,
): Promise<PatchResult> {
  const filePath = path.join(comfyCwd, patch.targetFile);

  let content: string;
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch {
    return {
      id: patch.id,
      status: "target_not_found",
      message: `Target file not found: ${patch.targetFile}`,
    };
  }

  // Check if patch is already applied (marker comment exists)
  if (content.includes(patch.marker)) {
    return {
      id: patch.id,
      status: "already_applied",
      message: `Patch marker found: ${patch.marker}`,
    };
  }

  // Try to apply the patch
  if (!content.includes(patch.search)) {
    return {
      id: patch.id,
      status: "failed",
      message: `Search pattern not found in ${patch.targetFile} — upstream code may have changed. Manual review needed.`,
    };
  }

  const patchedContent = content.replace(patch.search, patch.replace);

  try {
    await fs.writeFile(filePath, patchedContent, "utf-8");
    return {
      id: patch.id,
      status: "applied",
      message: `Successfully applied patch to ${patch.targetFile}`,
    };
  } catch (error) {
    return {
      id: patch.id,
      status: "failed",
      message: `Failed to write patched file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Check patch status without applying changes.
 * Useful for diagnostics and UI display.
 */
export async function checkComfyPatchStatus(): Promise<
  Array<{ id: string; description: string; status: string }>
> {
  const comfyCwd = env.comfyLaunchCwd.trim();
  if (!comfyCwd) {
    return SIMPLE_PATCHES.map((p) => ({
      id: p.id,
      description: p.description,
      status: "unknown (COMFY_LAUNCH_CWD not set)",
    }));
  }

  const results = [];

  for (const patch of SIMPLE_PATCHES) {
    const filePath = path.join(comfyCwd, patch.targetFile);
    let content: string;
    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch {
      results.push({
        id: patch.id,
        description: patch.description,
        status: "target_not_found",
      });
      continue;
    }

    if (content.includes(patch.marker)) {
      results.push({
        id: patch.id,
        description: patch.description,
        status: "applied",
      });
    } else if (content.includes(patch.search)) {
      results.push({
        id: patch.id,
        description: patch.description,
        status: "pending (needs application)",
      });
    } else {
      results.push({
        id: patch.id,
        description: patch.description,
        status: "not_applicable (upstream code changed)",
      });
    }
  }

  return results;
}
