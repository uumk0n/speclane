import Anthropic from "@anthropic-ai/sdk";
import type { CompletionParams, LLMProvider } from "./llm-provider.js";

let client: Anthropic | null = null;

export function getClient(apiKey: string): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

export class AnthropicProvider implements LLMProvider {
  constructor(private readonly apiKey: string) {}

  async complete(params: CompletionParams): Promise<string> {
    const anthropic = getClient(this.apiKey);

    const response = await anthropic.messages.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 4096,
      system: params.system,
      messages: [{ role: "user", content: params.prompt }],
    });

    // The SDK version in use does not expose JSON Schema-constrained messages.
    const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
    return textBlocks.map((b) => b.text).join("\n");
  }
}
