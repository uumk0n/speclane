import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

const IGNORED_DIRECTORIES = new Set([".git", ".speclane", ".spec", "node_modules", "dist", "build", "coverage"]);
const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".yaml", ".yml", ".md", ".sql", ".prisma", ".css", ".scss", ".html",
]);
const MAX_TREE_ENTRIES = 500;
const MAX_FILE_CHARS = 12_000;
const MAX_RELEVANT_FILES = 20;

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

function isIgnored(relativePath: string): boolean {
  return relativePath.split(/[\\/]/).some((part) => IGNORED_DIRECTORIES.has(part));
}

function readTextRepositoryFile(path: string, cwd: string): string | null {
  const absolute = join(cwd, path);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) return null;
  return readFileSync(absolute, "utf8");
}

/** A compact, deterministic project tree suitable for an LLM prompt. */
export function projectFileTree(cwd: string): string[] {
  const files: string[] = [];
  const visit = (dir: string): void => {
    if (files.length >= MAX_TREE_ENTRIES) return;
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = join(dir, entry.name);
      const rel = toPosix(relative(cwd, absolute));
      if (isIgnored(rel)) continue;
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(rel);
      if (files.length >= MAX_TREE_ENTRIES) return;
    }
  };
  visit(cwd);
  return files;
}

/**
 * Extract file-like paths from the architecture document, then include only
 * existing text files. The model receives the tree as a fallback when the
 * spec omitted a path or needs a new file.
 */
export function relevantRepositoryFiles(architecture: string, cwd: string, tree = projectFileTree(cwd)): Array<{ path: string; content: string }> {
  const referenced = new Set<string>();
  const pathPattern = /(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|ya?ml|md|sql|prisma|css|scss|html)/g;
  for (const match of architecture.matchAll(pathPattern)) {
    const candidate = match[0].replace(/^\.\//, "");
    if (tree.includes(candidate)) referenced.add(candidate);
  }

  return [...referenced]
    .slice(0, MAX_RELEVANT_FILES)
    .flatMap((path) => {
      if (!TEXT_EXTENSIONS.has(extname(path))) return [];
      const content = readTextRepositoryFile(path, cwd);
      if (content === null) return [];
      return [{ path, content: content.slice(0, MAX_FILE_CHARS) }];
    });
}

/** Reads the current contents of implementation files that still exist on disk. */
export function readRepositoryFiles(paths: string[], cwd: string): Record<string, string> {
  return Object.fromEntries(
    [...new Set(paths)].flatMap((path) => {
      const content = readTextRepositoryFile(path, cwd);
      return content === null ? [] : [[path, content.slice(0, MAX_FILE_CHARS)]];
    })
  );
}

export function buildRepositoryContext(architecture: string, cwd: string): string {
  const tree = projectFileTree(cwd);
  const relevant = relevantRepositoryFiles(architecture, cwd, tree);
  const treeText = tree.join("\n") + (tree.length >= MAX_TREE_ENTRIES ? "\n... (tree truncated)" : "");
  const filesText = relevant.length
    ? relevant.map((file) => `--- ${file.path}\n${file.content}`).join("\n\n")
    : "No existing files were explicitly named in the architecture spec.";
  return `Project file tree:\n${treeText}\n\nRelevant existing files:\n${filesText}`;
}
