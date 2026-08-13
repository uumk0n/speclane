import { BaseAgent } from "./base-agent.js";
import type { AgentContext, PipelineStage } from "../types/index.js";

export class Reviewer extends BaseAgent {
  readonly stage: PipelineStage = "review";
  readonly specFileName = "04-review.md";

  readonly systemPrompt = `You are a strict code reviewer. You do not write code.
Given the original requirements, the architecture spec, and the implementation,
check whether the implementation actually satisfies the requirements and architecture -
especially edge cases and out-of-scope boundaries from the requirements spec.
List concrete mismatches, if any. If everything matches, say so explicitly and briefly.
Output clean Markdown.`;

  buildPrompt(ctx: AgentContext): string {
    const requirements = ctx.previousStages.requirements?.output ?? "";
    const architecture = ctx.previousStages.architecture?.output ?? "";
    const implementation = ctx.previousStages.implementation?.output ?? "";
    return [
      `Requirements:\n\n${requirements}`,
      `Architecture:\n\n${architecture}`,
      `Implementation:\n\n${implementation}`,
      `Review the implementation against requirements and architecture.`,
    ].join("\n\n---\n\n");
  }
}
