import { loadConfig } from "../core/config.js";
import { createPipelineState, saveState, loadState } from "../core/state-machine.js";
import { createAgent } from "../agents/registry.js";
import { loadApiKey } from "../utils/credentials.js";
import { ask } from "../utils/prompt.js";
import { logger } from "../utils/logger.js";
import type { AgentContext, PipelineStage } from "../types/index.js";

export async function runCommand(featureRequest?: string): Promise<void> {
  const config = loadConfig();
  let state = loadState();

  if (state && state.currentStage !== "done") {
    logger.warn(
      `A pipeline for feature "${state.featureRequest}" is already at stage "${state.currentStage}".`
    );
    logger.info("Run `speclane approve` to continue, or `speclane status` to inspect it.");
    return;
  }

  if (!featureRequest) {
    logger.error('Usage: speclane run "<feature request>"');
    return;
  }

  state = createPipelineState(featureRequest, config.preset);
  saveState(state);

  const passphrase = await ask("Passphrase: ");
  const apiKey = loadApiKey(passphrase);

  await runStage(state.currentStage as PipelineStage, apiKey);
}

export async function runStage(stage: PipelineStage, apiKey: string): Promise<void> {
  const config = loadConfig();
  const state = loadState();
  if (!state) {
    logger.error("No active pipeline. Run `speclane run \"<feature request>\"` first.");
    return;
  }

  const agent = createAgent(stage);
  const priorAttempt = state.stages[stage];
  const revisionNotes = priorAttempt?.status === "rejected" ? priorAttempt.checkpointNotes : undefined;
  const previousOutput = priorAttempt ? agent.serializeForRevision(priorAttempt.output) : undefined;

  const ctx: AgentContext = {
    featureRequest: state.featureRequest,
    previousStages: state.stages,
    config,
    revision: revisionNotes && previousOutput
        ? { previousOutput, notes: revisionNotes }
        : undefined,
  };

  logger.stage(stage, ctx.revision ? "regenerating with feedback..." : "generating...");
  const result = await agent.run(ctx, apiKey);
  state.stages[stage] = result;
  saveState(state);

  const checkpoint = stage === "implementation"
    ? `Review the diff above and the changed files: ${result.affectedFiles?.join(", ") ?? "none"}`
    : `Review ${result.specFilePath}`;
  logger.success(`Stage "${stage}" done (attempt ${result.attempt}). ${checkpoint}`);
  logger.info('Run `speclane approve` to continue, or `speclane reject "<notes>"` to revise this stage.');
}
