import { loadState } from "../core/state-machine.js";
import { PIPELINE_STAGES } from "../types/index.js";
import { logger } from "../utils/logger.js";

export function statusCommand(): void {
  const state = loadState();
  if (!state) {
    logger.info("No pipeline has been started. Run `speclane run \"<feature request>\"`.");
    return;
  }

  console.log(`\nFeature [${state.featureId}]: ${state.featureRequest}`);
  console.log(`Preset: ${state.preset}`);
  console.log(`Current stage: ${state.currentStage}\n`);

  for (const stage of PIPELINE_STAGES) {
    const result = state.stages[stage];
    const marker = !result ? "—" : result.status === "approved" ? "✓" : result.status === "rejected" ? "✗" : "…";
    const attemptSuffix = result && result.attempt > 1 ? ` (attempt ${result.attempt})` : "";
    console.log(`  ${marker} ${stage.padEnd(15)} ${result ? result.status : "pending"}${attemptSuffix}`);
  }
  console.log("");
}
