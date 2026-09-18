import type {
  Diagnostic,
  GovernancePolicy,
  MarkdownHumanTextBlock,
  ParsedMarkdownDocument,
} from "./model";
import { matchesRule } from "./path";

const OPENSPEC_STRUCTURE_HEADINGS = new Set([
  "why",
  "what changes",
  "capabilities",
  "new capabilities",
  "modified capabilities",
  "removed capabilities",
  "impact",
  "context",
  "goals / non-goals",
  "goals",
  "non-goals",
  "decisions",
  "risks / trade-offs",
  "migration plan",
  "open questions",
  "requirements",
  "added requirements",
  "modified requirements",
  "removed requirements",
  "renamed requirements",
]);

const TECHNICAL_PHRASES = [
  "ComfyUI Manager",
  "Manager HTTP",
  "MCP Streamable HTTP",
  "Streamable HTTP",
  "Web Standard Streamable HTTP",
  "Model Context Protocol",
  "Windows PowerShell",
];

const TECHNICAL_TERMS = new Set([
  "api",
  "app",
  "application",
  "aria",
  "ast",
  "base64",
  "bearer",
  "cd",
  "ci",
  "cli",
  "client",
  "checkpoint",
  "codex",
  "compose",
  "comfyui",
  "cookie",
  "csv",
  "css",
  "docker",
  "dto",
  "e2e",
  "endpoint",
  "feature",
  "generation",
  "harness",
  "fixture",
  "frontmatter",
  "gfm",
  "git",
  "github",
  "header",
  "hook",
  "html",
  "http",
  "https",
  "id",
  "iconv",
  "javascript",
  "json",
  "jsonl",
  "linux",
  "lib",
  "lora",
  "macos",
  "markdown",
  "manager",
  "mcp",
  "module",
  "next",
  "nextjs",
  "node",
  "npm",
  "npx",
  "openspec",
  "payload",
  "phase",
  "playwright",
  "pnpm",
  "posix",
  "postgresql",
  "powershell",
  "prisma",
  "provider",
  "prompt",
  "python",
  "react",
  "repository",
  "rest",
  "request",
  "response",
  "router",
  "rsc",
  "runtime",
  "schema",
  "sdk",
  "scp",
  "sdxl",
  "server",
  "slo",
  "sql",
  "sqlite",
  "ssh",
  "tailwind",
  "token",
  "tls",
  "training",
  "toml",
  "tsx",
  "typescript",
  "ui",
  "url",
  "ux",
  "webhook",
  "webpack",
  "windows",
  "worker",
  "wsl",
  "xml",
  "yaml",
  "zsh",
  "escape",
  "mypc",
  "pid",
  "prd",
  "px",
  "readme",
  "favicon",
  "instrumentation",
]);

const MIXED_TECHNICAL_TERMS = new Set([
  "agent",
  "analysis",
  "anchor",
  "archive",
  "artifact",
  "authority",
  "base",
  "benchmark",
  "boundary",
  "build",
  "category",
  "changed",
  "check",
  "claim",
  "comparison",
  "confidence",
  "config",
  "conflict",
  "consumer",
  "content",
  "contract",
  "critique",
  "deferred",
  "deployment",
  "design",
  "detector",
  "diff",
  "digest",
  "directory",
  "disposition",
  "document",
  "environment",
  "evidence",
  "fast",
  "finding",
  "fingerprint",
  "frontend",
  "full",
  "generated",
  "generator",
  "guide",
  "heading",
  "history",
  "implementation",
  "import",
  "interactive",
  "inventory",
  "link",
  "live",
  "loader",
  "local",
  "maintenance",
  "merge",
  "metadata",
  "migration",
  "mode",
  "navigation",
  "normalization",
  "note",
  "output",
  "owner",
  "parity",
  "path",
  "plan",
  "plans",
  "policy",
  "profile",
  "proposal",
  "prototype",
  "recovery",
  "reference",
  "regex",
  "resolution",
  "revision",
  "risk",
  "routing",
  "rule",
  "runbook",
  "safety",
  "scope",
  "sidecar",
  "signal",
  "skill",
  "skills",
  "slug",
  "snapshot",
  "spec",
  "specs",
  "staged",
  "strict",
  "tasks",
  "test",
  "testing",
  "topology",
  "tracked",
  "trigger",
  "untracked",
  "validation",
  "verification",
  "verifier",
  "workflow",
]);

const PROTOCOL_TABLE_TERMS = new Set([
  "architecture",
  "canonical",
  "condition",
  "current",
  "data",
  "deferred",
  "design",
  "details",
  "error",
  "generated",
  "kind",
  "message",
  "method",
  "ok",
  "owner",
  "path",
  "placeholder",
  "product",
  "reference",
  "request",
  "response",
  "router",
  "runbook",
  "source",
  "stage",
  "status",
  "subject",
  "testing",
  "type",
]);

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

function stripOpenSpecStructure(
  text: string,
  block: MarkdownHumanTextBlock,
  allowOpenSpecStructure: boolean,
): string {
  let remainder = text.trim();
  if (!allowOpenSpecStructure) return remainder;
  if (block.kind === "heading" && OPENSPEC_STRUCTURE_HEADINGS.has(remainder.toLowerCase())) {
    return "";
  }
  if (block.kind === "heading") {
    remainder = remainder.replace(/^(?:ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*:?[ \t]*/i, "");
    remainder = remainder.replace(/^(?:Requirement|Scenario)\s*:[ \t]*/i, "");
  }
  return remainder.replace(/^(?:GIVEN|WHEN|THEN|AND|BUT)\b\s*:?[ \t]*/i, "");
}

function stripTechnicalPhrases(text: string): string {
  return [...TECHNICAL_PHRASES].sort((left, right) => right.length - left.length).reduce(
    (result, phrase) => result.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " "),
    text,
  );
}

function isCommandArgument(token: string): boolean {
  return /^(?:"[^"]*"|'[^']*')$/.test(token)
    || /^(?:--?|\/)[A-Za-z\d][A-Za-z\d_.-]*(?:=.*)?$/.test(token)
    || /^(?:[A-Za-z_][A-Za-z\d_]*=).+$/.test(token)
    || isIdentifierLike(token)
    || /^\d+(?:\.\d+)*$/.test(token)
    || /^(?:HEAD|ORIG_HEAD|FETCH_HEAD|main|master|origin|upstream|true|false|null)$/i.test(token)
    || /^(?:\||\|\||&&|;|>|>>|<)$/.test(token);
}

function isPlainCommand(text: string): boolean {
  const normalized = text.trim().replace(/^(?:\$|>)\s*/, "");
  const prefixes = [
    /^(?:npm|pnpm|yarn)\s+(?:run|exec|test|install|ci|add)(?:\s+\S+)?/i,
    /^npx\s+\S+/i,
    /^node\s+(?:(?:--import|-r)\s+\S+|\S+)/i,
    /^tsx\s+\S+/i,
    /^git\s+(?:add|branch|checkout|commit|diff|fetch|log|merge|pull|push|restore|show|status|switch)\b/i,
    /^(?:python|python3)\s+(?:-m\s+\S+|\S+)/i,
    /^(?:pip|pip3|pwsh|powershell|bash|sh|docker|openspec|codex)\s+\S+/i,
    /^[A-Z][A-Za-z\d]*-[A-Z][A-Za-z\d]*(?=\s|$)/,
  ];
  const prefix = prefixes.map((pattern) => pattern.exec(normalized)).find(Boolean);
  if (!prefix || prefix.index !== 0) return false;
  const remainder = normalized.slice(prefix[0].length).trim();
  if (!remainder) return true;
  const tokens = remainder.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  return tokens.length > 0 && tokens.every(isCommandArgument);
}

function isIdentifierLike(token: string): boolean {
  return ["\\", "/", "@", ".", "_", ":", "{", "}", "[", "]", "*", "+", "=", "$"].some((marker) => token.includes(marker))
    || /--[a-z]/i.test(token)
    || /[a-z][A-Z]/.test(token)
    || /[A-Za-z]\d|\d[A-Za-z]/.test(token)
    || /^[a-z][a-z\d]*(?:-[a-z\d]+)+$/i.test(token);
}

function isTechnicalToken(
  token: string,
  block: MarkdownHumanTextBlock,
  allowMixedTechnicalTerms: boolean,
): boolean {
  const unwrapped = token.replace(/^["'(<]+|["')>,.;!?]+$/g, "");
  if (!unwrapped) return true;
  if (HTTP_METHODS.has(unwrapped.toUpperCase())) return true;
  if (isIdentifierLike(unwrapped)) return true;
  const lower = unwrapped.toLowerCase();
  if (TECHNICAL_TERMS.has(lower)) return true;
  if (allowMixedTechnicalTerms && MIXED_TECHNICAL_TERMS.has(lower)) return true;
  return block.kind === "table-cell" && PROTOCOL_TABLE_TERMS.has(lower);
}

function ordinaryLatinWords(
  text: string,
  block: MarkdownHumanTextBlock,
  allowMixedTechnicalTerms: boolean,
): string[] {
  const tokens = text.match(/[A-Za-z][A-Za-z\d]*(?:[._:/@{}*+'-][A-Za-z\d]+)*/g) ?? [];
  return tokens.filter((token) => !isTechnicalToken(token, block, allowMixedTechnicalTerms));
}

function mixedTechnicalLetterCount(text: string): number {
  const tokens = text.match(/[A-Za-z][A-Za-z\d]*(?:[._:/@{}*+'-][A-Za-z\d]+)*/g) ?? [];
  return tokens.reduce((total, token) => {
    const unwrapped = token.replace(/^["'(<]+|["')>,.;!?]+$/g, "").toLowerCase();
    if (!MIXED_TECHNICAL_TERMS.has(unwrapped)) return total;
    return total + (token.match(/[A-Za-z]/g)?.length ?? 0);
  }, 0);
}

type RequiredLanguageAnalysis = {
  valid: boolean;
  ordinaryWords: string[];
  hanCount: number;
  latinLetterCount: number;
  mixedTechnicalLetterCount: number;
  otherLetterCount: number;
};

function requiredLanguageAnalysis(
  text: string,
  block: MarkdownHumanTextBlock,
  path: string,
): RequiredLanguageAnalysis {
  let remainder = stripOpenSpecStructure(text, block, path.startsWith("openspec/"));
  if (!remainder || isPlainCommand(remainder)) {
    return {
      valid: true,
      ordinaryWords: [],
      hanCount: 0,
      latinLetterCount: 0,
      mixedTechnicalLetterCount: 0,
      otherLetterCount: 0,
    };
  }
  remainder = stripTechnicalPhrases(remainder)
    .replace(/(?:https?:\/\/|mailto:)[^\s)\]}]+/gi, " ")
    .replace(/(?:^|\s)(?:[A-Za-z]:[\\/]|\.{0,2}[\\/]|[A-Za-z\d_.-]+[\\/])(?:[A-Za-z\d_.{}*-]+[\\/])*[A-Za-z\d_.{}*-]+/g, " ");

  const hanCount = [...remainder.matchAll(/\p{Script=Han}/gu)].length;
  const ordinaryWords = ordinaryLatinWords(remainder, block, hanCount > 0);
  const latinLetterCount = [...remainder.matchAll(/[A-Za-z]/g)].length;
  const mixedLetterCount = mixedTechnicalLetterCount(remainder);
  const otherLetterCount = [...remainder.matchAll(/\p{Letter}/gu)].length
    - hanCount
    - latinLetterCount;
  if (ordinaryWords.length > 0 || otherLetterCount > 0) {
    return {
      valid: false,
      ordinaryWords,
      hanCount,
      latinLetterCount,
      mixedTechnicalLetterCount: mixedLetterCount,
      otherLetterCount,
    };
  }
  if (hanCount === 0) {
    return {
      valid: true,
      ordinaryWords,
      hanCount,
      latinLetterCount,
      mixedTechnicalLetterCount: mixedLetterCount,
      otherLetterCount,
    };
  }

  // 技术词可以保留原文，但不能用极少量汉字掩盖以英文为主体的正文。
  return {
    valid: mixedLetterCount <= hanCount * 4,
    ordinaryWords,
    hanCount,
    latinLetterCount,
    mixedTechnicalLetterCount: mixedLetterCount,
    otherLetterCount,
  };
}

function isDataPayloadException(
  path: string,
  block: MarkdownHumanTextBlock,
  policy: GovernancePolicy,
): boolean {
  return policy.language.dataPayloadExceptions.some((exception) =>
    exception.path === path
      && exception.kind === "paragraph-after-heading"
      && block.kind === "paragraph"
      && block.afterHeadingDepth === exception.headingDepth,
  );
}

function snippet(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= 96 ? normalized : `${normalized.slice(0, 93)}...`;
}

export function isFirstPartyMarkdown(path: string, policy: GovernancePolicy): boolean {
  const normalizedMarkdownPath = path.replace(/\.md$/i, ".md");
  return path.toLowerCase().endsWith(".md") && matchesRule(
    normalizedMarkdownPath,
    policy.language.firstPartyMarkdown.include,
    policy.language.firstPartyMarkdown.exclude,
  );
}

export function languageDiagnosticsForDocument(input: {
  path: string;
  document: ParsedMarkdownDocument;
  policy: GovernancePolicy;
  owner: string;
}): Diagnostic[] {
  if (!isFirstPartyMarkdown(input.path, input.policy)) return [];
  return input.document.humanTextBlocks.flatMap((block) => {
    if (isDataPayloadException(input.path, block, input.policy)) return [];
    const structuredText = stripOpenSpecStructure(block.text, block, input.path.startsWith("openspec/"));
    const analysis = requiredLanguageAnalysis(block.text, block, input.path);
    if (analysis.valid) return [];
    const blockLabel = block.kind === "metadata"
      ? `metadata field ${block.metadataField ?? "document"}`
      : block.kind;
    const detail = analysis.ordinaryWords.length > 0
      ? ` Unexpected prose words: ${JSON.stringify([...new Set(analysis.ordinaryWords.map((word) => word.toLowerCase()))].slice(0, 12))}.`
      : ` Generic technical terms outweigh Chinese context (${analysis.mixedTechnicalLetterCount}:${analysis.hanCount}).`;
    return [{
      ruleId: "language/required-language",
      severity: "error" as const,
      path: input.path,
      location: block.location,
      evidence: `Human-readable ${blockLabel} must use zh-CN; found non-Chinese prose: ${JSON.stringify(snippet(structuredText || block.text))}.${detail}`,
      remediation: "Translate the human-readable text to Chinese or move technical data into an approved code or data-payload surface.",
      owner: input.owner,
    }];
  });
}
