type RouteParams = Record<string, string>;
type FallbackDestination = string | ((params: RouteParams) => string | null);

type FallbackRule = {
  pattern: string;
  destination: FallbackDestination;
};

const PAGE_ROUTE_PATTERNS = [
  "/",
  "/assets/loras",
  "/assets/models",
  "/assets/preset-groups/[groupId]",
  "/assets/presets",
  "/assets/presets/sort-rules",
  "/assets/presets/[presetId]",
  "/assets/templates",
  "/assets/templates/new",
  "/assets/templates/[templateId]/edit",
  "/assets/templates/[templateId]/sections/[sectionIndex]",
  "/login",
  "/projects",
  "/projects/new",
  "/projects/[projectId]",
  "/projects/[projectId]/batch-create",
  "/projects/[projectId]/edit",
  "/projects/[projectId]/results",
  "/projects/[projectId]/sections/[sectionId]",
  "/projects/[projectId]/sections/[sectionId]/results",
  "/queue",
  "/queue/[runId]",
  "/settings",
  "/settings/logs",
  "/settings/monitor",
] as const;

const SEMANTIC_FALLBACKS: FallbackRule[] = [
  { pattern: "/assets", destination: "/assets/presets" },
  { pattern: "/assets/preset-groups", destination: "/assets/presets" },
  { pattern: "/assets/preset-groups/[groupId]", destination: "/assets/presets" },
  { pattern: "/assets/templates/[templateId]/edit", destination: "/assets/templates" },
  {
    pattern: "/assets/templates/[templateId]/sections/[sectionIndex]",
    destination: ({ templateId }) => `/assets/templates/${templateId}/edit`,
  },
];

function normalizePathname(pathname: string): string {
  const pathOnly = pathname.startsWith("http://") || pathname.startsWith("https://")
    ? new URL(pathname).pathname
    : pathname.split(/[?#]/, 1)[0] ?? "";
  const segments = pathOnly.split("/").filter(Boolean);
  return `/${segments.join("/")}`;
}

function splitPath(pathname: string): string[] {
  return normalizePathname(pathname).split("/").filter(Boolean);
}

function hasStaticFileExtension(pathname: string): boolean {
  const lastSegment = splitPath(pathname).at(-1);
  return !!lastSegment && /\.[a-z0-9]+$/i.test(lastSegment);
}

function isFallbackEligible(pathname: string): boolean {
  if (!pathname || pathname === "/") return false;
  if (pathname === "/design-demos" || pathname.startsWith("/design-demos/")) return false;
  if (pathname === "/character-lora-training" || pathname.startsWith("/character-lora-training/")) return false;
  if (pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/_next/")) return false;
  if (hasStaticFileExtension(pathname)) return false;
  return true;
}

function matchRoutePattern(pattern: string, pathname: string): RouteParams | null {
  const patternSegments = splitPath(pattern);
  const pathSegments = splitPath(pathname);
  const params: RouteParams = {};

  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index];
    const pathSegment = pathSegments[index];

    if (patternSegment.startsWith("[[...") && patternSegment.endsWith("]]")) {
      const paramName = patternSegment.slice("[[...".length, -"]]".length);
      params[paramName] = pathSegments.slice(index).join("/");
      return params;
    }

    if (patternSegment.startsWith("[...") && patternSegment.endsWith("]")) {
      if (pathSegment === undefined) return null;
      const paramName = patternSegment.slice("[...".length, -"]".length);
      params[paramName] = pathSegments.slice(index).join("/");
      return params;
    }

    if (patternSegment.startsWith("[") && patternSegment.endsWith("]")) {
      if (pathSegment === undefined) return null;
      const paramName = patternSegment.slice(1, -1);
      params[paramName] = pathSegment;
      continue;
    }

    if (patternSegment !== pathSegment) {
      return null;
    }
  }

  return patternSegments.length === pathSegments.length ? params : null;
}

function matchesPageRoute(pathname: string): boolean {
  return PAGE_ROUTE_PATTERNS.some((pattern) => matchRoutePattern(pattern, pathname));
}

function applyFallbackRule(rule: FallbackRule, pathname: string): string | null {
  const params = matchRoutePattern(rule.pattern, pathname);
  if (!params) return null;
  const destination = typeof rule.destination === "function" ? rule.destination(params) : rule.destination;
  return destination ? normalizePathname(destination) : null;
}

function routeCandidates(pathname: string): string[] {
  const segments = splitPath(pathname);
  const candidates = [normalizePathname(pathname)];

  for (let length = segments.length - 1; length >= 0; length -= 1) {
    candidates.push(length === 0 ? "/" : `/${segments.slice(0, length).join("/")}`);
  }

  return candidates;
}

export function resolveRouteFallback(pathname: string): string | null {
  const normalizedPathname = normalizePathname(pathname);
  if (!isFallbackEligible(normalizedPathname)) {
    return null;
  }

  const candidates = routeCandidates(normalizedPathname);

  for (const rule of SEMANTIC_FALLBACKS) {
    const fallback = applyFallbackRule(rule, candidates[0]);
    if (fallback && fallback !== normalizedPathname) {
      return fallback;
    }
  }

  for (const candidate of candidates.slice(1)) {
    if (matchesPageRoute(candidate)) {
      return candidate === "/" ? "/queue" : candidate;
    }

    for (const rule of SEMANTIC_FALLBACKS) {
      const fallback = applyFallbackRule(rule, candidate);
      if (fallback && fallback !== normalizedPathname) {
        return fallback;
      }
    }
  }

  return normalizedPathname === "/queue" ? null : "/queue";
}
