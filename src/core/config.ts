import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import type { SpeclaneConfig } from "../types/index.js";

export const SPECLANE_DIR = ".speclane";
const CONFIG_FILENAME = "config.yaml";

export const DEFAULT_CONFIG: SpeclaneConfig = {
  preset: "backend-api",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  ollamaHost: "http://localhost:11434",
  ollamaModel: "qwen3.6:27b",
  specDir: ".spec",
  requireCheckpoints: true,
  autoCommit: true,
};

function configPath(cwd: string): string {
  return join(cwd, SPECLANE_DIR, CONFIG_FILENAME);
}

export function configExists(cwd = process.cwd()): boolean {
  return existsSync(configPath(cwd));
}

export function saveConfig(config: SpeclaneConfig, cwd = process.cwd()): void {
  const dir = join(cwd, SPECLANE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(configPath(cwd), yaml.dump(config), "utf8");
}

export function loadConfig(cwd = process.cwd()): SpeclaneConfig {
  if (!configExists(cwd)) {
    throw new Error("No speclane config found. Run `speclane init` first.");
  }
  const raw = readFileSync(configPath(cwd), "utf8");
  const parsed = yaml.load(raw) as Partial<SpeclaneConfig>;
  return { ...DEFAULT_CONFIG, ...parsed };
}
