import type { CompletionParams, LLMProvider } from "./llm-provider.js";

interface OllamaGenerateResponse {
  response?: unknown;
  error?: unknown;
}

/** Provider for a locally running Ollama server. */
export class OllamaProvider implements LLMProvider {
  constructor(private readonly host = "http://localhost:11434") {}

  async complete(params: CompletionParams): Promise<string> {
    const response = await fetch(`${this.host.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: params.model,
        system: params.system,
        prompt: params.prompt,
        stream: false,
        ...(params.maxTokens === undefined ? {} : { options: { num_predict: params.maxTokens } }),
        // Ollama applies this schema while decoding; prompt instructions are only a fallback.
        ...(params.jsonSchema === undefined ? {} : { format: params.jsonSchema }),
      }),
    });

    let body: OllamaGenerateResponse;
    try {
      body = await response.json() as OllamaGenerateResponse;
    } catch {
      throw new Error(`Ollama returned a non-JSON response (status ${response.status}). Is Ollama running at ${this.host}?`);
    }
    if (!response.ok) {
      throw new Error(`Ollama request failed (${response.status}): ${typeof body.error === "string" ? body.error : response.statusText}`);
    }
    if (typeof body.response !== "string") {
      throw new Error("Ollama returned a response without generated text.");
    }
    return body.response;
  }
}
