import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadPolicy } from "../scripts/docs/check/config";
import { languageDiagnosticsForDocument } from "../scripts/docs/check/language";
import { parseMarkdownDocument } from "../scripts/docs/check/markdown";

const ROOT = process.cwd();
const VALIDATOR = join(ROOT, "scripts", "skills", "validate.mjs");
const FIXTURE = join(ROOT, "tests", "fixtures", "documentation-governance", "skills", "docs-audit");

async function createSkillRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "skills-check-"));
  const skill = join(root, ".codex", "skills", "docs-audit");
  await mkdir(join(root, ".codex", "skills"), { recursive: true });
  await cp(FIXTURE, skill, { recursive: true });
  return root;
}

function run(root: string, args = [".codex/skills/docs-audit", "--json"]) {
  return spawnSync(process.execPath, [VALIDATOR, ...args], { cwd: root, encoding: "utf8" });
}

function pythonMappingKeys(source: string, assignment: string): string[] {
  const marker = `${assignment} = {`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `缺少 Python 映射：${assignment}`);
  const bodyStart = source.indexOf("\n", start) + 1;
  const bodyEnd = source.indexOf("\n}", bodyStart);
  assert.notEqual(bodyEnd, -1, `Python 映射未闭合：${assignment}`);
  return [...source.slice(bodyStart, bodyEnd).matchAll(/^    "([^"]+)": \{/gm)]
    .map(([, key]) => key);
}

function markdownTableIdentifiers(source: string, heading: string): string[] {
  const section = source.match(
    new RegExp(`### ${heading}\\r?\\n\\r?\\n([\\s\\S]*?)(?=(?:\\r?\\n){2}(?:### |## ))`),
  );
  assert.ok(section, `缺少 Markdown 表格：${heading}`);
  return [...section[1].matchAll(/^\| `([^`]+)` \|/gm)].map(([, identifier]) => identifier);
}

test("repository Skill validator accepts a contained explicit-only docs-audit package", async () => {
  const root = await createSkillRoot();
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.deepEqual(payload.summary, { errors: 0, warnings: 0 });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("repository Skill validator accepts a Chinese explicit-invocation description", async () => {
  const root = await createSkillRoot();
  try {
    const skillPath = join(root, ".codex", "skills", "docs-audit", "SKILL.md");
    await writeFile(
      skillPath,
      (await readFile(skillPath, "utf8")).replace(
        "Explicitly audit repository documentation only when the user or an approved OpenSpec task invokes $docs-audit.",
        "仅在用户或已批准 OpenSpec 任务显式调用 $docs-audit 时审计仓库文档。",
      ),
    );
    const result = run(root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(JSON.parse(result.stdout).summary, { errors: 0, warnings: 0 });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("repository Skill validator reports broken and escaping bundled references", async () => {
  const root = await createSkillRoot();
  try {
    const skillPath = join(root, ".codex", "skills", "docs-audit", "SKILL.md");
    await writeFile(skillPath, `${await readFile(skillPath, "utf8")}\n[missing](references/missing.md)\n[escape](../../../outside.md)\n`);
    const result = run(root);
    assert.equal(result.status, 1, result.stderr || result.stdout);
    const rules = JSON.parse(result.stdout).diagnostics.map((item: { ruleId: string }) => item.ruleId);
    assert.ok(rules.includes("skill/reference-missing"));
    assert.ok(rules.includes("skill/path-escape"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("docs-audit requires matching name and disabled implicit invocation", async () => {
  const root = await createSkillRoot();
  try {
    const skillPath = join(root, ".codex", "skills", "docs-audit", "SKILL.md");
    await writeFile(skillPath, (await readFile(skillPath, "utf8")).replace("name: docs-audit", "name: other-name"));
    const openaiPath = join(root, ".codex", "skills", "docs-audit", "agents", "openai.yaml");
    await writeFile(openaiPath, (await readFile(openaiPath, "utf8")).replace("allow_implicit_invocation: false", "allow_implicit_invocation: true"));
    const result = run(root);
    assert.equal(result.status, 1, result.stderr || result.stdout);
    const rules = JSON.parse(result.stdout).diagnostics.map((item: { ruleId: string }) => item.ruleId);
    assert.ok(rules.includes("skill/name-folder-mismatch"));
    assert.ok(rules.includes("skill/implicit-invocation"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Skill validator reserves exit 2 for invocation and tool failures", () => {
  const result = spawnSync(process.execPath, [VALIDATOR, "--json"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 2, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).exitCode, 2);
});

test("两份 UI Skill 与实际搜索脚本、领域和技术栈实现保持一致", async () => {
  const variants = [
    {
      file: ".codex/skills/ui-ux-pro-max/SKILL.md",
      script: ".codex/skills/ui-ux-pro-max/scripts/search.py",
      core: ".codex/skills/ui-ux-pro-max/scripts/core.py",
      designSystem: ".codex/skills/ui-ux-pro-max/scripts/design_system.py",
    },
    {
      file: ".codebuddy/skills/ui-ux-pro-max/SKILL.md",
      script: ".codebuddy/skills/ui-ux-pro-max/scripts/search.py",
      core: ".codebuddy/skills/ui-ux-pro-max/scripts/core.py",
      designSystem: ".codebuddy/skills/ui-ux-pro-max/scripts/design_system.py",
    },
  ] as const;
  let canonicalStacks: string[] | undefined;
  let canonicalDomains: string[] | undefined;

  for (const { file, script, core, designSystem } of variants) {
    await access(join(ROOT, script));
    const source = await readFile(join(ROOT, file), "utf8");
    const coreSource = await readFile(join(ROOT, core), "utf8");
    const designSystemSource = await readFile(join(ROOT, designSystem), "utf8");
    const implementationStacks = pythonMappingKeys(coreSource, "STACK_CONFIG");
    const implementationDomains = pythonMappingKeys(coreSource, "CSV_CONFIG");
    const referencedScripts = [
      ...source.matchAll(/[.\w/-]*ui-ux-pro-max\/scripts\/search\.py/g),
    ].map(([value]) => value);

    assert.match(
      coreSource,
      /^AVAILABLE_STACKS = list\(STACK_CONFIG\.keys\(\)\)$/m,
      `${core} 的 AVAILABLE_STACKS 必须直接来自 STACK_CONFIG`,
    );
    assert.match(
      designSystemSource,
      /for domain, config in SEARCH_CONFIG\.items\(\):/,
      `${designSystem} 必须按配置顺序依次搜索`,
    );
    if (canonicalStacks) {
      assert.deepEqual(implementationStacks, canonicalStacks, "两份 core.py 的 AVAILABLE_STACKS 必须一致");
      assert.deepEqual(implementationDomains, canonicalDomains, "两份 core.py 的领域集合必须一致");
    } else {
      canonicalStacks = implementationStacks;
      canonicalDomains = implementationDomains;
    }
    assert.deepEqual(
      languageDiagnosticsForDocument({
        path: file,
        document: parseMarkdownDocument(file, source),
        policy: loadPolicy(ROOT),
        owner: "documentation-governance",
      }),
      [],
      `${file} 的第一方说明必须使用中文`,
    );
    assert.ok(referencedScripts.length >= 8, `${file} 应提供完整命令示例`);
    assert.ok(
      referencedScripts.every((value) => value === script),
      `${file} 的全部命令都必须指向 ${script}`,
    );
    assert.ok(
      source.includes(`python3 ${script} "<查询>" --design-system`),
      `${file} 必须明确 POSIX 使用 python3`,
    );
    assert.ok(
      source.includes(`python ${script} "<查询>" --design-system`),
      `${file} 必须明确 Windows 使用 python`,
    );

    assert.deepEqual(
      markdownTableIdentifiers(source, "可用技术栈"),
      implementationStacks,
      `${file} 的技术栈清单必须与 ${core} 一致`,
    );
    assert.deepEqual(
      markdownTableIdentifiers(source, "可用领域"),
      implementationDomains,
      `${file} 的领域清单必须与 ${core} 一致`,
    );
    assert.match(
      source,
      new RegExp(`可用技术栈（${implementationStacks.length} 个）`),
      `${file} 必须使用实现中的技术栈总数`,
    );
    assert.ok(
      source.includes("`design-system/<project-slug>/MASTER.md`")
      && source.includes("`design-system/<project-slug>/pages/<page-slug>.md`"),
      `${file} 必须记录真实的项目级持久化路径`,
    );
    assert.match(source, /按配置顺序依次搜索/, `${file} 必须说明同步依次搜索语义`);
    assert.doesNotMatch(source, /并行搜索/, `${file} 不得声称并行搜索`);
  }
});

test("两份 UI Skill 搜索 CLI 的帮助和生成文档路径与实现一致", async () => {
  const variants = [
    {
      script: ".codex/skills/ui-ux-pro-max/scripts/search.py",
      core: ".codex/skills/ui-ux-pro-max/scripts/core.py",
      designSystem: ".codex/skills/ui-ux-pro-max/scripts/design_system.py",
    },
    {
      script: ".codebuddy/skills/ui-ux-pro-max/scripts/search.py",
      core: ".codebuddy/skills/ui-ux-pro-max/scripts/core.py",
      designSystem: ".codebuddy/skills/ui-ux-pro-max/scripts/design_system.py",
    },
  ] as const;
  const python = process.platform === "win32" ? "python" : "python3";
  const stableOptions = [
    "--domain",
    "--stack",
    "--max-results",
    "--json",
    "--design-system",
    "--project-name",
    "--format",
    "--persist",
    "--page",
    "--output-dir",
  ];

  for (const { script, core, designSystem } of variants) {
    const scriptSource = await readFile(join(ROOT, script), "utf8");
    const coreSource = await readFile(join(ROOT, core), "utf8");
    const designSystemSource = await readFile(join(ROOT, designSystem), "utf8");
    const implementationDomains = pythonMappingKeys(coreSource, "CSV_CONFIG");

    assert.ok(
      scriptSource.includes(`领域：${implementationDomains.join("、")}`),
      `${script} 顶部领域说明必须与 ${core} 的 CSV_CONFIG 一致`,
    );
    assert.doesNotMatch(scriptSource, /\bprompt\b/i, `${script} 不得声明不存在的 prompt 领域`);
    assert.ok(
      scriptSource.includes("design-system/<project-slug>/MASTER.md")
      && scriptSource.includes("design-system/<project-slug>/pages/<page-slug>.md"),
      `${script} 必须说明项目级持久化路径`,
    );
    assert.ok(
      designSystemSource.includes("`pages/[page-name].md`")
      && designSystemSource.includes("`MASTER.md`"),
      `${designSystem} 生成的 Markdown 必须使用项目目录内相对路径`,
    );
    assert.doesNotMatch(
      designSystemSource,
      /`design-system\/(?:pages\/\[page-name\]\.md|MASTER\.md)`/,
      `${designSystem} 不得在项目目录内重复引用 design-system 前缀`,
    );

    const result = spawnSync(python, [script, "--help"], {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        PYTHONDONTWRITEBYTECODE: "1",
        PYTHONIOENCODING: "utf-8",
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const help = result.stdout.replaceAll("\r\n", "\n");
    assert.ok(
      help.includes(`{${implementationDomains.join(",")}}`),
      `${script} --help 的领域选项必须来自 CSV_CONFIG`,
    );
    assert.match(help, /搜索 UI\/UX 指南或生成设计系统建议/);
    assert.match(help, /搜索领域/);
    assert.match(help, /保存到 design-system\/<project-slug>\/MASTER\.md/);
    assert.match(help, /创建 design-system\/<project-slug>\/pages\/<page-slug>\.md\s+页面覆盖文件/);
    assert.doesNotMatch(help, /\bprompt\b|Search domain|Save design system|Create page-specific/i);
    for (const option of stableOptions) {
      assert.ok(help.includes(option), `${script} --help 缺少稳定参数 ${option}`);
    }
  }
});
