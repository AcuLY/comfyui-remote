// ---------------------------------------------------------------------------
// toSlug
// ---------------------------------------------------------------------------

/** Simple slug generator */
export function toSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "");
}
