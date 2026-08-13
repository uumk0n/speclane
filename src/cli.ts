#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { runCommand } from "./commands/run.js";
import { approveCommand, rejectCommand } from "./commands/approve.js";
import { statusCommand } from "./commands/status.js";
import { logger } from "./utils/logger.js";

const program = new Command();

program
  .name("speclane")
  .description("Spec-driven development pipeline with AI agent roles and manual checkpoints")
  .version("0.1.0");

program
  .command("init")
  .description("Set up config and store your Anthropic API key (encrypted)")
  .action(async () => {
    await initCommand().catch((err) => logger.error(err.message));
  });

program
  .command("run")
  .argument("[featureRequest]", "Description of the feature to build")
  .description("Start a new pipeline for a feature, or resume the current stage")
  .action(async (featureRequest?: string) => {
    await runCommand(featureRequest).catch((err) => logger.error(err.message));
  });

program
  .command("approve")
  .description("Approve the current stage and advance to the next one")
  .action(async () => {
    await approveCommand().catch((err) => logger.error(err.message));
  });

program
  .command("reject")
  .argument("<notes>", "Why this stage's output was rejected")
  .description("Mark the current stage as rejected with notes")
  .action(async (notes: string) => {
    await rejectCommand(notes).catch((err) => logger.error(err.message));
  });

program
  .command("status")
  .description("Show current pipeline progress")
  .action(() => {
    statusCommand();
  });

program.parse();
