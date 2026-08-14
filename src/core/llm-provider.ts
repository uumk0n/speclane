import { AnthropicProvider } from "./anthropic-client.js";
import { OllamaProvider } from "./ollama-provider.js";
import type { SpeclaneConfig } from "../types/index.js";

export interface CompletionParams {
  model: string;
  system: string;
  prompt: string;
  maxTokens?: number;
  /** JSON Schema to constrain output, when the caller needs structured JSON. */
  jsonSchema?: Record<string, unknown>;
}

export interface LLMProvider {
  complete(params: CompletionParams): Promise<string>;
}

/** Returns the configured model provider. Anthropic remains the default. */
export function getProvider(config: SpeclaneConfig, apiKey?: string): LLMProvider {
  if (config.provider === "ollama") {
    return new OllamaProvider(config.ollamaHost);
  }

  if (!apiKey) {
    throw new Error("An Anthropic API key is required when provider is anthropic.");
  }
  return new AnthropicProvider(apiKey);
}
