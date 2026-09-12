import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prototypeRoot = path.join(projectRoot, 'docs', 'design', 'prototypes');
const uiExtension = /\.(?:html?|css|scss|sass|less|[cm]?[jt]sx?|vue|svelte|astro)$/i;

// Only pass explicit edit targets. Text content is never interpreted as a shell command.
export function prototypeEditPaths(payload) {
  const candidates = new Set();
  const input = payload?.tool_input ?? payload?.input ?? {};
  const visit = (value, key = '') => {
    if (typeof value === 'string') {
      if (['file_path', 'filePath', 'path'].includes(key)) candidates.add(value);
      if (['patch', 'patch_text', 'patchText', 'input'].includes(key) || typeof input === 'string') {
        for (const match of value.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)) {
          candidates.add(match[1].trim());
        }
      }
    } else if (value && typeof value === 'object') {
      for (const [childKey, childValue] of Object.entries(value)) visit(childValue, childKey);
    }
  };
  visit(input);
  return [...candidates].map(candidate => path.resolve(projectRoot, candidate)).filter(candidate => {
    const relative = path.relative(prototypeRoot, candidate);
    return relative && relative !== '..' && !relative.startsWith(`..${path.sep}`)
      && !path.isAbsolute(relative) && uiExtension.test(candidate);
  });
}

function runOfficialHook(payload) {
  const scripts = path.join(projectRoot, '.agents', 'skills', 'impeccable', 'scripts');
  const windows = process.platform === 'win32';
  const binary = path.join(scripts, 'bin', `windows-${process.arch === 'arm64' ? 'arm64' : 'x64'}`, 'impeccable.exe');
  const launcher = path.join(scripts, windows ? 'impeccable.cmd' : 'impeccable');
  const command = windows && existsSync(binary) ? binary : windows ? 'cmd.exe' : launcher;
  const args = windows && !existsSync(binary) ? ['/d', '/s', '/c', `""${launcher}" hook"`] : ['hook'];
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    timeout: payload.hook_event_name === 'Stop' ? 25000 : 4000,
    windowsHide: true,
    env: { ...process.env, IMPECCABLE_SKILL_DIR: path.dirname(scripts) },
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) process.stderr.write(`Impeccable prototype hook: ${result.error.message}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let payload;
  try { payload = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
  if (payload.hook_event_name === 'Stop') {
    // The official session cache contains only paths forwarded by this adapter.
    runOfficialHook(payload);
  } else {
    for (const filePath of prototypeEditPaths(payload)) {
      if (!existsSync(filePath)) continue;
      runOfficialHook({ ...payload, tool_name: 'Write', tool_input: { file_path: filePath } });
    }
  }
}
