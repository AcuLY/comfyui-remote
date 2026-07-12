import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import GithubSlugger from "github-slugger";
import yaml from "js-yaml";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

const ALLOWED_FRONTMATTER = new Set(["name", "description", "license", "allowed-tools", "metadata"]);

function slash(path) {
  return path.split(sep).join("/");
}

function repoPath(root, path) {
  const value = slash(relative(root, path));
  return value || ".";
}

function inside(root, target) {
  const value = relative(root, target);
  return value === "" || (!value.startsWith(`..${sep}`) && value !== ".." && !isAbsolute(value));
}

function location(node, offset = 0) {
  return { line: (node?.position?.start?.line ?? 1) + offset, column: node?.position?.start?.column ?? 1 };
}

function parseFrontmatter(source) {
  const normalized = source.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n");
  const lines = normalized.split("\n");
  if (lines[0] !== "---") throw new Error("SKILL.md has no YAML frontmatter.");
  const end = lines.findIndex((line, index) => index > 0 && line === "---");
  if (end < 0) throw new Error("SKILL.md frontmatter has no closing delimiter.");
  const metadata = yaml.load(lines.slice(1, end).join("\n"));
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("SKILL.md frontmatter must be a YAML mapping.");
  }
  return { metadata, body: lines.slice(end + 1).join("\n"), lineOffset: end + 1 };
}

function text(node) {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(text).join("");
}

function parseMarkdown(source, lineOffset = 0) {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(source);
  const slugger = new GithubSlugger();
  const anchors = new Set();
  const links = [];
  const visit = (node, ignored = false) => {
    const nextIgnored = ignored || node.type === "code" || node.type === "inlineCode" || node.type === "html";
    if (!nextIgnored && node.type === "heading") anchors.add(slugger.slug(text(node)));
    if (!nextIgnored && ["link", "image", "definition"].includes(node.type) && typeof node.url === "string") {
      links.push({ url: node.url, location: location(node, lineOffset) });
    }
    for (const child of node.children ?? []) visit(child, nextIgnored);
  };
  visit(tree);
  return { anchors, links };
}

function markdownFiles(root) {
  const files = [];
  if (!existsSync(root)) return files;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...markdownFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(path);
  }
  return files.sort();
}

function diagnostic(ruleId, path, evidence, remediation, at = { line: 1, column: 1 }) {
  return {
    ruleId,
    severity: "error",
    path,
    location: at,
    evidence,
    remediation,
    owner: "agent-skills",
  };
}

function resolveLink(skillRoot, sourcePath, url) {
  const hashIndex = url.indexOf("#");
  const rawPath = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const rawAnchor = hashIndex >= 0 ? url.slice(hashIndex + 1) : null;
  const queryIndex = rawPath.indexOf("?");
  let decodedPath;
  let decodedAnchor;
  try {
    decodedPath = decodeURI(queryIndex >= 0 ? rawPath.slice(0, queryIndex) : rawPath);
    decodedAnchor = rawAnchor === null ? null : decodeURIComponent(rawAnchor);
  } catch {
    throw new Error(`Invalid percent encoding: ${url}`);
  }
  const target = decodedPath === "" ? sourcePath : resolve(dirname(sourcePath), decodedPath);
  if (!inside(skillRoot, target)) throw new Error(`Reference escapes the Skill directory: ${url}`);
  return { target, anchor: decodedAnchor };
}

function isExternal(url) {
  return url.startsWith("//") || /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(url);
}

function validateOpenAiYaml(workspaceRoot, skillRoot, skillName, diagnostics) {
  const path = join(skillRoot, "agents", "openai.yaml");
  const relativePath = repoPath(workspaceRoot, path);
  const isDocsAudit = basename(skillRoot) === "docs-audit";
  if (!existsSync(path)) {
    if (isDocsAudit) {
      diagnostics.push(diagnostic("skill/openai-metadata-missing", relativePath, "docs-audit requires agents/openai.yaml.", "Add explicit-only UI metadata."));
    }
    return;
  }
  let value;
  try {
    value = yaml.load(readFileSync(path, "utf8"));
  } catch (error) {
    diagnostics.push(diagnostic("skill/openai-yaml", relativePath, String(error), "Repair agents/openai.yaml."));
    return;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    diagnostics.push(diagnostic("skill/openai-yaml", relativePath, "agents/openai.yaml must be a mapping.", "Repair agents/openai.yaml."));
    return;
  }
  const ui = value.interface && typeof value.interface === "object" && !Array.isArray(value.interface) ? value.interface : {};
  if (typeof ui.default_prompt === "string" && !ui.default_prompt.includes(`$${skillName}`)) {
    diagnostics.push(diagnostic("skill/default-prompt", relativePath, `default_prompt does not mention $${skillName}.`, "Mention the Skill explicitly in default_prompt."));
  }
  for (const key of ["icon_small", "icon_large"]) {
    if (typeof ui[key] !== "string") continue;
    const target = resolve(skillRoot, ui[key]);
    if (!inside(skillRoot, target)) {
      diagnostics.push(diagnostic("skill/path-escape", relativePath, `${key} escapes the Skill directory.`, "Use a contained assets path."));
    } else if (!existsSync(target)) {
      diagnostics.push(diagnostic("skill/reference-missing", relativePath, `${key} does not exist: ${ui[key]}`, "Add the asset or repair the path."));
    }
  }
  if (isDocsAudit) {
    const policy = value.policy && typeof value.policy === "object" && !Array.isArray(value.policy) ? value.policy : {};
    if (policy.allow_implicit_invocation !== false) {
      diagnostics.push(diagnostic("skill/implicit-invocation", relativePath, "docs-audit must set policy.allow_implicit_invocation to false.", "Disable implicit invocation so only explicit requests trigger the audit."));
    }
  }
}

function validateSkill(workspaceRoot, input) {
  const diagnostics = [];
  if (isAbsolute(input)) {
    throw new Error(`Skill path must be repository-relative: ${input}`);
  }
  const lexicalRoot = resolve(workspaceRoot, input);
  if (!inside(workspaceRoot, lexicalRoot)) throw new Error(`Skill path escapes the repository: ${input}`);
  if (!existsSync(lexicalRoot)) {
    diagnostics.push(diagnostic("skill/directory-missing", slash(input), "Skill directory does not exist.", "Pass an existing repository Skill directory."));
    return diagnostics;
  }
  const skillRoot = realpathSync(lexicalRoot);
  if (!inside(realpathSync(workspaceRoot), skillRoot)) throw new Error(`Skill path resolves outside the repository: ${input}`);
  const skillPath = join(skillRoot, "SKILL.md");
  const relativeSkillPath = repoPath(workspaceRoot, skillPath);
  if (!existsSync(skillPath)) {
    diagnostics.push(diagnostic("skill/skill-md-missing", relativeSkillPath, "SKILL.md does not exist.", "Add the required SKILL.md file."));
    return diagnostics;
  }

  let frontmatter;
  try {
    frontmatter = parseFrontmatter(readFileSync(skillPath, "utf8"));
  } catch (error) {
    diagnostics.push(diagnostic("skill/frontmatter", relativeSkillPath, String(error), "Repair SKILL.md YAML frontmatter."));
    return diagnostics;
  }
  const metadata = frontmatter.metadata;
  for (const key of Object.keys(metadata).filter((key) => !ALLOWED_FRONTMATTER.has(key)).sort()) {
    diagnostics.push(diagnostic("skill/frontmatter-key", relativeSkillPath, `Unexpected frontmatter key: ${key}`, "Use only supported Agent Skills frontmatter fields."));
  }
  const name = typeof metadata.name === "string" ? metadata.name.trim() : "";
  const description = typeof metadata.description === "string" ? metadata.description.trim() : "";
  if (!name) diagnostics.push(diagnostic("skill/name", relativeSkillPath, "Skill name is missing or not a string.", "Add a non-empty name."));
  if (name && (!/^[a-z0-9-]+$/.test(name) || name.startsWith("-") || name.endsWith("-") || name.includes("--") || name.length > 64)) {
    diagnostics.push(diagnostic("skill/name", relativeSkillPath, `Invalid Skill name: ${name}`, "Use 1-64 lowercase letters, digits, and single hyphens."));
  }
  if (name && name !== basename(skillRoot)) {
    diagnostics.push(diagnostic("skill/name-folder-mismatch", relativeSkillPath, `Frontmatter name ${name} does not match folder ${basename(skillRoot)}.`, "Make the folder and Skill name identical."));
  }
  if (!description || description.length > 1024 || description.includes("<") || description.includes(">")) {
    diagnostics.push(diagnostic("skill/description", relativeSkillPath, "Description is missing, too long, or contains angle brackets.", "Use a clear description of at most 1024 characters."));
  }
  const declaresExplicitInvocation = /explicit/i.test(description) || description.includes("显式调用");
  if (basename(skillRoot) === "docs-audit" && (!description.includes("$docs-audit") || !declaresExplicitInvocation)) {
    diagnostics.push(diagnostic("skill/explicit-description", relativeSkillPath, "docs-audit description must state explicit invocation and name $docs-audit.", "Describe only explicit user or approved OpenSpec-task invocation."));
  }
  if (!frontmatter.body.trim()) {
    diagnostics.push(diagnostic("skill/body-missing", relativeSkillPath, "SKILL.md has no instruction body.", "Add concise executable instructions."));
  }

  const markdown = new Map();
  const skillParsed = parseMarkdown(frontmatter.body, frontmatter.lineOffset);
  markdown.set(skillPath, skillParsed);
  for (const path of markdownFiles(join(skillRoot, "references"))) {
    markdown.set(path, parseMarkdown(readFileSync(path, "utf8")));
    if (name === "docs-audit" && slash(relative(join(skillRoot, "references"), path)).includes("/")) {
      diagnostics.push(diagnostic("skill/reference-depth", repoPath(workspaceRoot, path), "docs-audit references must remain one level below references/.", "Move the reference to the top-level references directory."));
    }
  }

  const directlyReferenced = new Set();
  for (const [sourcePath, parsed] of markdown) {
    for (const link of parsed.links) {
      if (isExternal(link.url)) continue;
      let resolved;
      try {
        resolved = resolveLink(skillRoot, sourcePath, link.url);
      } catch (error) {
        diagnostics.push(diagnostic("skill/path-escape", repoPath(workspaceRoot, sourcePath), String(error), "Use a relative target contained in the Skill directory.", link.location));
        continue;
      }
      if (!existsSync(resolved.target)) {
        diagnostics.push(diagnostic("skill/reference-missing", repoPath(workspaceRoot, sourcePath), `Bundled reference does not exist: ${link.url}`, "Add the bundled file or repair the link.", link.location));
        continue;
      }
      const actualTarget = realpathSync(resolved.target);
      if (!inside(skillRoot, actualTarget)) {
        diagnostics.push(diagnostic("skill/path-escape", repoPath(workspaceRoot, sourcePath), `Bundled reference resolves outside the Skill: ${link.url}`, "Remove the escaping symlink or link.", link.location));
        continue;
      }
      if (sourcePath === skillPath) directlyReferenced.add(actualTarget);
      if (resolved.anchor !== null && actualTarget.endsWith(".md")) {
        const targetParsed = markdown.get(actualTarget) ?? parseMarkdown(readFileSync(actualTarget, "utf8"));
        if (!targetParsed.anchors.has(resolved.anchor)) {
          diagnostics.push(diagnostic("skill/anchor-missing", repoPath(workspaceRoot, sourcePath), `Anchor #${resolved.anchor} is missing from ${repoPath(workspaceRoot, actualTarget)}.`, "Link to a GitHub-compatible heading slug.", link.location));
        }
      }
    }
  }
  for (const reference of markdownFiles(join(skillRoot, "references"))) {
    if (!directlyReferenced.has(realpathSync(reference))) {
      diagnostics.push(diagnostic("skill/reference-unreachable", repoPath(workspaceRoot, reference), "Bundled reference is not linked directly from SKILL.md.", "Add a purpose-specific link from SKILL.md or remove the unused reference."));
    }
  }
  validateOpenAiYaml(workspaceRoot, skillRoot, name || basename(skillRoot), diagnostics);
  return diagnostics;
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortDiagnostics(items) {
  return [...items].sort((left, right) => compareText(left.path, right.path)
    || left.location.line - right.location.line
    || left.location.column - right.location.column
    || compareText(left.ruleId, right.ruleId)
    || compareText(left.evidence, right.evidence));
}

function result(diagnostics, exitCode = null) {
  const sorted = sortDiagnostics(diagnostics);
  const errors = sorted.filter((item) => item.severity === "error").length;
  return {
    schemaVersion: 1,
    diagnostics: sorted,
    summary: { errors, warnings: sorted.length - errors },
    exitCode: exitCode ?? (errors > 0 ? 1 : 0),
  };
}

function renderHuman(payload) {
  return `${[
    ...payload.diagnostics.flatMap((item) => [
      `${item.severity.toUpperCase()} ${item.ruleId} ${item.path}:${item.location.line}:${item.location.column}`,
      `  evidence: ${item.evidence}`,
      `  remediation: ${item.remediation}`,
    ]),
    `skills:check errors=${payload.summary.errors} warnings=${payload.summary.warnings}`,
  ].join("\n")}\n`;
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const paths = args.filter((arg) => arg !== "--json");
  let payload;
  try {
    if (paths.length === 0) throw new Error("Usage: npm run skills:check -- <skill-directory> [more-directories] [--json]");
    const workspaceRoot = realpathSync(process.cwd());
    const expanded = paths.flatMap((path) => {
      if (isAbsolute(path)) return [path];
      const target = resolve(workspaceRoot, path);
      if (!existsSync(target) || existsSync(join(target, "SKILL.md"))) return [path];
      return readdirSync(target, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && existsSync(join(target, entry.name, "SKILL.md")))
        .map((entry) => slash(join(path, entry.name)));
    });
    if (expanded.length === 0) throw new Error("No Skill packages were found under the supplied directories.");
    payload = result(expanded.flatMap((path) => validateSkill(workspaceRoot, path)));
  } catch (error) {
    payload = result([
      diagnostic("tool/configuration", "scripts/skills/validate.mjs", error instanceof Error ? error.message : String(error), "Correct the invocation or validator environment and rerun skills:check."),
    ], 2);
  }
  process.stdout.write(json ? `${JSON.stringify(payload, null, 2)}\n` : renderHuman(payload));
  process.exitCode = payload.exitCode;
}

main();
