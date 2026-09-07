# LifeOS

LifeOS is a local-first personal AI system for reflection, learning, and evidence-grounded decision support.

It explores how an application can work with personal records while keeping model behavior bounded by controlled tools, explicit evidence provenance, deterministic reliability checks, and evaluation-driven rollout decisions.

> **Project status:** local-first, single-user MVP. The repository documents both implemented safeguards and unresolved reliability limits.

## Why LifeOS

Personal AI becomes more useful when it can retrieve real user records, but retrieval alone does not make an answer trustworthy. A model can cite an authentic record and still overstate, combine, or misinterpret what that record supports.

LifeOS was built to explore the application and evaluation layers needed between model output and a user-facing conclusion: controlled data access, source validation, deterministic constraints, and explicit decisions about which experimental capabilities are safe to integrate.

## Core Engineering Areas

### Agent MVP

The Agent MVP answers questions about saved reflections through a bounded tool loop:

```text
User Question
→ LLM
→ Tool Request
→ Application Validation
→ Tool Execution
→ SQLite
→ Tool Result
→ LLM
→ Final Answer
```

The model does **not** directly access the database. It can request a registered tool, but application code controls what can actually execute.

The current implementation includes:

- an explicit tool allowlist and dispatcher;
- strict runtime argument validation with Zod;
- bounded, sequential tool execution;
- real reflection retrieval through Prisma and SQLite;
- request-level traces that avoid logging reflection or question content;
- explicit handling for invalid tool calls, provider errors, and tool-loop limits.

### Grounding Reliability and Evaluation

LifeOS treats three reliability properties as separate:

```text
Valid retrieval
≠
Valid evidence reference
≠
Semantically supported claim
```

The implemented pipeline already provides:

- retrieval of prior reflections for evidence-backed analysis;
- normalized exact-content deduplication before prompt construction;
- evidence provenance validation for source IDs and excerpts;
- confidence constraints based on validated, independent historical evidence;
- claim-level fixtures and regression coverage for known grounding failures.

A separate semantic claim verifier was evaluated offline. Its Structured Output was stable, but semantic detection quality was not consistent enough to justify production integration. Deterministic, application-known facts—such as evidence cardinality—were moved into code instead of delegated to another model call.

Semantic verification therefore remains experimental and is intentionally not part of the production route. Detailed results and experimental metrics remain in the linked engineering notes rather than the main README.

### Listening Coach V2

Listening Coach V2 supports a complete custom transcript workflow:

```text
Custom transcript
→ Generated exercise
→ Immutable session snapshot
→ User answer
→ LLM evaluation
→ Persisted score and feedback
```

A user can provide transcript-based material with a title, source type, optional URL, and difficulty. The application generates a structured exercise, validates it, and carries the resulting snapshot through practice, evaluation, persistence, and history.

The saved snapshot preserves the exact source and exercise context associated with a session. The user's answer and structured analysis—including score and feedback—are persisted with that session rather than reconstructed from mutable practice data later.

## Architecture

```text
Next.js UI
│
├── Agent API
│   └── Tool schema → validation → dispatcher → Prisma
│
├── Reflection APIs
│   └── Retrieval → deduplication → analysis → evidence validation
│
├── Listening APIs
│   └── Practice generation → snapshot → evaluation → persistence
│
├── OpenAI API
│   └── Model-backed generation and evaluation
│
└── SQLite
    └── Local persistence through Prisma
```

The application—not the model—owns tool permissions, database access, validation, persistence, and deterministic post-generation constraints.

## Engineering Decisions and Trade-offs

### Why not direct database access?

Direct model access would make authorization, input validation, query scope, and failure handling difficult to control. LifeOS exposes narrow application-owned tools instead, so every executable operation is registered, validated, and bounded.

### Why not prompt-only reliability?

Prompts can guide behavior but cannot guarantee evidence independence, valid provenance, or justified confidence. Checks that depend on application-known facts are implemented in deterministic code. Semantic judgments remain evaluation targets rather than assumed guarantees.

### Why not a vector database yet?

The current dataset is small and time-oriented, so recent-record retrieval with explicit deduplication is easier to inspect and test. Semantic retrieval infrastructure would add complexity before there is enough scale or evaluation evidence to justify it. Retrieval quality will be revisited as the dataset grows.

### Why immutable snapshots?

A saved listening session should retain the exact material and exercise the user completed. Persisting a snapshot prevents later catalog or generator changes from silently changing the meaning of historical answers and feedback.

### Why evaluation-driven rollout?

Experimental components are not integrated only because they produce valid schemas or succeed in selected examples. LifeOS keeps measured failures visible and leaves a semantic verifier offline when its consistency is not strong enough for the production path.

## Current Limitations

- Local-first, single-user MVP with no authentication or multi-user authorization.
- Semantic claim verification remains experimental and offline.
- No automatic repair or regeneration of unsupported model output.
- Retrieval is optimized for the current small dataset rather than semantic search at scale.
- No external audio downloading, ASR, or pronunciation scoring.
- Custom listening metadata still has fallback behavior in parts of the History UI.
- Deployment hardening, monitoring, and production reliability work are not complete.

## Next Steps

- Evaluate automatic atomic-claim decomposition.
- Improve semantic-verifier consistency across repeated runs and failure classes.
- Add deterministic aggregation and cross-claim consistency checks.
- Extend agent observability without logging private reflection content.
- Add retrieval evaluation as the dataset and retrieval strategies grow.
- Add authentication, privacy controls, deployment hardening, monitoring, and production reliability safeguards.

## Tech Stack

- TypeScript and Node.js
- Next.js and React
- OpenAI API
- SQLite and Prisma
- Zod
- Vitest

## Local Setup

Requirements: Node.js and npm.

```bash
npm ci
cp .env.example .env
npm exec -- prisma generate
npm exec -- prisma migrate deploy
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

## Engineering Notes

- [Evidence-backed Reflection milestone](docs/evidence-backed-reflection-milestone.md)
- [Grounding Reliability V3 engineering notes](docs/grounding-reliability-v3-engineering-notes.md)
- [Listening Coach V2 snapshot architecture](docs/listening-coach-v2-snapshot-based-custom-practice.md)
- [Evaluation fixtures and saved runs](evals/)

## License

LifeOS is available under the [MIT License](LICENSE).
