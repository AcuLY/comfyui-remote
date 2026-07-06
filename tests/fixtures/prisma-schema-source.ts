import { readFileSync } from "node:fs";

export const PRISMA_SCHEMA_PATHS = [
  "prisma/schema.prisma",
  "prisma/schema.sqlite.prisma",
] as const;

export type PrismaSchemaPath = (typeof PRISMA_SCHEMA_PATHS)[number];

const schemaSourceCache = new Map<string, string>();

export function readPrismaSchemaSource(schemaPath: string): string {
  const cached = schemaSourceCache.get(schemaPath);
  if (cached !== undefined) return cached;

  const source = readFileSync(schemaPath, "utf8");
  schemaSourceCache.set(schemaPath, source);
  return source;
}

export function prismaSchemaDeclaresModel(schemaPath: string, modelName: string): boolean {
  return new RegExp(`^model\\s+${escapeRegExp(modelName)}\\s*\\{`, "m").test(
    readPrismaSchemaSource(schemaPath),
  );
}

export function readPrismaModelBlock(schemaPath: string, modelName: string): string {
  const source = readPrismaSchemaSource(schemaPath);
  const match = source.match(
    new RegExp(`^model\\s+${escapeRegExp(modelName)}\\s*\\{([\\s\\S]*?)^}`, "m"),
  );
  if (!match) throw new Error(`${schemaPath} missing model ${modelName}`);
  return match[1];
}

export function listPrismaModelNames(schemaPath: string): string[] {
  return [...readPrismaSchemaSource(schemaPath).matchAll(/^model\s+(\w+)\s*\{/gm)].map(
    (match) => match[1],
  );
}

export function listPrismaEnumDefinitions(schemaPath: string): Map<string, string[]> {
  const enums = new Map<string, string[]>();

  for (const match of readPrismaSchemaSource(schemaPath).matchAll(/^enum\s+(\w+)\s*\{([\s\S]*?)^}/gm)) {
    const values = match[2]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("//"));
    enums.set(match[1], values);
  }

  return enums;
}

export function listPrismaEnumFieldReferences(
  schemaPath: string,
  enumNames: Iterable<string>,
): Map<string, string[]> {
  const enumNameSet = new Set(enumNames);
  const references = new Map<string, string[]>();
  const source = readPrismaSchemaSource(schemaPath);

  for (const modelMatch of source.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^}/gm)) {
    const modelName = modelMatch[1];
    for (const line of modelMatch[2].split("\n")) {
      const fieldMatch = line.trim().match(/^(\w+)\s+(\w+)\b/);
      if (!fieldMatch || !enumNameSet.has(fieldMatch[2])) continue;

      const fields = references.get(fieldMatch[2]) ?? [];
      fields.push(`${modelName}.${fieldMatch[1]}`);
      references.set(fieldMatch[2], fields);
    }
  }

  return references;
}

export function listPrismaModelDirectives(schemaPath: string, modelName: string): string[] {
  return readPrismaModelBlock(schemaPath, modelName)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("@@unique") || line.startsWith("@@index"));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
