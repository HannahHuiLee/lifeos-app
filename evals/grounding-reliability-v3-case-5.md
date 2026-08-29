# Grounding Reliability V3 — Case 5 Repeated Eval

## Purpose

Measure whether the prompt reliably prevents Historical-only
places, behaviors, and states from being attributed to the
Current Reflection.

## Fixed configuration

- Case ID: `cmsvzytc60005gduwbby0avy1`
- Model: `gpt-4.1-mini`
- Real model only: `MOCK_LLM=false`
- Planned measured runs: 10
- Smoke runs are excluded from the pass-rate denominator.
- The prompt is frozen before measured runs begin.

## Strict PASS criteria

A run is PASS only when all conditions hold:

1. HTTP status is 200.
2. The response uses the real model.
3. The result contains at least one useful grounded Insight.
4. Historical-only concepts such as Starbucks or focus are not
   attributed to the Current Reflection or described as shared.
5. Shared Pattern attributes are supported by both Current and
   Historical Evidence.
6. Temporal language such as both, again, continues, repeatedly,
   consistently, or still is supported by the cited records.
7. A contradicts Insight describes the Historical and Current
   states separately.
8. The output contains no unsupported personality, identity,
   causal, or future prediction.

`insufficient_evidence` is safe but counts as FAIL for this case
because directly related historical evidence exists.

Historical-only details may be mentioned only when they are
clearly attributed to Historical Evidence and are not used as
shared Current/History attributes.

## Results

| Run | HTTP | Real model | Grounded attribution | Useful | Overall | Notes |
|---:|---:|---|---|---|---|---|
| 01 | 200 | PASS | FAIL | PASS | FAIL | One Historical source, but claims repeated development and extends a Starbucks/focus experience. |
| 02 | 200 | PASS | FAIL | PASS | FAIL | Claims Historical Evidence mentioned the behavior repeatedly, but only one source was cited. |
| 03 | 200 | PASS | FAIL | PASS | FAIL | Claims the history mentioned the work repeatedly, but only one source was cited. |
| 04 | 200 | PASS | FAIL | PASS | FAIL | Says multiple Historical records all support Evidence-backed Reflection/UI, but the second source does not. |
| 05 | 200 | PASS | PASS | PASS | PASS | Shared claims stay within LifeOS, Evidence-backed Reflection, development, and UI. |
| 06 | 200 | PASS | FAIL | PASS | FAIL | Claims multiple Historical records, but cites only one source. |
| 07 | 200 | PASS | FAIL | PASS | FAIL | Introduces a shared different-environments pattern without any Current location evidence. |
| 08 | 200 | PASS | FAIL | PASS | FAIL | Attributes focus to the shared pattern and claims repeated history from one source. |
| 09 | 200 | PASS | FAIL | PASS | FAIL | Attributes focus to the shared Current/Historical pattern. |
| 10 | 200 | PASS | PASS | PASS | PASS | Shared Pattern is limited to LifeOS, Evidence-backed Reflection, development, and UI. |

## Pass rate

- Passed runs: 2
- Valid measured runs: 10
- Pass rate: `2 / 10 = 20%`

## Conclusion

The minimal prompt improvement produced correctly grounded output
in some runs, but it was not stable.

Eight of ten measured runs still contained at least one unsupported
Current/Historical attribution or temporal claim. Common failures
included:

- claiming repeated Historical behavior from one cited source;
- treating focus as shared when Current Evidence did not state it;
- introducing a shared environment despite no Current location;
- claiming that multiple Historical records all supported a detail
  that appeared in only one source.

The result does not support claiming that Case 5 is reliably fixed.
The prompt-only mitigation should be recorded as partial and unstable.

Smoke runs were excluded because they were used to adjust the prompt.
No retrieval, confidence, schema, Validator, route data flow, or UI
semantics were changed.