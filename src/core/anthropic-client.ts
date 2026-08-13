import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getClient(apiKey: string): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

export async function complete(params: {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  const anthropic = getClient(params.apiKey);

  const response = await anthropic.messages.create({
    model: params.model,
    max_tokens: params.maxTokens ?? 4096,
    system: params.system,
    messages: [{ role: "user", content: params.prompt }],
  });

  const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
  return textBlocks.map((b) => b.text).join("\n");
}
