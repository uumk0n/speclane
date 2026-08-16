# speclane

Spec-driven development CLI: a fixed pipeline of AI agent roles turns a feature request into reviewed, spec-backed code — with a **manual checkpoint after every stage**.

```
requirements → architecture → implementation → review
```

Bring your own key (**Anthropic**) or run fully local with **Ollama** (no API key).

CLI command: `speclane` · npm package: `speclane`

---

## What it does

1. You describe a feature.
2. Agents produce a requirements spec, then an architecture spec.
3. The implementation agent writes real project files (`create` / `modify`).
4. A reviewer checks the result against the specs.
5. After each stage you **approve**, **edit the files**, or **reject** with notes — nothing advances until you say so.

Artifacts land in the project you run it in:

| Path | Purpose |
|------|---------|
| `.speclane/config.yaml` | Project config (provider, model, flags) |
| `.speclane/state.json` | Pipeline progress |
| `.spec/01-requirements.md` | Requirements |
| `.spec/02-architecture.md` | Architecture |
| `.spec/03-implementation.json` | Audit log of file operations |
| `.spec/04-review.md` | Review findings |

---

## Requirements

- **Node.js** ≥ 18
- Either:
  - an [Anthropic](https://www.anthropic.com/) API key, or
  - [Ollama](https://ollama.com/) installed, a model pulled, and `ollama serve` running

---

## Install

Not published to npm yet. From source:

```bash
git clone https://github.com/uumk0n/speclane.git
cd speclane
npm install
npm run build
npm link
```

That puts `speclane` on your `PATH`. After code changes, run `npm run build` again (no need to re-link).

To unlink later: `npm unlink -g speclane`

---

## Quick start

Inside the **target project** (the repo you want to change):

```bash
speclane init
speclane run "add an endpoint to cancel an order and refund the balance"

# read .spec/01-requirements.md — edit if you want
speclane approve

# repeat: read the stage output → approve or reject
speclane status
```

### Anthropic

`init` encrypts your API key at rest (AES-256-GCM + scrypt) under `~/.speclane/credentials.enc`. You enter the passphrase on each `run` / `approve` / `reject` that needs the model — nothing is cached between CLI invocations.

### Ollama

Choose `ollama` during `init` (or set `provider: ollama` in `.speclane/config.yaml`). No API key. Make sure the server is up before generating:

```bash
ollama serve
ollama pull qwen3.6:27b   # or whatever you set as ollamaModel
```

If you see `fail fetch failed`, Ollama is usually not running on `ollamaHost` (default `http://localhost:11434`).

---

## Commands

| Command | Description |
|---------|-------------|
| `speclane init` | Create `.speclane/config.yaml`; store Anthropic key if needed |
| `speclane run "<feature>"` | Start a pipeline (or resume the current stage) |
| `speclane approve` | Approve the current stage, optionally auto-commit, run the next |
| `speclane reject "<notes>"` | Reject and regenerate with your feedback |
| `speclane status` | Show stage progress and attempt counts |

### Approve, reject, and git

- **`approve`** — marks the stage approved. If `autoCommit: true` (default) and you are in a git repo, commits the stage output (`speclane: approve <stage> [<id>]`). For implementation, commits the **changed project files**, not the JSON audit file. Then starts the next stage.
- **`reject "<notes>"`** — regenerates immediately with previous output + your notes. Overwrites the stage artifact; **nothing is committed** until you approve.
- Set `autoCommit: false` in `.speclane/config.yaml` to disable commits (files are still written to disk).

Rejecting review sends the pipeline back to **implementation** with the review findings as revision notes.

---

## Configuration

Created by `init` at `.speclane/config.yaml`:

```yaml
preset: backend-api          # only preset today
provider: anthropic          # or ollama
model: claude-sonnet-4-6     # Anthropic model
ollamaHost: http://localhost:11434
ollamaModel: qwen3.6:27b
specDir: .spec
requireCheckpoints: true
autoCommit: true
```

### Choosing an Ollama model

Implementation requires strict JSON (file operations). speclane constrains Ollama via the `format` parameter; model quality still matters for multi-file, convention-aware edits.

| Use case | Model | VRAM (approx.) | Notes |
|----------|-------|----------------|-------|
| Best overall | `qwen3.6:27b` | ~17GB | Strong structured output |
| Larger context | `qwen3-coder:30b` | ~24GB | 256K context |
| Agentic edits | `devstral:24b` | ~24GB | Coding-oriented |
| ~16GB | `gpt-oss:20b` | ~16GB | Fits modest hardware |
| Minimal (~8GB) | `qwen3:8b` | ~8GB | Expect more `reject` cycles |

Local models usually need more reject/regenerate loops on implementation than Claude — a quality/cost tradeoff, not a bug.

---

## How implementation works

- Prompt includes a filtered project tree plus files named in the architecture spec.
- Model returns Zod-validated JSON: full-file `create` / `modify` operations only (project-relative paths).
- A short diff preview is printed before the checkpoint.
- Unsafe paths and schema failures are rejected; no partial writes on validation errors.

---

## Security

- Anthropic API keys are stored encrypted (`~/.speclane/credentials.enc`), never in the project tree.
- Passphrase is required per invocation; speclane does not keep decrypted keys between runs.
- Prefer Ollama when you want all inference on your machine.
- Review diffs before `approve`, especially on implementation.

---

## Current scope

**Included**

- End-to-end pipeline with checkpoints
- Real file writes on implementation
- Optional git auto-commit on approve
- Anthropic + Ollama providers

**Not included yet**

- Multiple presets (only `backend-api`)
- Hosted dashboard / team workflows
- npm registry publish (`npm install -g …` from the registry)

---

## Development

```bash
npm install
npm run build        # compile to dist/
npm run typecheck
npm run dev          # run CLI via tsx without building
npm run verify:providers
```

```
src/
  cli.ts           entry point
  commands/        init, run, approve/reject, status
  core/            config, state, providers, file writer
  agents/          one agent per pipeline stage
  types/           shared types
  utils/           logger, credentials, git helpers
```

---

## License

[Apache License 2.0](./LICENSE) — Copyright 2026 Ilya Konyaev.

You can use, modify, and redistribute this software under Apache-2.0. Future paid/proprietary features can ship separately (open-core); this license does not prevent that.
