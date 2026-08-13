# specflow-cloud

Spec-driven development pipeline: a fixed team of AI agent roles
(requirements → architecture → implementation → review) that turns a feature
request into reviewed, spec-backed code — with a manual checkpoint after
every stage. BYOK: you bring your own Anthropic API key.

## Status: MVP core loop + real implementation writes + git auto-commit

What works end-to-end right now:

- `speclane init` — one-time setup, stores your Anthropic API key encrypted
  at rest (AES-256-GCM + scrypt) in `~/.speclane/credentials.enc`
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
