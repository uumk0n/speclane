import { loadState, saveState, recordStageAndAdvance } from "../core/state-machine.js";
import { loadConfig } from "../core/config.js";
import { loadApiKey } from "../utils/credentials.js";
import { ask } from "../utils/prompt.js";
import { logger } from "../utils/logger.js";
import { isGitRepo, commitFiles } from "../utils/git.js";
import { runStage } from "./run.js";
import type { PipelineStage, StageResult } from "../types/index.js";

async function autoCommitStage(result: StageResult, featureId: string): Promise<void> {
  const config = loadConfig();
  if (!config.autoCommit) return;

  const cwd = process.cwd();
  if (!(await isGitRepo(cwd))) {
    logger.warn("Not a git repository - skipping auto-commit (set autoCommit: false to silence this).");
    return;
  }

  const message = `specflow-cloud: approve ${result.stage} [${featureId}]`;
  try {
    const filesToCommit = result.stage === "implementation" && result.affectedFiles?.length
      ? result.affectedFiles
      : [result.specFilePath];
    const committed = await commitFiles(filesToCommit, message, cwd);
    if (committed) {
      logger.success(`Committed ${filesToCommit.join(", ")}`);
    }
  } catch (err) {
    logger.warn(`Auto-commit failed, continuing anyway: ${(err as Error).message}`);
  }
}

export async function approveCommand(): Promise<void> {
  const state = loadState();
  if (!state || state.currentStage === "done") {
    logger.warn("No stage awaiting approval.");
    return;
  }

  const currentStage = state.currentStage as PipelineStage;
  const result = state.stages[currentStage];
  if (!result) {
    logger.error(`Stage "${currentStage}" has no output yet - nothing to approve.`);
    return;
  }

  result.status = "approved";
  recordStageAndAdvance(state, result);
  saveState(state);

  await autoCommitStage(result, state.featureId);

  const nextStage = state.currentStage as PipelineStage | "done";
  if (nextStage === "done") {
    logger.success(`Pipeline for "${state.featureRequest}" is complete. See .spec/ for all outputs.`);
    return;
  }

  logger.success(`Stage "${currentStage}" approved. Moving to "${nextStage}".`);

  const config = loadConfig();
  const apiKey = config.provider === "anthropic"
    ? loadApiKey(await ask("Passphrase: "))
    : undefined;
  await runStage(nextStage, apiKey);
}

export async function rejectCommand(notes: string): Promise<void> {
  const state = loadState();
  if (!state || state.currentStage === "done") {
    logger.warn("No stage awaiting approval.");
    return;
  }

  const currentStage = state.currentStage as PipelineStage;
  const result = state.stages[currentStage];
  if (!result) {
    logger.error(`Stage "${currentStage}" has no output yet - nothing to reject.`);
    return;
  }

  if (currentStage === "review") {
    const implementation = state.stages.implementation;
    if (!implementation) {
      logger.error("Review has no implementation stage to send back for revision.");
      return;
    }
    implementation.status = "rejected";
    implementation.checkpointNotes = `Review findings:\n${result.output}\n\nUser notes:\n${notes}`;
    result.status = "rejected";
    state.currentStage = "implementation";
    saveState(state);
    logger.warn("Review rejected. Regenerating the implementation with the review findings...");

    const config = loadConfig();
    const apiKey = config.provider === "anthropic"
      ? loadApiKey(await ask("Passphrase: "))
      : undefined;
    await runStage("implementation", apiKey);
    return;
  }

  result.status = "rejected";
  result.checkpointNotes = notes;
  saveState(state);
  logger.warn(`Stage "${currentStage}" rejected. Regenerating with your feedback...`);

  const config = loadConfig();
  const apiKey = config.provider === "anthropic"
    ? loadApiKey(await ask("Passphrase: "))
    : undefined;
  await runStage(currentStage, apiKey);
}
