import type { ComfyTarget, SshComfyTarget } from "@/server/services/comfy-target";
import { runSshCommand } from "@/server/services/comfy-ssh";

export type ComfyProcessAction = "start" | "stop" | "restart";

type SshCommandRunner = (
  target: SshComfyTarget,
  command: string,
) => Promise<{ stdout: string; stderr: string }>;

function commandForAction(target: SshComfyTarget, action: ComfyProcessAction) {
  if (action === "start") return { field: "startCommand", command: target.startCommand };
  if (action === "stop") return { field: "stopCommand", command: target.stopCommand };
  return { field: "restartCommand", command: target.restartCommand };
}

export async function runComfyTargetProcessAction(
  target: ComfyTarget,
  action: ComfyProcessAction,
  runner: SshCommandRunner = runSshCommand,
): Promise<{ ok: boolean; message: string }> {
  if (target.mode !== "ssh") {
    return { ok: false, message: "comfy target process adapter only handles SSH targets" };
  }

  const { field, command } = commandForAction(target, action);
  if (!command) {
    return { ok: false, message: `${field} is not configured for ComfyUI target "${target.id}"` };
  }

  await runner(target, command);
  return { ok: true, message: `Remote ComfyUI ${action} command completed` };
}
