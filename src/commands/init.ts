import { saveConfig, loadConfig, DEFAULT_CONFIG, configExists } from "../core/config.js";
import { saveApiKey, hasStoredApiKey } from "../utils/credentials.js";
import { ask } from "../utils/prompt.js";
import { logger } from "../utils/logger.js";
import type { SpeclaneConfig } from "../types/index.js";

export async function initCommand(): Promise<void> {
  let config: SpeclaneConfig;
  if (configExists()) {
    logger.warn(".speclane/config.yaml already exists - skipping config creation.");
    config = loadConfig();
  } else {
    logger.info("Setting up speclane for this project.");
    const requestedProvider = (await ask(`Provider [${DEFAULT_CONFIG.provider}]: `)) || DEFAULT_CONFIG.provider;
    if (requestedProvider !== "anthropic" && requestedProvider !== "ollama") {
      logger.error('Provider must be "anthropic" or "ollama". Run `speclane init` again.');
      return;
    }
    const preset = (await ask(`Preset [${DEFAULT_CONFIG.preset}]: `)) || DEFAULT_CONFIG.preset;
    const provider = requestedProvider;
    const model = provider === "anthropic"
      ? (await ask(`Model [${DEFAULT_CONFIG.model}]: `)) || DEFAULT_CONFIG.model
      : DEFAULT_CONFIG.model;
    const ollamaModel = provider === "ollama"
      ? (await ask(`Ollama model [${DEFAULT_CONFIG.ollamaModel}]: `)) || DEFAULT_CONFIG.ollamaModel
      : DEFAULT_CONFIG.ollamaModel;
    const ollamaHost = provider === "ollama"
      ? (await ask(`Ollama host [${DEFAULT_CONFIG.ollamaHost}]: `)) || DEFAULT_CONFIG.ollamaHost
      : DEFAULT_CONFIG.ollamaHost;

    config = { ...DEFAULT_CONFIG, provider, preset, model, ollamaModel, ollamaHost };
    saveConfig(config);
    logger.success(`Config written to .speclane/config.yaml`);
  }

  if (config.provider === "ollama") {
    logger.success("Ollama selected. No API key is required.");
    return;
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
