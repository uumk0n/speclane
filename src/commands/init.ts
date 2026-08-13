import { saveConfig, DEFAULT_CONFIG, configExists } from "../core/config.js";
import { saveApiKey, hasStoredApiKey } from "../utils/credentials.js";
import { ask } from "../utils/prompt.js";
import { logger } from "../utils/logger.js";
import type { SpeclaneConfig } from "../types/index.js";

export async function initCommand(): Promise<void> {
  if (configExists()) {
    logger.warn(".speclane/config.yaml already exists - skipping config creation.");
  } else {
    logger.info("Setting up speclane for this project.");
    const preset = (await ask(`Preset [${DEFAULT_CONFIG.preset}]: `)) || DEFAULT_CONFIG.preset;
    const model = (await ask(`Model [${DEFAULT_CONFIG.model}]: `)) || DEFAULT_CONFIG.model;

    const config: SpeclaneConfig = { ...DEFAULT_CONFIG, preset, model };
    saveConfig(config);
    logger.success(`Config written to .speclane/config.yaml`);
  }

  if (hasStoredApiKey()) {
    logger.warn("An API key is already stored in ~/.speclane/credentials.enc - skipping.");
    return;
  }

  logger.info("Your Anthropic API key will be encrypted at rest (AES-256-GCM).");
  const apiKey = await ask("Anthropic API key: ");
  const passphrase = await ask("Choose a passphrase to encrypt it (you'll need this every run): ");

  if (!apiKey || !passphrase) {
    logger.error("API key and passphrase are required. Run `speclane init` again.");
    return;
  }

  saveApiKey(apiKey, passphrase);
  logger.success("API key stored encrypted at ~/.speclane/credentials.enc");
}
