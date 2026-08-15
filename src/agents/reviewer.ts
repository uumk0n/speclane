import { BaseAgent } from "./base-agent.js";
import { extname } from "node:path";
import { readRepositoryFiles } from "../core/repository-context.js";
import type { AgentContext, PipelineStage } from "../types/index.js";

function languageFor(path: string): string {
  const extension = extname(path).toLowerCase();
  return ({ ".ts": "ts", ".tsx": "tsx", ".js": "js", ".jsx": "jsx", ".json": "json", ".md": "markdown", ".yml": "yaml", ".yaml": "yaml", ".sql": "sql", ".css": "css", ".html": "html" } as Record<string, string>)[extension] ?? "";
}

function formatImplementationFiles(paths: string[] | undefined, cwd: string): string {
  if (!paths?.length) return "No implementation files were recorded for this stage. Review cannot inspect code changes.";
  const files = readRepositoryFiles(paths, cwd);
  const sections = paths.flatMap((path) => {
    const content = files[path];
    return content === undefined ? [`### ${path}\n\n_File is no longer present on disk._`] : [`### ${path}\n\n\`\`\`\`${languageFor(path)}\n${content}\n\`\`\`\``];
  });
  return sections.join("\n\n") || "No recorded implementation files could be read from disk.";
}

export class Reviewer extends BaseAgent {
  readonly stage: PipelineStage = "review";
  readonly specFileName = "04-review.md";

  readonly systemPrompt = `You are a strict, evidence-based code reviewer. You do not write code.
Given the original requirements, the architecture spec, and the implementation files changed
by this pipeline, check whether the implementation actually satisfies the requirements and
architecture - especially edge cases and out-of-scope boundaries from the requirements spec.

Treat a requirement as implemented ONLY when the supplied file contents directly demonstrate
it. Never infer implementation from the requirements, architecture, endpoint names, file names,
or prose. Documentation is not implementation. If the changed files do not contain the model,
business logic, UI, migration, or tests needed for a requirement, report it as missing. In
particular, do not mark a feature complete when the recorded files are unrelated assets.

Start with a clear verdict: PASS only when every acceptance criterion has direct code evidence;
otherwise FAIL. For a FAIL, list each unmet requirement and identify the missing or insufficient
file-level evidence. Output clean Markdown.`;

  buildPrompt(ctx: AgentContext): string {
    const requirements = ctx.previousStages.requirements?.output ?? "";
    const architecture = ctx.previousStages.architecture?.output ?? "";
    const implementation = formatImplementationFiles(
      ctx.previousStages.implementation?.affectedFiles,
      process.cwd()
    );
    return [
      `Requirements:\n\n${requirements}`,
      `Architecture:\n\n${architecture}`,
      `Implementation files currently on disk:\n\n${implementation}`,
      `Review the implementation against requirements and architecture.`,
    ].join("\n\n---\n\n");
  }
}
