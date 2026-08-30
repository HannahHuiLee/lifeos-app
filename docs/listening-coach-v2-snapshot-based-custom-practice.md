# Listening Coach V2 — Snapshot-Based Custom Practice

## Status

Listening Coach V2 supports a working custom-material loop:

```text
Custom source
→ Structured generated practice
→ Practice snapshot persistence
→ User summary
→ Existing AI feedback
→ Saved custom session
→ History loading
```

The MVP accepts transcript-based `video`, `podcast`, `audio`, and `other` sources. A source has a title, optional reference URL, transcript, and B1/B1-B2/B2 difficulty. The Practice Generator produces a main-idea question, two or three detail questions, useful phrases, vocabulary, and a summary prompt.

History currently loads the saved custom answer and analysis. Its metadata resolver still looks only in the legacy fixed-practice catalog, so custom title and difficulty currently render through the generic `Unknown listening practice` / `custom` fallback. Snapshot-aware History metadata is future work, not part of the completed P0 flow.

## Problem

Listening Coach V1 coupled practice content to a single in-memory fixed-practice catalog. `practiceId` was used to recover the title, audio path, transcript, and evaluation reference.

V2 needed to accept custom material without rewriting:

- `ListeningSession` and the summary submission sequence;
- structured AI analysis;
- the feedback UI;
- saved-session History;
- support for the legacy fixed practice.

The central problem was therefore not a new feedback system. It was making the source of practice content session-specific.

## Architecture Decision

The MVP stores an immutable practice snapshot inside `ListeningSession` instead of immediately introducing separate `ListeningSource`, `ListeningExercise`, and `ListeningFeedback` database entities.

```text
ListeningSourceInput
        ↓
Practice Generator
        ↓
ListeningPracticeSnapshot
  ├── source
  └── exercise
        ↓
ListeningSession
  ├── practiceSnapshot
  ├── answer
  └── analysis
```

`practiceSnapshot` is a nullable text column containing validated JSON. It is nullable so the existing V1 Sessions remain valid.

This design was chosen because:

- the generated exercise belongs to the Session that was actually completed;
- a saved Session should preserve exactly what the user practiced at that time;
- future prompt or model changes must not silently change an old practice;
- the product does not yet require source reuse, exercise reuse, editing, versioning, sharing, or source-library CRUD;
- separate normalized tables would add lifecycle and relationship decisions before those needs have been demonstrated.

This is an intentional MVP boundary. It is not a claim that Source and Exercise should never become independent entities.

## Runtime Contracts

The V2 boundary is expressed with Zod contracts:

- `ListeningSourceInputSchema` validates user-provided source metadata and transcript;
- `GeneratedListeningExerciseSchema` validates Mock and real model output;
- `ListeningPracticeSnapshotSchema` combines the validated source and exercise;
- `CreateListeningSessionInputSchema` keeps Legacy and Custom Session inputs mutually exclusive.

The custom snapshot has no separate ID. `ListeningSession.id` supplies persistent identity, while the snapshot is immutable, session-owned data that is not independently queried or reused.

## Backward Compatibility

Custom Sessions resolve practice content from the saved snapshot:

```text
session.practiceSnapshot
→ source metadata
→ transcript
→ generated exercise
```

Legacy Sessions have no snapshot and continue to resolve through the fixed catalog:

```text
session.practiceSnapshot is null
→ practiceId
→ existing fixed-practice catalog
```

The Analyze route prefers the snapshot transcript and generated questions when a snapshot exists. When it does not, the route falls back to the V1 catalog transcript and reference information. A malformed stored snapshot fails explicitly instead of silently falling back to unrelated content.

This nullable-column and runtime-fallback strategy allowed V2 to be added without rewriting or migrating the eight existing Listening Sessions.

The intended History rule is the same—prefer snapshot metadata, then fall back to the fixed catalog. That metadata resolution is not implemented yet. The current History endpoint still resolves title and difficulty only through `practiceId`; it does, however, load and display the saved custom answer and analysis.

## Existing System Reused

V2 intentionally reused:

- the `ListeningSession` lifecycle;
- the existing summary answer flow;
- `ListeningAnalysisSchema`;
- the existing OpenAI structured-feedback path;
- the existing feedback UI;
- History loading and feedback rendering;
- the legacy fixed-practice catalog and audio exercise.

The principal change was generalizing where the Analyze route obtains the transcript and practice context. The feedback result shape and rendering pipeline were not rebuilt.

## Operational Failure Observed

During manual verification, the first Practice Generator request ended with `APIConnectionTimeoutError` before an HTTP status or request ID was received. A connectivity check subsequently succeeded, and manually submitting the form again completed the request.

The application does not implement a separate retry loop. The OpenAI client is constructed with the installed SDK defaults, and the successful recovery came from a manual rerun after connectivity returned. This incident is recorded as a transient operational failure, not a product-flow, schema, or data-model failure.

## Verification Evidence

The completed MVP was verified with the custom source `A Simple Way to Break a Bad Habit | Judson Brewer | TED` at B1-B2 difficulty.

Observed evidence:

- the Custom Material happy path completed successfully;
- the latest Session used `practiceId = custom`;
- a valid practice snapshot was persisted;
- the user's summary answer was persisted;
- a valid structured AI analysis was persisted;
- the real feedback model was `gpt-4.1-mini`;
- the Listening Session count increased from 8 to 9;
- 25 focused Listening tests passed;
- TypeScript passed with `npx tsc --noEmit --incremental false`;
- `git diff --check` passed.

A later attempt to rerun Vitest from a read-only Codex sandbox failed during Vitest startup because the process could not write a temporary config bundle under `node_modules/.vite-temp`. No test assertions ran in that attempt. This was a sandbox filesystem-permission limitation, not a failing test result; the earlier 25-test run remains the successful test evidence.

## When Should We Split the Model?

Separate `ListeningSource` and/or `ListeningExercise` entities may become justified when the product needs:

- one source to generate multiple exercises;
- a searchable source library;
- exercise reuse across Sessions;
- regeneration or version history;
- exercise editing;
- source deduplication;
- cross-session reuse;
- multi-user ownership or sharing.

None of these capabilities was required to validate the Custom Material MVP.

## Future Work

Possible next milestones, none of which are implemented here:

- Article/Text → generated TTS audio;
- uploaded audio → transcription;
- source-specific playback;
- richer listening stages: main idea → details → transcript → summary;
- learning-history analysis across Listening Sessions;
- snapshot-aware custom title and difficulty in History.

## Key Implementation Files

- `app/listening/page.tsx`
- `app/listening/CustomMaterialForm.tsx`
- `app/api/listening-practices/generate/route.ts`
- `app/api/listening-sessions/route.ts`
- `app/api/listening-sessions/[id]/analyze/route.ts`
- `lib/listening-contracts.ts`
- `lib/listening-analysis.ts`
- `lib/listening-practices.ts`
- `prisma/schema.prisma`
