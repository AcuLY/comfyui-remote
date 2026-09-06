import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { loadPolicy } from "../scripts/docs/check/config";
import { languageDiagnosticsForDocument, isFirstPartyMarkdown } from "../scripts/docs/check/language";
import { parseMarkdownDocument } from "../scripts/docs/check/markdown";

const FIXTURE_ROOT = "tests/fixtures/documentation-governance/language";

function diagnosticsForFixture(file: string, governedPath = `docs/${file}`) {
  const policy = loadPolicy(process.cwd());
  const source = readFileSync(`${FIXTURE_ROOT}/${file}`, "utf8");
  return languageDiagnosticsForDocument({
    path: governedPath,
    document: parseMarkdownDocument(governedPath, source),
    policy,
    owner: "documentation-governance",
  });
}

function diagnosticsForSource(source: string) {
  const path = "docs/language-gate-probe.md";
  return languageDiagnosticsForDocument({
    path,
    document: parseMarkdownDocument(path, source),
    policy: loadPolicy(process.cwd()),
    owner: "documentation-governance",
  });
}

test("Chinese human text accepts technical tokens and controlled OpenSpec structure keywords", () => {
  assert.deepEqual(
    diagnosticsForFixture("valid-zh-cn.md", "openspec/changes/language-gate/spec.md"),
    [],
  );
  assert.deepEqual(diagnosticsForFixture("valid-frontmatter-zh-cn.md"), []);
});

test("human-readable frontmatter is checked while stable identifiers, paths, and commands are excluded", () => {
  const diagnostics = diagnosticsForFixture("invalid-frontmatter-english.md");

  assert.equal(diagnostics.length, 5, JSON.stringify(diagnostics));
  for (const field of [
    "document.readWhen[0]",
    "document.environment[0]",
    "document.risk",
    "document.activation.condition",
    "document.authorityBoundary",
  ]) {
    assert.ok(diagnostics.some(({ evidence }) => evidence.includes(field)), `${field} must be checked`);
  }
  assert.ok(diagnostics.every(({ location }) => location.line > 1));
  for (const excluded of ["recovery", "sources", "verifiedBy", "generator", "inputs", "regenerate", "check"]) {
    assert.equal(
      diagnostics.some(({ evidence }) => evidence.includes(`document.${excluded}`)),
      false,
      `${excluded} must remain a stable path, command, or anchor field`,
    );
  }
});

test("first-party Skill descriptions are human text while Skill names remain stable identifiers", () => {
  const diagnostics = diagnosticsForFixture("invalid-skill-frontmatter.md");

  assert.equal(diagnostics.length, 1, JSON.stringify(diagnostics));
  assert.match(diagnostics[0].evidence, /metadata field description/);
  assert.equal(diagnostics[0].location.line, 3);
  assert.doesNotMatch(diagnostics[0].evidence, /metadata field name/);
});

test("English headings, paragraphs, table cells, HTML, and OpenSpec content fail per AST block", () => {
  const diagnostics = diagnosticsForFixture("invalid-english.md");

  assert.ok(diagnostics.length >= 8, JSON.stringify(diagnostics));
  assert.ok(diagnostics.every(({ ruleId }) => ruleId === "language/required-language"));
  assert.deepEqual(
    diagnostics.map(({ location }) => location.line),
    [...diagnostics.map(({ location }) => location.line)].sort((left, right) => left - right),
  );
  for (const snippet of [
    "English heading",
    "This paragraph is entirely English",
    "English requirement name",
    "English scenario name",
    "the request contains only English prose",
    "English table cell",
    "Visible English HTML prose",
  ]) {
    assert.ok(
      diagnostics.some(({ evidence }) => evidence.includes(snippet)),
      `${snippet} must produce a stable language diagnostic`,
    );
  }
});

test("short Chinese prefixes and command prefixes cannot hide English prose", () => {
  for (const source of [
    "# 中 This is English\n",
    "# 中 current design plan implementation status\n",
    "# 中 current design plan implementation\n",
    "git status shows the working tree state\n",
  ]) {
    const diagnostics = diagnosticsForSource(source);
    assert.equal(diagnostics.length, 1, `${source}: ${JSON.stringify(diagnostics)}`);
    assert.equal(diagnostics[0].ruleId, "language/required-language");
  }

  assert.deepEqual(diagnosticsForSource("git status --short\n"), []);
});

test("uppercase prose, encoded HTML, accessibility labels, and link titles remain human text", () => {
  for (const source of [
    "# THIS IS AN ENGLISH SENTENCE\n",
    "<p>&#69;&#110;&#103;&#108;&#105;&#115;&#104;</p>\n",
    '<p aria-label="&#69&#110&#103&#108&#105&#115&#104"></p>\n',
    '<button aria-label="English action"></button>\n',
    '<div aria-description="English accessible description"></div>\n',
    '<div aria-roledescription="English role description"></div>\n',
    '<div aria-braillelabel="English braille label"></div>\n',
    '<option label="English option"></option>\n',
    '<math alttext="English formula description"></math>\n',
    '<input value="English visible value">\n',
    '[中文链接](README.md "English link title")\n',
    '![English alternate text][img]\n\n[img]: README.md\n',
    '[中文链接][ref]\n\n[ref]: README.md "English reference title"\n',
  ]) {
    const diagnostics = diagnosticsForSource(source);
    assert.equal(diagnostics.length, 1, `${source}: ${JSON.stringify(diagnostics)}`);
  }
  assert.deepEqual(diagnosticsForSource("# API 与 MCP 接口\n"), []);
  for (const source of [
    "使用 Docker Compose 部署。\n",
    "使用 Playwright 运行 E2E 测试。\n",
    "使用 Next.js App Router。\n",
    '<math alttext="中文公式说明"></math>\n',
  ]) {
    assert.deepEqual(diagnosticsForSource(source), [], source);
  }
});

test("fenced code validation follows blockquote and list containers", () => {
  for (const source of [
    "```",
    "~~~",
    "> ```text\n> English hidden prose\n",
    "- ```text\n  English hidden prose\n",
  ]) {
    assert.throws(
      () => parseMarkdownDocument("docs/container-fence.md", source),
      /missing its closing fence/,
    );
  }
  assert.doesNotThrow(() => parseMarkdownDocument(
    "docs/container-fence.md",
    "- ```text\n  English code payload\n  ```\n",
  ));
});

test("OpenSpec structure words are exempt only inside OpenSpec Markdown", () => {
  for (const source of [
    "# Why\n",
    "## Migration Plan\n",
    "### Requirement: API client\n",
  ]) {
    assert.equal(diagnosticsForSource(source).length, 1, source);
  }
  const path = "openspec/changes/language-gate/spec.md";
  const source = "# Why\n\n### Requirement: 中文 API 契约\n";
  assert.deepEqual(languageDiagnosticsForDocument({
    path,
    document: parseMarkdownDocument(path, source),
    policy: loadPolicy(process.cwd()),
    owner: "documentation-governance",
  }), []);
});

test("the position preset exception covers only prompt paragraphs after level-three headings", () => {
  const path = "docs/product/shared-resources/position-presets.md";
  const source = [
    "# English title must still fail",
    "",
    "### 中文条目",
    "",
    "english prompt payload remains intentionally untranslated",
    "",
    "ordinary English prose outside the prompt slot must fail",
    "",
  ].join("\n");
  const diagnostics = languageDiagnosticsForDocument({
    path,
    document: parseMarkdownDocument(path, source),
    policy: loadPolicy(process.cwd()),
    owner: "product-prompt-reference",
  });

  assert.deepEqual(
    diagnostics.map(({ location, evidence }) => [location.line, evidence.includes("prompt payload")]),
    [[1, false], [7, false]],
  );
});

test("中文文档范围只排除声明的测试 fixture", () => {
  const policy = loadPolicy(process.cwd());
  for (const path of [
    "tests/fixtures/documentation-governance/language/invalid-english.md",
    "openspec/changes/rebuild-documentation-governance/evidence/pretooluse-file-access-poc/fixture/AGENTS.md",
  ]) {
    assert.equal(isFirstPartyMarkdown(path, policy), false, `${path} 必须是显式 fixture 例外`);
  }
  for (const path of [
    "README.md",
    ".codex/skills/docs-audit/SKILL.md",
    ".codex/skills/ui-ux-pro-max/SKILL.md",
    ".codebuddy/skills/ui-ux-pro-max/SKILL.md",
    "docs/archive/legacy.md",
    "openspec/changes/rebuild-documentation-governance/design.md",
    "reports/quality/report.md",
    "REPORT.MD",
  ]) {
    assert.equal(isFirstPartyMarkdown(path, policy), true, `${path} 必须保留在中文文档范围内`);
  }
});
