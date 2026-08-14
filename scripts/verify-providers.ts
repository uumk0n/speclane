import assert from "node:assert/strict";
import { AnthropicProvider } from "../src/core/anthropic-client.js";
import { DEFAULT_CONFIG } from "../src/core/config.js";
import { getProvider } from "../src/core/llm-provider.js";
import { OllamaProvider } from "../src/core/ollama-provider.js";
import { fileOperationsJsonSchema } from "../src/agents/implementation-agent.js";

const legacyConfig = { ...DEFAULT_CONFIG };
delete (legacyConfig as Partial<typeof DEFAULT_CONFIG>).provider;
assert.ok(getProvider(legacyConfig as typeof DEFAULT_CONFIG, "test-key") instanceof AnthropicProvider);
assert.ok(getProvider({ ...DEFAULT_CONFIG, provider: "ollama" }) instanceof OllamaProvider);

assert.equal(typeof fileOperationsJsonSchema, "object");
assert.equal(fileOperationsJsonSchema.$schema, "http://json-schema.org/draft-07/schema#");
assert.equal(
  (fileOperationsJsonSchema.definitions as Record<string, { type?: unknown }>).FileOperations.type,
  "array",
);

const originalFetch = globalThis.fetch;
let requestBody: Record<string, unknown> | undefined;
let requestUrl: string | undefined;
let returnNonJson = false;
globalThis.fetch = async (input, init) => {
  requestUrl = String(input);
  requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
  if (returnNonJson) return new Response("bad gateway", { status: 502 });
  return new Response(JSON.stringify({ response: "[]" }), { status: 200 });
};

try {
  await new OllamaProvider("http://ollama.test/").complete({
    model: "test-model",
    system: "system",
    prompt: "prompt",
    maxTokens: 123,
    jsonSchema: fileOperationsJsonSchema,
  });
  assert.equal(requestBody?.stream, false);
  assert.equal(requestUrl, "http://ollama.test/api/generate");
  assert.equal(requestBody?.model, "test-model");
  assert.deepEqual(requestBody?.format, fileOperationsJsonSchema);
  assert.deepEqual(requestBody?.options, { num_predict: 123 });

  returnNonJson = true;
  await assert.rejects(
    new OllamaProvider("http://ollama.test").complete({ model: "test-model", system: "system", prompt: "prompt" }),
    /Ollama returned a non-JSON response \(status 502\)/,
  );
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Provider verification passed.");
