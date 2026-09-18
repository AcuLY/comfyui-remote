import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { run } from "node:test";

function errorChain(error) {
  const chain = [];
  let current = error;
  const seen = new Set();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = current.cause;
  }
  return chain;
}

function failureRecord(data) {
  const error = data?.details?.error;
  const chain = errorChain(error);
  const leaf = chain.at(-1) ?? error ?? {};
  return {
    test: typeof data?.name === "string" ? data.name : "unknown",
    name: typeof leaf?.name === "string" ? leaf.name : "Error",
    code: typeof leaf?.code === "string" ? leaf.code : null,
    failureType: typeof error?.failureType === "string" ? error.failureType : null,
    message: typeof leaf?.message === "string" ? leaf.message : String(leaf),
  };
}

function isAssertionFailure(failure) {
  return failure.name === "AssertionError" || failure.code === "ERR_ASSERTION";
}

function envelope(exitClass, failures, summary, evidence) {
  return {
    schemaVersion: 1,
    exitClass,
    failures,
    summary,
    evidence,
  };
}

async function execute(testFile) {
  if (!testFile) {
    return envelope("tool", [], null, "Controlled contract runner requires one test file.");
  }
  const root = process.cwd();
  const absoluteTest = resolve(root, testFile);
  if (!existsSync(absoluteTest)) {
    return envelope("tool", [], null, `Controlled contract test is missing: ${testFile}`);
  }
  const stream = run({
    files: [absoluteTest],
    concurrency: 1,
  });
  const failures = [];
  let summary = null;
  const legacySummary = { tests: 0, passed: 0, failed: 0 };
  for await (const event of stream) {
    if (event.type === "test:pass") {
      legacySummary.tests += 1;
      legacySummary.passed += 1;
    }
    if (event.type === "test:fail") {
      legacySummary.tests += 1;
      legacySummary.failed += 1;
      failures.push(failureRecord(event.data));
    }
    if (event.type === "test:summary") summary = event.data?.counts ?? null;
  }
  summary ??= legacySummary.tests > 0 ? legacySummary : null;
  if (!summary) {
    return envelope("tool", failures, null, "Node test runner returned no structured summary.");
  }
  if ((summary.tests ?? 0) === 0) {
    return envelope("tool", failures, summary, "Controlled contract test executed zero tests.");
  }
  if ((summary.failed ?? 0) === 0) {
    return envelope("pass", [], summary, "All controlled contract assertions passed.");
  }
  const leafFailures = failures.filter(({ failureType }) => failureType !== "subtestsFailed");
  if (leafFailures.length > 0 && leafFailures.every(isAssertionFailure)) {
    return envelope("violation", leafFailures, summary, "Controlled contract assertions did not match repository state.");
  }
  return envelope("tool", failures, summary, "Controlled contract test did not complete as assertion-only failures.");
}

let result;
try {
  result = await execute(process.argv[2]);
} catch (error) {
  result = envelope(
    "tool",
    [],
    null,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  );
}
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exitCode = result.exitClass === "pass" ? 0 : result.exitClass === "violation" ? 1 : 2;
