import { execa } from "execa";

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await execa("git", ["rev-parse", "--is-inside-work-tree"], { cwd });
    return true;
  } catch {
    return false;
  }
}

/**
 * Stages and commits a single file. Returns false (without throwing) if
 * there was nothing to commit - e.g. the file content didn't change,
 * which happens if a stage is approved without edits after a prior commit.
 */
export async function commitFile(filePath: string, message: string, cwd: string): Promise<boolean> {
  return commitFiles([filePath], message, cwd);
}

/** Stages and commits the supplied project files as one atomic stage approval. */
export async function commitFiles(filePaths: string[], message: string, cwd: string): Promise<boolean> {
  if (filePaths.length === 0) return false;
  await execa("git", ["add", "--", ...filePaths], { cwd });

  try {
    await execa("git", ["commit", "-m", message, "--", ...filePaths], { cwd });
    return true;
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string };
    const output = `${e.stdout ?? ""}\n${e.stderr ?? ""}`;
    if (/nothing to commit|nothing added to commit/i.test(output)) {
      return false;
    }
    throw err;
  }
}
