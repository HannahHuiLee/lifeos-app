# Grounding Reliability V3 — Evidence Validity Is Not Semantic Grounding

> Status: Implemented and evaluated on 2026-08-29  
> Scope: Evidence-backed Reflection grounding reliability  
> Outcome: Deterministic context and confidence safeguards improved; semantic grounding remains an explicit limitation

## Why this milestone mattered

Grounding Reliability V3 began with what looked like one model-quality problem: an Evidence-backed Reflection could overstate a pattern or attribute a historical detail to the current entry. The important engineering lesson was that these failures did not all belong to the prompt.

The milestone exposed three distinct reliability layers:

1. **Context selection:** Which records are allowed to reach the model?
2. **Confidence calibration:** How strongly may the application present a model claim after evidence validation?
3. **Semantic grounding:** Do the generated claims actually follow from the cited Current and Historical Evidence?

Each layer needs a different control. Treating all three as prompt problems would have left deterministic failures in place and overstated what prompt tightening could guarantee.

## Failure Layer 1 — Context Selection

### What Case 1 revealed

Case 1 showed that different Reflection IDs do not necessarily represent independent real-world observations. A user can save normalized-identical content more than once, producing separate database rows that describe the same event.

Before V3, those rows could enter the LLM context as if they were independent evidence. That could inflate:

- recurrence claims such as “again” or “multiple times”;
- apparent pattern strength;
- the model's confidence.

The failure existed before generation. Once duplicate observations appeared in the prompt as separate records, the model had already been given a misleading evidence set.

### Deterministic retrieval solution

Reflection content is converted into a conservative comparison key by applying, in order:

1. Unicode NFKC normalization;
2. `trim()`;
3. collapse consecutive whitespace into one space.

The content is not lowercased, so case distinctions remain meaningful.

The Current Reflection's normalized content initializes the seen-content set. Historical candidates are already ordered newest to oldest, so the retrieval boundary can scan them once and:

- exclude Current ↔ Historical normalized duplicates;
- exclude Historical ↔ Historical normalized duplicates;
- retain the newest row when historical duplicates exist;
- preserve newest-to-oldest ordering;
- slice the deduplicated result to at most five independent historical records.

The query reads all earlier candidates before slicing. Fetching only five first would allow duplicates to consume slots and prevent older independent records from filling the context window.

### Why Retrieval is the primary boundary

Deduplicating after generation would be too late. The model could already have used duplicate rows to justify recurrence, strengthen a Pattern, or select a higher confidence. Cleaning the displayed evidence afterward would make the output look cleaner without removing the reasoning distortion.

Retrieval owns context selection, so it is the correct place to enforce evidence independence before prompt construction. This also protects every downstream consumer of `retrieveRelevantReflections()` instead of relying on each prompt or validator to rediscover the same rule.

## Failure Layer 2 — Confidence Calibration

### Structured output is not calibrated output

The Zod schema guarantees that `confidence` is one of:

```text
low | medium | high
```

It does not guarantee that the selected level is justified. A structurally valid `high` can still be unsupported after invalid evidence is removed.

### Deterministic confidence cap

V3 applies the following maximum after Historical Evidence has been validated:

| Validated independent historical sources | Maximum confidence |
|---:|---|
| 0 | Remove the Insight |
| 1 | `low` |
| 2 | `medium` |
| 3+ | `high` |

The count must use validated evidence rather than the model's raw `insight.evidence`. Raw evidence can contain an unknown Reflection ID, an empty excerpt, or an excerpt that does not occur in the claimed source. Allowing rejected evidence to influence confidence would preserve the inflation the validator was meant to prevent.

The count uses unique Reflection IDs. If the model cites two excerpts from the same Historical Reflection, that is still one independent source. Step 1 separately ensures that different retrieved IDs with normalized-identical content do not enter the context as independent records.

### Why this is a cap, not a recalculation

The application computes an upper bound; it does not replace the model's estimate:

```text
final confidence = min(model confidence, evidence-count cap)
```

Examples:

- model `low` with three sources remains `low`;
- model `medium` with three sources remains `medium`;
- model `high` with two sources becomes `medium`;
- model `medium` with one source becomes `low`.

Application code has deterministic evidence-count information and may safely lower an output that exceeds the allowed maximum. It should not automatically raise confidence: source quantity alone does not establish relevance, quality, consistency, or semantic entailment.

## Failure Layer 3 — Semantic Grounding

### Case 5: Evidence Validity != Claim Grounding

Case 5 contained a Current Reflection about continuing LifeOS development and repairing Evidence-backed Reflection validation and UI. A Historical Reflection also discussed LifeOS work, but added a Starbucks location and a focused working state.

The model sometimes generated a shared Pattern such as “working with focus at Starbucks,” even though those attributes appeared only in Historical Evidence.

The Evidence Validator can prove:

- Reflection IDs are in the permitted Current or Historical context;
- excerpts exist in the claimed source;
- Current and Historical evidence provenance is preserved.

It cannot prove:

- every claim in `pattern` or `interpretation` is entailed by the excerpts;
- a History-only location, behavior, or state was not attributed to Current;
- words such as “both,” “again,” “repeatedly,” or “consistently” are justified;
- every cited source supports a specific detail in the generated Pattern;
- an interpretation did not introduce unsupported causality, identity, or state.

This is the milestone's central distinction: authentic evidence can be cited in support of a semantically unsupported claim.

### Prompt mitigation experiment

The system prompt was tightened without adding another LLM verifier or changing Validator semantics. The additions asked the model to:

- separate Current and Historical places, behaviors, and states;
- build shared Patterns only from their explicit intersection;
- avoid attributing History-only concepts to Current;
- justify temporal or cross-record terms;
- describe the two different states separately for `contradicts`;
- perform a final attribute-level grounding check;
- follow a small correct/incorrect attribution example.

The measured result must be reported honestly:

- model: `gpt-4.1-mini`;
- real-model runs: 10;
- valid structured responses: 10/10;
- strict PASS: 2;
- strict FAIL: 8;
- strict pass rate: 20%;
- the prompt was frozen before measured runs;
- smoke/debug runs were excluded from the denominator;
- the prompt source hash and raw responses were saved under `evals/runs/grounding-reliability-v3/`.

The prompt produced correctly grounded outputs in some runs, but recurring failures remained: unsupported “multiple times” claims, shared focus states absent from Current, invented shared environments, and claims that all cited records supported a detail present in only one source.

**Conclusion:** prompt tightening may mitigate semantic attribution errors, but it does not provide a reliable semantic grounding guarantee. Case 5 is not fixed.

## Architecture summary

```text
Reflection History
    → Retrieval / Context Selection
    → Deduplication
    → LLM Structured Generation
    → Schema Validation
    → Evidence Provenance Validation
    → Confidence Constraint
    → Semantic Eval
```

The sequence matters. Every deterministic boundary removes a class of bad state before the next, less deterministic layer must reason about it. The final Semantic Eval measures a property that the current runtime cannot yet guarantee.

## General AI engineering lessons

1. **Determine which layer owns a failure before changing the prompt.** Duplicate context, unjustified confidence, and semantic attribution require different interventions.
2. **Context correctness, evidence provenance, and semantic grounding are different properties.** Passing one does not imply the others.
3. **If a failure can be prevented deterministically before generation, prefer that over asking the model to behave better.** This is why deduplication belongs at retrieval.
4. **Structured Output validates structure, not truth.** A schema-valid response can still contain unsupported claims.
5. **Evidence provenance validates source authenticity, not claim entailment.** A real excerpt can be used to support the wrong statement.
6. **Confidence should be constrained by validated evidence, not raw generated evidence.** Rejected or repeated sources must not raise the cap.
7. **Prompt improvements should be measured with repeated evals rather than judged from one successful run.** The successful third smoke run did not predict the 20% measured pass rate.
8. **Smoke/debug runs should not be mixed into measured evaluation results.** They influenced prompt development and would bias the result.
9. **Freeze the prompt before measured runs so the pass rate has a clear meaning.** Otherwise the samples do not measure one system version.
10. **A failed eval is useful when it reveals the next architectural boundary.** The 20% result distinguishes prompt mitigation from a semantic guarantee.

## What I would do differently next time

When an LLM reliability failure appears, I would not start by editing the prompt.

I would first classify the failure:

1. Was the wrong data retrieved?
2. Was invalid or duplicate context allowed into generation?
3. Did structured validation fail?
4. Was evidence provenance invalid?
5. Was confidence stronger than the validated evidence allowed?
6. Or was the evidence valid but the generated claim semantically unsupported?

Only the last category should immediately lead me toward semantic generation or verification strategies.

This milestone changed my debugging order from:

```text
Model output is wrong → change the prompt
```

to:

```text
Model output is wrong
    → identify the failing layer
    → add a deterministic invariant when possible
    → use prompt/model behavior only where deterministic guarantees are unavailable
    → measure the remaining probabilistic behavior with repeated evals
```

## Current reliability boundary

LifeOS can now improve context independence deterministically, validate evidence provenance, and constrain confidence using validated independent sources. It still cannot deterministically verify that every generated semantic claim is entailed by its cited evidence.

This is not production-grade semantic grounding. The limitation should remain visible in project status and future evaluations.

## Future work — not implemented

Likely next directions are:

- **Claim-to-source structured output:** represent important claims separately and attach the exact Current and Historical sources intended to support each one.
- **Claim-level semantic verification / entailment:** evaluate each generated claim against its cited excerpts rather than validating only IDs and substring provenance.
- **Repeated regression evals:** preserve fixed datasets, frozen prompts, raw artifacts, and pass-rate history across changes.
- **A semantic verifier or judge, possibly:** consider this only after defining and measuring its own reliability, latency, cost, failure modes, and evaluation strategy.

Embeddings or vector search are not the solution to Case 5. They may improve retrieval relevance, but Case 5 already had relevant records; the failure was incorrect semantic attribution after retrieval.
