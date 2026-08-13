import { BaseAgent } from "./base-agent.js";
import type { AgentContext, PipelineStage } from "../types/index.js";

export class RequirementsAnalyst extends BaseAgent {
  readonly stage: PipelineStage = "requirements";
  readonly specFileName = "01-requirements.md";

  readonly systemPrompt = `You are a requirements analyst for a backend API project (Node.js/NestJS/TypeScript).
Turn a raw feature request into a structured spec: user stories, acceptance criteria,
edge cases, and explicit out-of-scope items. Be concrete - no vague statements like
"the system should be fast". Output clean Markdown, no preamble.`;

  buildPrompt(ctx: AgentContext): string {
    return `Feature request:\n\n${ctx.featureRequest}\n\nWrite the requirements spec.`;
  }
}
