import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { z } from "zod";
import type { FileOperation } from "../types/index.js";

export const fileOperationSchema = z.object({
  action: z.enum(["create", "modify"]),
  path: z.string().min(1),
  content: z.string(),
});
export const fileOperationsSchema = z.array(fileOperationSchema).min(1).max(50);

export interface AppliedFileChange {
  path: string;
  action: FileOperation["action"];
  before: string | null;
  after: string;
}

function validatePath(path: string, cwd: string): string {
  if (isAbsolute(path)) throw new Error(`Absolute paths are not allowed: ${path}`);
  const normalized = path.replace(/\\/g, "/");
  if (normalized.split("/").includes("..") || normalized.startsWith(".git/") || normalized.startsWith(".speclane/")) {
    throw new Error(`Unsafe implementation path: ${path}`);
  }
  const absolute = resolve(cwd, normalized);
  const rel = relative(cwd, absolute);
  if (rel === "" || rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) throw new Error(`Path escapes project: ${path}`);
  return absolute;
}

/** Apply complete-file operations transactionally; restore earlier writes on failure. */
export function applyFileOperations(operations: FileOperation[], cwd = process.cwd()): AppliedFileChange[] {
  const parsed = fileOperationsSchema.parse(operations);
  const seen = new Set<string>();
  const prepared = parsed.map((operation) => {
    const absolute = validatePath(operation.path, cwd);
    if (seen.has(absolute)) throw new Error(`Duplicate operation for ${operation.path}`);
    seen.add(absolute);
    const exists = existsSync(absolute);
    if (operation.action === "create" && exists) throw new Error(`Cannot create existing file: ${operation.path}`);
    if (operation.action === "modify" && !exists) throw new Error(`Cannot modify missing file: ${operation.path}`);
    return { ...operation, absolute, before: exists ? readFileSync(absolute, "utf8") : null };
  });
  const applied: AppliedFileChange[] = [];
  try {
    for (const operation of prepared) {
      mkdirSync(dirname(operation.absolute), { recursive: true });
      writeFileSync(operation.absolute, operation.content, "utf8");
      applied.push({ path: operation.path, action: operation.action, before: operation.before, after: operation.content });
    }
    return applied;
  } catch (error) {
    for (const change of applied.reverse()) {
      const absolute = validatePath(change.path, cwd);
      if (change.before === null) rmSync(absolute, { force: true });
      else writeFileSync(absolute, change.before, "utf8");
    }
    throw error;
  }
}

/** Concise diff-like checkpoint preview, capped so the terminal stays readable. */
export function formatChangePreview(changes: AppliedFileChange[]): string {
  return changes.map((change) => {
    const before = change.before === null ? [] : change.before.split("\n");
    const after = change.after.split("\n");
    const lines = [`diff --speclane a/${change.path} b/${change.path}`, `--- ${change.before === null ? "/dev/null" : `a/${change.path}`}`, `+++ b/${change.path}`];
    if (change.before !== null) lines.push(...before.slice(0, 12).map((line) => `-${line}`));
    lines.push(...after.slice(0, 24).map((line) => `+${line}`));
    if (before.length > 12 || after.length > 24) lines.push("... preview truncated");
    return lines.join("\n");
  }).join("\n\n");
}
