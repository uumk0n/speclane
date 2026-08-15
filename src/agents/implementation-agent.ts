import { BaseAgent } from "./base-agent.js";
import { getProvider } from "../core/llm-provider.js";
import { applyFileOperations, fileOperationsSchema, formatChangePreview } from "../core/file-writer.js";
import { buildRepositoryContext } from "../core/repository-context.js";
import type { AgentContext, FileOperation, PipelineStage, StageResult } from "../types/index.js";
import { zodToJsonSchema } from "zod-to-json-schema";

export const fileOperationsJsonSchema = zodToJsonSchema(fileOperationsSchema, {
  name: "FileOperations",
}) as Record<string, unknown>;

function parseOperations(response: string): FileOperation[] {
  const json = response.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error("Implementation agent returned invalid JSON. No files were changed.");
  }
  return fileOperationsSchema.parse(value);
}

function preview(content: string): string {
  const maxChars = 600;
  return content.length <= maxChars ? content : `${content.slice(0, maxChars)}\n… (truncated)`;
}

/**
 * Validation failures are generated-output errors: applyFileOperations has
 * not written anything when it reports them, so asking the model once to
 * correct its operations is safe. Other filesystem failures must surface.
 */
function isOperationValidationError(error: unknown): error is Error {
  return error instanceof Error && /^(Absolute paths are not allowed|Unsafe implementation path|Path escapes project|Duplicate operation for)/.test(error.message);
}

const SOURCE_CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go", ".rs", ".java", ".kt", ".cs", ".rb", ".php", ".sql", ".prisma",
]);

function hasSourceCodeChange(operations: FileOperation[]): boolean {
  return operations.some((operation) => {
    const fileName = operation.path.toLowerCase();
    return [...SOURCE_CODE_EXTENSIONS].some((extension) => fileName.endsWith(extension));
  });
}

export class ImplementationAgent extends BaseAgent {
  readonly stage: PipelineStage = "implementation";
  readonly specFileName = "03-implementation.json";
  private repositoryCwd = process.cwd();

  readonly systemPrompt = `You are a senior backend engineer implementing an approved architecture spec
in an existing TypeScript project. Make the actual code changes, following the existing project
conventions. Do not invent requirements that were not in the spec.

The response must implement the feature in source code. Do not respond with only
documentation, images, static assets, or configuration. Map every acceptance criterion to
the necessary model, business logic, API, UI, migration, and tests that exist in this project.

Respond with ONLY valid JSON: an array of objects with exactly these fields:
{"action":"create"|"modify","path":"project/relative/path","content":"complete desired file contents"}.
Use create only for a currently missing file and modify only for a supplied existing file. Every
content value must be the complete file, never a diff, snippet, Markdown fence, or prose.`;

  buildPrompt(ctx: AgentContext): string {
    const requirements = ctx.previousStages.requirements?.output ?? "";
    const architecture = ctx.previousStages.architecture?.output ?? "";
    return `Approved requirements:\n\n${requirements}\n\nApproved architecture spec:\n\n${architecture}\n\n${buildRepositoryContext(architecture, this.repositoryCwd)}\n\nImplement every requirement.`;
  }

  /** Makes prior structured operations useful revision context for the model. */
  override serializeForRevision(previousOutput: string): string {
    let operations: FileOperation[];
    try {
      operations = parseOperations(previousOutput);
    } catch {
      return "The previous implementation operations could not be parsed. Inspect the current files and apply the requested revision.";
    }

    return operations
      .map((operation) => `[${operation.action}] ${operation.path}\n${preview(operation.content)}`)
      .join("\n\n");
  }

  /** Backwards-compatible name for callers that need the operation summary directly. */
  serializeOperations(previousOutput: string): string {
    return this.serializeForRevision(previousOutput);
  }

  async run(ctx: AgentContext, apiKey?: string, cwd = process.cwd()): Promise<StageResult> {
    const startedAt = new Date().toISOString();
    this.repositoryCwd = cwd;
    const provider = getProvider(ctx.config, apiKey);
    const completionParams = {
      model: ctx.config.provider === "ollama" ? ctx.config.ollamaModel : ctx.config.model,
      system: this.systemPrompt,
      prompt: this.buildFinalPrompt(ctx),
      maxTokens: 16_000,
      jsonSchema: fileOperationsJsonSchema,
    };
    let response = await provider.complete(completionParams);
    let operations: FileOperation[];
    try {
      operations = parseOperations(response);
    } catch (firstError) {
      response = await provider.complete({
        ...completionParams,
        prompt: `${completionParams.prompt}\n\nYour previous response was invalid. Return only JSON that strictly matches the required file operations schema.`,
      });
      try {
        operations = parseOperations(response);
      } catch {
        throw new Error(`Implementation agent returned invalid file operations after one retry. No files were changed. ${(firstError as Error).message}`);
      }
    }
    if (!hasSourceCodeChange(operations)) {
      response = await provider.complete({
        ...completionParams,
        prompt: `${completionParams.prompt}\n\nYour previous response did not modify any source-code file, so it cannot implement this feature. Return a complete corrected JSON array that changes the required source files (for example .ts, .tsx, .js, .sql, or .prisma). Do not return documentation or static assets as the implementation.`,
      });
      try {
        operations = parseOperations(response);
      } catch {
        throw new Error("Implementation agent returned invalid file operations while correcting a source-code-free response. No files were changed.");
      }
      if (!hasSourceCodeChange(operations)) {
        throw new Error("Implementation agent returned no source-code changes after retry. No files were changed.");
      }
    }
    let changes: ReturnType<typeof applyFileOperations>;
    try {
      changes = applyFileOperations(operations, cwd);
    } catch (error) {
      if (!isOperationValidationError(error)) throw error;

      // No operation was written because validation happens before the
      // transaction begins, so retry once with the precise correction rather
      // than making the user restart the stage.
      response = await provider.complete({
        ...completionParams,
        prompt: `${completionParams.prompt}\n\nYour proposed operations cannot be applied: ${error.message}\n\nReturn a corrected complete JSON array. Each path must be a relative project FILE path from the project tree (for example \"src/tasks/tasks.service.ts\"); never use an HTTP route or URL such as \"/tasks/123\". Use \"modify\" for every existing file and \"create\" only for missing files.`,
      });
      try {
        operations = parseOperations(response);
      } catch {
        throw new Error("Implementation agent returned invalid file operations while correcting a file-operation validation error. No files were changed.");
      }
      if (!hasSourceCodeChange(operations)) {
        throw new Error("Implementation agent removed all source-code changes while correcting file operations. No files were changed.");
      }
      try {
        changes = applyFileOperations(operations, cwd);
      } catch (retryError) {
        if (isOperationValidationError(retryError)) {
          throw new Error(`Implementation agent returned incompatible file operations after retry: ${retryError.message}. No files were changed.`);
        }
        throw retryError;
      }
    }
    // Persist the action actually applied, rather than a create/modify label
    // guessed by the model. This is the useful form for a later revision.
    const appliedActions = new Map(changes.map((change) => [change.path, change.action]));
    operations = operations.map((operation) => ({
      ...operation,
      action: appliedActions.get(operation.path) ?? operation.action,
    }));
    const output = JSON.stringify(operations, null, 2);
    const specFilePath = this.writeSpecFile(ctx, output, cwd);
    const previousAttempt = ctx.previousStages[this.stage]?.attempt ?? 0;

    console.log(`\n${formatChangePreview(changes)}\n`);
    return {
      stage: this.stage,
      status: "awaiting_checkpoint",
      output,
      specFilePath,
      affectedFiles: changes.map((change) => change.path),
      startedAt,
      completedAt: new Date().toISOString(),
      attempt: ctx.revision ? previousAttempt + 1 : 1,
    };
  }
}
