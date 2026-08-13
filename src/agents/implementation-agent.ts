import { BaseAgent } from "./base-agent.js";
import { complete } from "../core/anthropic-client.js";
import { applyFileOperations, fileOperationsSchema, formatChangePreview } from "../core/file-writer.js";
import { buildRepositoryContext } from "../core/repository-context.js";
import type { AgentContext, FileOperation, PipelineStage, StageResult } from "../types/index.js";

function parseOperations(response: string): FileOperation[] {
  const json = response.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error("Implementation agent returned invalid JSON. No files were changed.");
  }
  return fileOperationsSchema.parse(value);
}

export class ImplementationAgent extends BaseAgent {
  readonly stage: PipelineStage = "implementation";
  readonly specFileName = "03-implementation.json";
  private repositoryCwd = process.cwd();

  readonly systemPrompt = `You are a senior backend engineer implementing an approved architecture spec
in an existing TypeScript project. Make the actual code changes, following the existing project
conventions. Do not invent requirements that were not in the spec.

Respond with ONLY valid JSON: an array of objects with exactly these fields:
{"action":"create"|"modify","path":"project/relative/path","content":"complete desired file contents"}.
Use create only for a currently missing file and modify only for a supplied existing file. Every
content value must be the complete file, never a diff, snippet, Markdown fence, or prose.`;

  buildPrompt(ctx: AgentContext): string {
    const architecture = ctx.previousStages.architecture?.output ?? "";
    return `Approved architecture spec:\n\n${architecture}\n\n${buildRepositoryContext(architecture, this.repositoryCwd)}\n\nImplement it.`;
  }

  async run(ctx: AgentContext, apiKey: string, cwd = process.cwd()): Promise<StageResult> {
    const startedAt = new Date().toISOString();
    this.repositoryCwd = cwd;
    const response = await complete({
      apiKey,
      model: ctx.config.model,
      system: this.systemPrompt,
      prompt: this.buildFinalPrompt(ctx),
      maxTokens: 16_000,
    });
    const operations = parseOperations(response);
    const changes = applyFileOperations(operations, cwd);
    const output = JSON.stringify(operations, null, 2);
    const specFilePath = this.writeSpecFile(ctx, output, cwd);
    const previousAttempt = ctx.previousStages[this.stage]?.attempt ?? 0;

    console.log(`\n${formatChangePreview(changes)}\n`);
    return {
      stage: this.stage,
      status: "awaiting_checkpoint",
      output,
      specFilePath,
      affectedFiles: changes.map((change) => change.path),
      startedAt,
      completedAt: new Date().toISOString(),
      attempt: ctx.revision ? previousAttempt + 1 : 1,
    };
  }
}
