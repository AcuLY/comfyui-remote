import { readFileSync } from "node:fs";
import { test } from "node:test";
import { strict as assert } from "node:assert";

function sourceSlice(source: string, startNeedle: string, endNeedle: string) {
  const normalizedSource = source.replace(/\r\n/g, "\n");
  const start = normalizedSource.indexOf(startNeedle);
  assert.notEqual(start, -1, `missing start needle: ${startNeedle}`);
  const end = normalizedSource.indexOf(endNeedle, start);
  assert.notEqual(end, -1, `missing end needle: ${endNeedle}`);
  return normalizedSource.slice(start, end);
}

test("queue trash restore uses the background restore API without refreshing the heavy queue page", () => {
  const source = readFileSync("src/app/queue/queue-page-client.tsx", "utf8");
  const imports = sourceSlice(source, "import {", "type QueueControlStreamResult");
  const handleRestore = sourceSlice(
    source,
    "  function handleRestore",
    "  function handleClearTrash",
  );

  assert.doesNotMatch(
    imports,
    /restoreImage/,
    "queue trash tab should not import the direct Server Action restoreImage",
  );
  assert.match(
    handleRestore,
    /fetch\(`\/api\/images\/\$\{encodeURIComponent\(item\.imageResultId\)\}\/restore`/,
    "queue trash restore should call the dedicated image restore API with the image id",
  );
  assert.doesNotMatch(
    handleRestore,
    /await restoreImage\(/,
    "queue trash restore should not await a direct Server Action from the Client Component",
  );
  assert.doesNotMatch(
    handleRestore,
    /router\.refresh\(\)/,
    "queue trash restore should update local trash state instead of refreshing the full queue page",
  );
  assert.match(
    handleRestore,
    /setTrashItems\(\(prev\) => prev\.filter\(\(trashItem\) => trashItem\.id !== item\.id\)\)/,
    "queue trash restore should remove the restored trash record locally after the API succeeds",
  );
});

test("queue trash tab loads a paginated trash page instead of every trashed image", () => {
  const repositorySource = readFileSync("src/server/repositories/trash-repository.ts", "utf8");
  const apiSource = readFileSync("src/app/api/queue-data/route.ts", "utf8");
  const pageSource = readFileSync("src/app/queue/page.tsx", "utf8");
  const clientSource = readFileSync("src/app/queue/queue-page-client.tsx", "utf8");
  const trashListSource = clientSource;

  assert.match(
    repositorySource,
    /type TrashPageOptions = \{\s*page\?: number;\s*pageSize\?: number;\s*\}/,
    "trash repository should expose page and page-size inputs",
  );
  assert.match(
    repositorySource,
    /db\.trashRecord\.count\(\{/,
    "trash repository should count matching rows for pagination metadata",
  );
  assert.match(
    repositorySource,
    /skip: startIndex,\s*take: pageSize,/,
    "trash repository must bound the trash query with skip/take",
  );
  assert.match(
    repositorySource,
    /items: records\.map\(serializeTrashRecord\),\s*pagination:/,
    "trash repository should return only the current page plus pagination metadata",
  );

  assert.match(
    apiSource,
    /const trashPage = readPositiveInteger\(request\.nextUrl\.searchParams\.get\("trashPage"\)\)/,
    "queue data API should parse a dedicated trashPage parameter",
  );
  assert.match(
    apiSource,
    /const trashPageSize = readPositiveInteger\(request\.nextUrl\.searchParams\.get\("trashPageSize"\)\)/,
    "queue data API should parse a dedicated trashPageSize parameter",
  );
  assert.match(
    apiSource,
    /includeTrash \? getTrashItems\(\{ page: trashPage, pageSize: trashPageSize \}\)/,
    "queue data API should request a bounded trash page",
  );
  assert.match(
    apiSource,
    /trashItems: trashPageData\.items,\s*trashPagination: trashPageData\.pagination/,
    "queue data API should return trash pagination metadata with the page items",
  );

  assert.match(
    pageSource,
    /searchParams: Promise<\{ page\?: string \| string\[\]; trashPage\?: string \| string\[\] \}>/,
    "queue page should accept an initial trashPage search parameter",
  );
  assert.match(
    pageSource,
    /getTrashItems\(\{ page: readPage\(trashPage\) \}\)/,
    "queue page should fetch only the initial trash page",
  );

  assert.match(
    clientSource,
    /initialTrashPagination: TrashPagination/,
    "queue client should receive trash pagination metadata",
  );
  assert.match(
    clientSource,
    /const \[trashPagination, setTrashPagination\] = useState<TrashPagination>\(initialTrashPagination\)/,
    "queue client should keep trash pagination state",
  );
  assert.match(
    clientSource,
    /params\.set\("trashPage", String\(nextTrashPage\)\)/,
    "queue refresh should request the active trash page",
  );
  assert.match(
    clientSource,
    /params\.set\("trashPageSize", String\(trashPagination\.pageSize\)\)/,
    "queue refresh should request the configured trash page size",
  );
  assert.match(
    clientSource,
    /setTrashPagination\(data\.trashPagination\)/,
    "queue refresh should update trash pagination from the API response",
  );
  assert.doesNotMatch(
    clientSource,
    /const trashCount = trashItems\.length/,
    "trash count should not be derived from the current page item count",
  );
  assert.match(
    trashListSource,
    /trashPagination\.totalPages > 1/,
    "trash tab should render pagination controls when multiple trash pages exist",
  );
  assert.match(
    trashListSource,
    /onClick=\{\(\) => handleTrashPageChange\(page\)\}/,
    "trash tab page buttons should fetch another bounded trash page without route navigation",
  );
});
