# LifeOS

LifeOS is a local-first experimental app for personal reflection, evidence-backed analysis, and listening practice. The repository also preserves its grounding and claim-verification evaluation architecture.

## Local setup

Requirements:

- Node.js
- npm

Install dependencies and create a local environment file:

```bash
npm ci
cp .env.example .env
```

Generate the Prisma Client and initialize the local SQLite database:

```bash
npm exec -- prisma generate
npm exec -- prisma migrate deploy
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The example configuration uses `MOCK_LLM=true`, so an API key is not required for mock-supported flows. To use real OpenAI calls, set `MOCK_LLM=false` and provide `OPENAI_API_KEY` in the local `.env` file.

Never commit `.env` files or local SQLite databases.

## Verification

```bash
./node_modules/.bin/tsc --noEmit
npm run lint
npm test
npm run build
```


## Listening Coach V2 — Custom Material MVP

Listening Coach now supports a complete custom transcript-based practice flow:

```text
Custom source
→ Structured generated practice
→ Practice snapshot persistence
→ User summary
→ Existing AI feedback
→ Saved custom session
→ History
```

Custom material accepts a title, an optional source URL, a transcript, a B1/B1-B2/B2 difficulty, and one of four source types: `video`, `podcast`, `audio`, or `other`. AI generates a structured exercise with a main-idea question, detail questions, useful phrases, vocabulary, and a summary prompt. The completed practice reuses the existing Listening feedback and saved-session pipeline.

The end-to-end MVP was manually verified with `A Simple Way to Break a Bad Habit | Judson Brewer | TED`. The saved custom Session and its feedback can be loaded by History. Custom title and difficulty are not yet resolved from the snapshot in the History UI, so custom entries currently use its generic metadata fallback.

Current scope boundaries:

- custom transcript-based material is supported;
- external audio downloading is not implemented;
- Article/Text-to-TTS is not implemented;
- ASR and pronunciation scoring are not implemented;
- reusable source and exercise libraries are not implemented.

Architecture and verification details are documented in [Listening Coach V2 — Snapshot-Based Custom Practice](docs/listening-coach-v2-snapshot-based-custom-practice.md).

## Grounding Reliability V3

### Deterministically improved

Evidence-backed Reflection now has two deterministic reliability safeguards, with regression coverage:

- normalized exact-content deduplication before LLM context construction, including Current ↔ Historical and Historical ↔ Historical duplicates;
- confidence caps based on validated independent Historical Evidence;
- regression coverage for Reflection Retrieval and Evidence Validation.

### Evaluated but not solved

Semantic Current/Historical attribution was evaluated but is not solved. Prompt constraints were strengthened, then Case 5 was run ten times with `gpt-4.1-mini` after the prompt was frozen. Only 2/10 runs met the strict Grounding criteria, so the prompt change is recorded as a partial, unstable mitigation rather than a fix.

### Current reliability boundary

The current reliability boundary is explicit: **LifeOS can validate evidence provenance more reliably than it can validate semantic claim entailment.** The project does not claim production-grade Grounding or semantic correctness.

### Next reliability direction

Next reliability work should explore claim-level Grounding structure, semantic verification, and repeated eval pass-rate tracking. Detailed reasoning and lessons are documented in [Grounding Reliability V3 — Engineering Notes](docs/grounding-reliability-v3-engineering-notes.md).

## Development Notes

- [Reflection MVP — 2026-08-08](docs/dev-notes-2026-08-08.md)
- [Listening Coach V2 — Snapshot-Based Custom Practice](docs/listening-coach-v2-snapshot-based-custom-practice.md)
- [Grounding Reliability V3 — Evidence Validity Is Not Semantic Grounding](docs/grounding-reliability-v3-engineering-notes.md)
