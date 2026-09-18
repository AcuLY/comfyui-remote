export type DiagnosticSeverity = "error" | "warning";

export type DiagnosticLocation = {
  line: number;
  column: number;
};

export type Diagnostic = {
  ruleId: string;
  severity: DiagnosticSeverity;
  path: string;
  location: DiagnosticLocation;
  evidence: string;
  remediation: string;
  owner: string;
};

export type CheckMode = "full" | "fast";
export type OutputFormat = "human" | "json";

export type GitChange = {
  status: string;
  path: string;
  oldPath?: string;
};

export type ScopeRule = {
  id: string;
  kind: "current" | "openspec" | "skill" | "evidence" | "source-adjacent" | "meta" | string;
  include: string[];
  exclude: string[];
  frontmatter: "documentation" | "skill" | "none";
  links: boolean;
  navigation: boolean;
};

export type ProfileRule = {
  id: string;
  include: string[];
  exclude: string[];
  schemaProfile: string;
};

export type NavigationOwner = {
  id: string;
  landing: string;
  include: string[];
  exclude: string[];
  reverseLinkRequired: boolean;
};

export type ForbiddenLivePath = {
  path: string;
  owner: string;
  replacement: string;
};

export type SourceRelationship = {
  id: string;
  kind: "contract" | "review";
  sources: string[];
  documents: string[];
  owner: string;
  reason?: string;
  verifier?: string;
};

export type LanguageAllowedAsciiKind =
  | "repository-path"
  | "command"
  | "inline-code"
  | "fenced-code"
  | "protocol-field"
  | "openspec-structure-keyword";

export type LanguageDataPayloadException = {
  path: string;
  kind: "paragraph-after-heading";
  headingDepth: number;
};

export type LanguagePolicy = {
  requiredLanguage: "zh-CN";
  firstPartyMarkdown: {
    include: string[];
    exclude: string[];
  };
  allowedAscii: LanguageAllowedAsciiKind[];
  metadataExcludedFields: string[];
  dataPayloadExceptions: LanguageDataPayloadException[];
};

export type CommandAdapter = {
  id: string;
  command: string[];
  owner: string;
  output: string;
  remediation?: string;
};

export type ContractAdapterKind =
  | "route-api-mcp-documentation"
  | "runtime-configuration-documentation";

export type ContractAdapter = {
  id: string;
  kind: ContractAdapterKind;
  owner: string;
  output: string;
  remediation?: string;
};

export type GovernancePolicy = {
  schemaVersion: number;
  governedRoots: string[];
  rootEntrypoints: string[];
  language: LanguagePolicy;
  scope: ScopeRule[];
  profiles: ProfileRule[];
  requiredLandingPages: string[];
  navigation: {
    roots: string[];
    owners: NavigationOwner[];
  };
  forbiddenLivePaths: ForbiddenLivePath[];
  relationships: SourceRelationship[];
  adapters: {
    openspec: { enabled: boolean };
    skills: { enabled: boolean; paths: string[] };
    generators: CommandAdapter[];
    contracts: ContractAdapter[];
  };
};

export type ParsedMarkdownLink = {
  url: string;
  location: DiagnosticLocation;
};

export type MarkdownHumanTextBlock = {
  kind: "metadata" | "heading" | "paragraph" | "table-cell" | "html";
  text: string;
  location: DiagnosticLocation;
  metadataField?: string;
  headingDepth?: number;
  afterHeadingDepth?: number;
};

export type ParsedMarkdownDocument = {
  path: string;
  metadata: unknown;
  metadataLocation: DiagnosticLocation;
  body: string;
  anchors: Set<string>;
  links: ParsedMarkdownLink[];
  liveText: string;
  humanTextBlocks: MarkdownHumanTextBlock[];
};

export type CheckOptions = {
  root: string;
  mode: CheckMode;
  format: OutputFormat;
  base?: string;
  runAdapters: boolean;
};

export type CheckResult = {
  schemaVersion: 1;
  requestedMode: CheckMode;
  effectiveMode: CheckMode;
  base: string | null;
  escalationReasons: string[];
  diagnostics: Diagnostic[];
  summary: {
    errors: number;
    warnings: number;
  };
  exitCode: 0 | 1 | 2;
};
