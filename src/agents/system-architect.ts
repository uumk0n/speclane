import { BaseAgent } from "./base-agent.js";
import type { AgentContext, PipelineStage } from "../types/index.js";

export class SystemArchitect extends BaseAgent {
  readonly stage: PipelineStage = "architecture";
  readonly specFileName = "02-architecture.md";

  readonly systemPrompt = `You are a system architect for a Node.js/NestJS/PostgreSQL backend.
Given an approved requirements spec, design the technical solution: modules/services affected,
data model changes, API contract (endpoints/DTOs), and any infrastructure implications
(migrations, queues, caching). Flag anything that risks a breaking change. Output clean Markdown.`;

  buildPrompt(ctx: AgentContext): string {
    const requirements = ctx.previousStages.requirements?.output ?? "";
    return `Approved requirements spec:\n\n${requirements}\n\nWrite the architecture spec.`;
  }
}
