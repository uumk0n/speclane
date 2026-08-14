import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { complete } from "../core/anthropic-client.js";
import type { AgentContext, PipelineStage, StageResult } from "../types/index.js";

export abstract class BaseAgent {
  abstract readonly stage: PipelineStage;
  abstract readonly systemPrompt: string;

  /** Builds the user-facing prompt from context (feature request + prior stage outputs). */
  abstract buildPrompt(ctx: AgentContext): string;

  /** Filename for this stage's spec output, e.g. "01-requirements.md". */
  abstract readonly specFileName: string;

  /** Converts a prior result into useful revision context; prose stages need no conversion. */
  serializeForRevision(priorOutput: string): string {
    return priorOutput;
  }

  async run(ctx: AgentContext, apiKey: string, cwd = process.cwd()): Promise<StageResult> {
    const startedAt = new Date().toISOString();
    const prompt = this.buildFinalPrompt(ctx);

    const output = await complete({
      apiKey,
      model: ctx.config.model,
      system: this.systemPrompt,
      prompt,
    });

    const specFilePath = this.writeSpecFile(ctx, output, cwd);
    const previousAttempt = ctx.previousStages[this.stage]?.attempt ?? 0;

    return {
      stage: this.stage,
      status: "awaiting_checkpoint",
      output,
      specFilePath,
      startedAt,
      completedAt: new Date().toISOString(),
      attempt: ctx.revision ? previousAttempt + 1 : 1,
    };
  }

  /**
   * Wraps buildPrompt() with revision instructions when the previous
   * attempt at this stage was rejected. Kept out of individual agents so
   * every role gets consistent revision behavior for free.
   */
  protected buildFinalPrompt(ctx: AgentContext): string {
    const basePrompt = this.buildPrompt(ctx);
    if (!ctx.revision) return basePrompt;

    return [
      basePrompt,
      "---",
      "Your previous attempt at this stage was rejected. Do not start from scratch -",
      "revise the previous output to address the feedback below, keeping everything",
      "that wasn't flagged as a problem.",
      "",
      `Previous output:\n\n${ctx.revision.previousOutput}`,
      "",
      `Rejection feedback:\n\n${ctx.revision.notes}`,
    ].join("\n\n");
  }

  protected writeSpecFile(ctx: AgentContext, content: string, cwd: string): string {
    const dir = join(cwd, ctx.config.specDir);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const filePath = join(dir, this.specFileName);
    writeFileSync(filePath, content, "utf8");
    return filePath;
  }
}
