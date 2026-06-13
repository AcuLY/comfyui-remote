import { resolve, sep } from "node:path";

export function resolveProjectPath(...segments: string[]) {
  return resolve(/* turbopackIgnore: true */ process.cwd(), ...segments);
}

export function resolveDataPath(...segments: string[]) {
  return resolveProjectPath("data", ...segments);
}

export function withTrailingSeparator(path: string) {
  return path.endsWith(sep) ? path : path + sep;
}

export function isPathInsideDirectory(path: string, directory: string) {
  return path.startsWith(withTrailingSeparator(directory));
}
