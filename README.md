# specflow-cloud

Spec-driven development pipeline: a fixed team of AI agent roles
(requirements → architecture → implementation → review) that turns a feature
request into reviewed, spec-backed code — with a manual checkpoint after
every stage. BYOK: use Anthropic, or run locally with Ollama and no API key.

## Status: MVP core loop + real implementation writes + git auto-commit

What works end-to-end right now:

- `speclane init` — one-time setup, stores your Anthropic API key encrypted
  at rest (AES-256-GCM + scrypt) in `~/.speclane/credentials.enc`, or selects
  Ollama for a local, key-free path
- `speclane run "<feature request>"` — starts a pipeline, runs the
  `requirements` stage, writes `.spec/01-requirements.md`, then stops
- `speclane approve` — approves the current stage, **auto-commits its stage
  output to git** (if inside a repo and `autoCommit: true`, the default), then
  runs the next stage (`architecture` → `.spec/02-architecture.md`,
  `implementation` → writes real project files and records its operations in
  `.spec/03-implementation.json`, `review` →
  `.spec/04-review.md`)
- `speclane reject "<notes>"` — marks the current stage rejected and
  **immediately regenerates it**: the agent gets its own previous output
  plus your feedback and revises rather than starting from scratch. Nothing
  gets committed until you `approve` the revised version.
- `speclane status` — shows which stage you're on, what's approved, and how
  many attempts a stage took (shown when > 1)

The implementation agent receives a filtered project tree plus existing files
explicitly named by the architecture spec. It returns Zod-validated JSON
full-file operations; only project-relative `create` and `modify` operations
are applied. A concise diff preview is printed before its checkpoint.
Approving implementation commits all changed project files as one commit; it
does not commit the JSON audit file.

Not in this stage on purpose: multiple presets (only `backend-api` exists),
hosted dashboard, and team features.

### How reject + git together behave

1. `speclane run "..."` generates requirements, stage waits at checkpoint
2. `speclane reject "missing the refund edge case"` → agent revises,
   `.spec/01-requirements.md` is overwritten with attempt 2, still waiting
3. `speclane approve` → attempt 2 is committed (`git commit -m
   "specflow-cloud: approve requirements [<id>]"`), pipeline moves on

Set `autoCommit: false` in `.speclane/config.yaml` to disable commits (spec
files are still written to disk either way, just not committed).

## Requirements

- Node.js >= 18
- An Anthropic API key
- Or [Ollama](https://ollama.com/) installed and running locally, with your
  chosen model pulled (for example, `ollama pull qwen3.6:27b`). Start the
  local server with `ollama serve` before `speclane run` when using
  `provider: ollama`.

## Try it locally (before publishing to npm)

```bash
npm install
npm run build
node dist/cli.js init
node dist/cli.js run "add an endpoint to cancel an order and refund the balance"
# read .spec/01-requirements.md, edit if you want, then:
node dist/cli.js approve
# repeat approve after reading each generated spec file
node dist/cli.js status
```

## Choosing an Ollama model

The implementation stage requires strict JSON output (file operations
validated against a schema). specflow-cloud constrains Ollama's output to that
schema at the decoding level (via Ollama's `format` parameter), which matters
far more for reliability than the model choice itself - but not every local
model performs equally well within that constraint, especially on multi-file,
convention-aware code generation.

| Use case | Model | VRAM | Notes |
|---|---|---|---|
| Best overall (recommended) | `qwen3.6:27b` | ~17GB | Strongest native JSON/structured output |
| Larger context needed | `qwen3-coder:30b` | ~24GB | 256K context |
| Agentic multi-file edits | `devstral:24b` | ~24GB | Purpose-built for agentic coding |
| Limited VRAM (16GB) | `gpt-oss:20b` | ~16GB | Fits plain RAM, no discrete GPU required |
| Minimal hardware (8GB) | `qwen3:8b` | ~8GB | Works, but expect more `reject` cycles |

Set the model via `ollamaModel` in `.speclane/config.yaml`, or choose it
during `speclane init`. Regardless of model, expect more `reject` + regenerate
cycles on the implementation stage with local models than with Claude - this
is a quality/cost tradeoff, not a bug.

## Project layout

```
src/
  cli.ts              entry point, registers commands
  commands/           init, run, approve/reject, status
  core/                config, state machine, Anthropic client wrapper
  agents/              one class per pipeline role + a registry
  types/                shared types
  utils/                logger, encrypted credential storage, prompt helper
```

Generated at runtime inside whatever project you run `speclane` in
(not part of this repo): `.speclane/config.yaml`, `.speclane/state.json`,
`.spec/*.md`.

## Security note

The API key is encrypted with AES-256-GCM, key derived via scrypt from a
passphrase you choose at `init` time. You'll be asked for that passphrase
on every `run`/`approve` call, since decryption happens per-invocation and
nothing is cached in memory between CLI runs.
