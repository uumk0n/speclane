import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { PIPELINE_STAGES, type PipelineStage, type PipelineState, type StageResult } from "../types/index.js";
import { SPECLANE_DIR } from "./config.js";

const STATE_FILENAME = "state.json";

function statePath(cwd: string): string {
  return join(cwd, SPECLANE_DIR, STATE_FILENAME);
}

export function createPipelineState(featureRequest: string, preset: string): PipelineState {
  const now = new Date().toISOString();
  return {
    featureId: randomUUID().slice(0, 8),
    featureRequest,
    preset,
    currentStage: PIPELINE_STAGES[0],
    stages: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function saveState(state: PipelineState, cwd = process.cwd()): void {
  const dir = join(cwd, SPECLANE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  state.updatedAt = new Date().toISOString();
  writeFileSync(statePath(cwd), JSON.stringify(state, null, 2), "utf8");
}

export function loadState(cwd = process.cwd()): PipelineState | null {
  const p = statePath(cwd);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as PipelineState;
}

export function nextStage(current: PipelineStage): PipelineStage | "done" {
  const idx = PIPELINE_STAGES.indexOf(current);
  return idx === PIPELINE_STAGES.length - 1 ? "done" : PIPELINE_STAGES[idx + 1];
}

/**
 * Records the result of the current stage and advances the state machine.
 * Does NOT auto-advance past a checkpoint - caller decides when to call
 * this after the user has approved the stage output.
 */
export function recordStageAndAdvance(state: PipelineState, result: StageResult): PipelineState {
  state.stages[result.stage] = result;
  state.currentStage = nextStage(result.stage);
  return state;
}
