import yaml from "js-yaml";
import GithubSlugger from "github-slugger";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import type { ParsedMarkdownDocument } from "./model";

type AstNode = {
  type: string;
  value?: string;
  url?: string;
  children?: AstNode[];
  position?: {
    start: { line: number; column: number };
  };
};

function splitFrontmatter(source: string): { metadata: unknown; body: string; lineOffset: number } {
  const normalized = source.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n");
  const lines = normalized.split("\n");
  if (lines[0] !== "---") {
    return { metadata: null, body: normalized, lineOffset: 0 };
  }
  const end = lines.findIndex((line, index) => index > 0 && line === "---");
  if (end < 0) {
    throw new Error("YAML frontmatter is missing its closing delimiter.");
  }
  const parsed = yaml.load(lines.slice(1, end).join("\n"));
  return {
    metadata: parsed,
    body: lines.slice(end + 1).join("\n"),
    lineOffset: end + 1,
  };
}

function nodeText(node: AstNode): string {
  if (typeof node.value === "string") {
    return node.value;
  }
  return (node.children ?? []).map(nodeText).join("");
}

export function parseMarkdownDocument(path: string, source: string): ParsedMarkdownDocument {
  const { metadata, body, lineOffset } = splitFrontmatter(source);
  const tree = unified().use(remarkParse).use(remarkGfm).parse(body) as AstNode;
  const slugger = new GithubSlugger();
  const anchors = new Set<string>();
  const links: ParsedMarkdownDocument["links"] = [];
  const liveText: string[] = [];

  const visit = (node: AstNode, ignored = false): void => {
    const nextIgnored = ignored || node.type === "code" || node.type === "inlineCode" || node.type === "html";
    if (!nextIgnored && node.type === "heading") {
      anchors.add(slugger.slug(nodeText(node)));
    }
    if (!nextIgnored && (node.type === "link" || node.type === "image" || node.type === "definition") && typeof node.url === "string") {
      links.push({
        url: node.url,
        location: {
          line: (node.position?.start.line ?? 1) + lineOffset,
          column: node.position?.start.column ?? 1,
        },
      });
    }
    if (!nextIgnored && node.type === "text" && typeof node.value === "string") {
      liveText.push(node.value);
    }
    for (const child of node.children ?? []) {
      visit(child, nextIgnored);
    }
  };
  visit(tree);

  return {
    path,
    metadata,
    metadataLocation: { line: 1, column: 1 },
    body,
    anchors,
    links,
    liveText: liveText.join("\n"),
  };
}
