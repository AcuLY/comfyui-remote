import yaml from "js-yaml";
import GithubSlugger from "github-slugger";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import type { MarkdownHumanTextBlock, ParsedMarkdownDocument } from "./model";

type AstNode = {
  type: string;
  value?: string;
  url?: string;
  alt?: string;
  title?: string;
  depth?: number;
  children?: AstNode[];
  position?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
};

function splitFrontmatter(source: string): {
  metadata: unknown;
  body: string;
  lineOffset: number;
  frontmatterLines: string[];
} {
  const normalized = source.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n");
  const lines = normalized.split("\n");
  if (lines[0] !== "---") {
    return { metadata: null, body: normalized, lineOffset: 0, frontmatterLines: [] };
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
    frontmatterLines: lines.slice(1, end),
  };
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function metadataFieldLocation(lines: string[], key: string, itemIndex?: number): { line: number; column: number } {
  const keyPattern = new RegExp(`^(\\s*)${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:`);
  const keyIndex = lines.findIndex((line) => keyPattern.test(line));
  if (keyIndex < 0) return { line: 1, column: 1 };
  const keyMatch = keyPattern.exec(lines[keyIndex]);
  const keyIndent = keyMatch?.[1].length ?? 0;
  if (itemIndex !== undefined && !/\[[^\]]*\]\s*$/.test(lines[keyIndex])) {
    let currentItem = 0;
    for (let index = keyIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line.trim()) continue;
      const indent = /^\s*/.exec(line)?.[0].length ?? 0;
      if (indent <= keyIndent) break;
      if (!/^\s*-\s+/.test(line)) continue;
      if (currentItem === itemIndex) {
        return { line: index + 2, column: indent + 1 };
      }
      currentItem += 1;
    }
  }
  return { line: keyIndex + 2, column: keyIndent + 1 };
}

function collectMetadataHumanTextBlocks(
  metadata: unknown,
  lines: string[],
): MarkdownHumanTextBlock[] {
  const root = objectValue(metadata);
  const blocks: MarkdownHumanTextBlock[] = [];
  if (typeof root?.description === "string" && root.description.trim()) {
    blocks.push({
      kind: "metadata",
      metadataField: "description",
      text: root.description.trim(),
      location: metadataFieldLocation(lines, "description"),
    });
  }
  const document = objectValue(root?.document);
  if (!document) return blocks;
  const addScalar = (field: string, value: unknown, key = field): void => {
    if (typeof value !== "string" || !value.trim()) return;
    blocks.push({
      kind: "metadata",
      metadataField: `document.${field}`,
      text: value.trim(),
      location: metadataFieldLocation(lines, key),
    });
  };
  const addList = (field: string, value: unknown): void => {
    if (!Array.isArray(value)) return;
    value.forEach((item, index) => {
      if (typeof item !== "string" || !item.trim()) return;
      blocks.push({
        kind: "metadata",
        metadataField: `document.${field}[${index}]`,
        text: item.trim(),
        location: metadataFieldLocation(lines, field, index),
      });
    });
  };

  addList("readWhen", document.readWhen);
  addList("environment", document.environment);
  addScalar("risk", document.risk);
  const activation = objectValue(document.activation);
  if (activation) addScalar("activation.condition", activation.condition, "condition");
  addScalar("authorityBoundary", document.authorityBoundary);
  return blocks;
}

function nodeText(node: AstNode): string {
  if (typeof node.value === "string") {
    return node.value;
  }
  return (node.children ?? []).map(nodeText).join("");
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(?:#(\d+);?|#x([\da-f]+);?|([a-z][\da-z]+);)/gi, (entity, decimal, hex, name) => {
    if (decimal || hex) {
      const point = Number.parseInt(decimal ?? hex, decimal ? 10 : 16);
      if (Number.isSafeInteger(point) && point >= 0 && point <= 0x10ffff) {
        try {
          return String.fromCodePoint(point);
        } catch {
          return entity;
        }
      }
      return entity;
    }
    return named[String(name).toLowerCase()] ?? entity;
  });
}

function visibleHtmlText(value: string): string {
  const sanitized = value
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, " ");
  const attributes = [...sanitized.matchAll(
    /\s(?:aria-(?:label|description|roledescription|braillelabel|brailleroledescription|valuetext|placeholder|keyshortcuts)|title|alt|alttext|placeholder|value|label|summary|abbr)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
  )].map((match) => match[1] ?? match[2] ?? match[3] ?? "");
  const visible = sanitized.replace(/<[^>]*>/g, " ");
  return decodeHtmlEntities([...attributes, visible].join(" "));
}

function humanNodeText(node: AstNode): string {
  if (node.type === "code" || node.type === "inlineCode") {
    return "";
  }
  if (node.type === "definition") {
    return node.title ?? "";
  }
  if (node.type === "image" || node.type === "imageReference") {
    return [node.alt, node.title].filter(Boolean).join(" ");
  }
  if (node.type === "link") {
    return [(node.children ?? []).map(humanNodeText).join(""), node.title].filter(Boolean).join(" ");
  }
  if (node.type === "html") {
    return typeof node.value === "string" ? visibleHtmlText(node.value) : "";
  }
  if (node.type === "break") {
    return " ";
  }
  if (typeof node.value === "string") {
    return node.value;
  }
  return (node.children ?? []).map(humanNodeText).join("");
}

function assertClosedFencedCodeBlocks(tree: AstNode, body: string, lineOffset: number): void {
  const lines = body.split("\n");
  const visit = (node: AstNode): void => {
    if (node.type === "code" && node.position) {
      const startLine = lines[node.position.start.line - 1] ?? "";
      const opening = /^(`{3,}|~{3,})/.exec(startLine.slice(node.position.start.column - 1));
      if (opening) {
        const endLine = lines[node.position.end.line - 1] ?? "";
        const closing = /^[ \t>]*(`{3,}|~{3,})[ \t]*$/.exec(endLine);
        if (
          node.position.end.line === node.position.start.line
          ||
          !closing
          || closing[1][0] !== opening[1][0]
          || closing[1].length < opening[1].length
        ) {
          const line = node.position.start.line + lineOffset;
          throw new Error(`Markdown fenced code block opened at line ${line} is missing its closing fence.`);
        }
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
}

function collectHumanTextBlocks(tree: AstNode, lineOffset: number): MarkdownHumanTextBlock[] {
  const blocks: MarkdownHumanTextBlock[] = [];
  const add = (
    node: AstNode,
    kind: MarkdownHumanTextBlock["kind"],
    extra: Pick<MarkdownHumanTextBlock, "headingDepth" | "afterHeadingDepth"> = {},
  ): void => {
    const text = humanNodeText(node).replace(/\s+/g, " ").trim();
    if (!text) return;
    blocks.push({
      kind,
      text,
      location: {
        line: (node.position?.start.line ?? 1) + lineOffset,
        column: node.position?.start.column ?? 1,
      },
      ...extra,
    });
  };

  const visitNested = (node: AstNode): void => {
    if (node.type === "code" || node.type === "inlineCode") return;
    if (node.type === "heading") {
      add(node, "heading", { headingDepth: node.depth });
      return;
    }
    if (node.type === "paragraph") {
      add(node, "paragraph");
      return;
    }
    if (node.type === "tableCell") {
      add(node, "table-cell");
      return;
    }
    if (node.type === "html") {
      add(node, "html");
      return;
    }
    if (node.type === "definition") {
      add(node, "paragraph");
      return;
    }
    for (const child of node.children ?? []) visitNested(child);
  };

  let precedingHeadingDepth: number | undefined;
  for (const child of tree.children ?? []) {
    if (child.type === "heading") {
      add(child, "heading", { headingDepth: child.depth });
      precedingHeadingDepth = child.depth;
      continue;
    }
    if (child.type === "paragraph") {
      add(child, "paragraph", { afterHeadingDepth: precedingHeadingDepth });
      precedingHeadingDepth = undefined;
      continue;
    }
    visitNested(child);
    precedingHeadingDepth = undefined;
  }
  return blocks;
}

export function parseMarkdownDocument(path: string, source: string): ParsedMarkdownDocument {
  const { metadata, body, lineOffset, frontmatterLines } = splitFrontmatter(source);
  const tree = unified().use(remarkParse).use(remarkGfm).parse(body) as AstNode;
  assertClosedFencedCodeBlocks(tree, body, lineOffset);
  const slugger = new GithubSlugger();
  const anchors = new Set<string>();
  const links: ParsedMarkdownDocument["links"] = [];
  const liveText: string[] = [];
  const humanTextBlocks = [
    ...collectMetadataHumanTextBlocks(metadata, frontmatterLines),
    ...collectHumanTextBlocks(tree, lineOffset),
  ];

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
    humanTextBlocks,
  };
}
