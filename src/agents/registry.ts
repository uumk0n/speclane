import { RequirementsAnalyst } from "./requirements-analyst.js";
import { SystemArchitect } from "./system-architect.js";
import { ImplementationAgent } from "./implementation-agent.js";
import { Reviewer } from "./reviewer.js";
import type { BaseAgent } from "./base-agent.js";
import type { PipelineStage } from "../types/index.js";

export function createAgent(stage: PipelineStage): BaseAgent {
  switch (stage) {
    case "requirements":
      return new RequirementsAnalyst();
    case "architecture":
      return new SystemArchitect();
    case "implementation":
      return new ImplementationAgent();
    case "review":
      return new Reviewer();
  }
}
