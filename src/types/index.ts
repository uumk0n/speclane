/**
 * Roles that make up the default pipeline, in execution order.
 * Adding a role here requires a matching class in src/agents/.
 */
export const PIPELINE_STAGES = [
  "requirements",
  "architecture",
  "implementation",
  "review",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type StageStatus = "pending" | "in_progress" | "awaiting_checkpoint" | "approved" | "rejected";

/** A complete-file operation returned by the implementation agent. */
export interface FileOperation {
  action: "create" | "modify";
  /** Project-relative POSIX path. */
  path: string;
  /** Complete desired file contents (not a partial patch). */
  content: string;
}

export interface StageResult {
  stage: PipelineStage;
  status: StageStatus;
  output: string;
  specFilePath: string;
  startedAt: string;
  completedAt?: string;
  /** Free-form notes left by the user at a checkpoint (e.g. edits requested). */
  checkpointNotes?: string;
  /** How many times this stage has been generated (1 = first attempt). */
  attempt: number;
  /** Files written by this stage. Present for implementation results only. */
  affectedFiles?: string[];
}

export interface PipelineState {
  featureId: string;
  featureRequest: string;
  preset: string;
  currentStage: PipelineStage | "done";
  stages: Partial<Record<PipelineStage, StageResult>>;
  createdAt: string;
  updatedAt: string;
}

export interface SpeclaneConfig {
  preset: string;
  model: string;
  /** Directory where .spec/*.md files are written, relative to repo root. */
  specDir: string;
  /** If true, pipeline stops after every stage for manual approval. */
  requireCheckpoints: boolean;
  /** If true, auto-commit a stage's spec file to git once it's approved. */
  autoCommit: boolean;
}

export interface AgentContext {
  featureRequest: string;
  previousStages: Partial<Record<PipelineStage, StageResult>>;
  config: SpeclaneConfig;
  /** Present when this stage is being regenerated after a rejection. */
  revision?: {
    previousOutput: string;
    notes: string;
  };
}
