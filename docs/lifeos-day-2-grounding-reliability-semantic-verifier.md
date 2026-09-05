# LifeOS Day 2 — Grounding Reliability / Semantic Verifier

> Date: 2026-09-05
>
> Scope: offline evaluation and verifier design. No Route integration, user-output blocking, or repair/regeneration was added.

## 1. Starting Point

At the beginning of Day 2, LifeOS already had a Grounding Reliability layer around Evidence-backed Reflection.

The existing deterministic provenance checks could verify that:

- the Current Evidence ID matched the current Reflection;
- every Historical Evidence ID came from the retrieval allowlist;
- every excerpt was a contiguous substring of the corresponding Reflection;
- duplicated Reflection content was removed before generation;
- confidence did not exceed the limit allowed by the number of valid independent Historical sources.

These checks gave useful guarantees. They could show that the model cited a real source, copied real text, and did not claim more confidence than the available source count allowed.

They could not show that the cited text actually supported the meaning of the generated Pattern or Interpretation.

Case 5 was the key example. A generated Insight used valid Reflection IDs and valid excerpts, but described Starbucks and a focused mental state as shared between Current and Historical evidence. Those details existed only in Historical evidence. The provenance was valid while the attribution was semantically wrong.

The core gap was:

```text
Valid retrieval
≠
Valid evidence reference
≠
Semantically supported claim
```

Retrieval answers whether a potentially relevant record was found. Provenance validation answers whether a citation is real and allowed. Semantic verification asks whether the cited evidence entails the claim and supports the claim’s source attribution.

## 2. Today's Goal

The original goal was to explore claim-level semantic verification before changing the production Route.

The initial hypothesis was:

1. treat each generated Pattern and Interpretation as a separate claim;
2. give each claim only the evidence it cited;
3. ask a separate Verifier to classify it as `supported`, `partial`, or `unsupported`;
4. measure detection quality before attempting repair or regeneration;
5. integrate only if the Verifier demonstrated enough diagnostic value.

This ordering mattered. If detection, repair, and Route integration were introduced together, it would be difficult to tell whether an improvement or regression came from retrieval, generation, verification, rewriting, or response assembly.

## 3. Attempt 1 — Claim-Level Verifier Design

### `ClaimEvidence`

`ClaimEvidence` represents one generated assertion and its claimed evidence relationship. It contains:

- a stable `claimId` so the result can be mapped back to the original claim;
- `insightIndex` so the claim remains connected to its Insight;
- `kind: pattern | interpretation`;
- optional `scope: shared | source-specific`;
- the claim text;
- `relationship: supports | contradicts`;
- `evidenceRefs`, containing the source label and Reflection ID for every cited source.

The Pattern/Interpretation split was introduced because the two strings can fail independently. A Pattern may be supported while an Interpretation adds an unsupported frequency, location, mental state, or causal explanation.

### `ClaimEvidence` source labels

Each reference preserves:

```ts
source: 'current' | 'historical'
```

This distinction is necessary for Case 5. A location or mental state can be true in a Historical Reflection without being true in the Current Reflection. Removing the source label would preserve the words but lose who those words describe.

### `VerifyClaimInput`

`VerifyClaimInput` combines:

- the structured claim; and
- the exact evidence excerpts associated with its `evidenceRefs`.

The Verifier receives only cited evidence, not the complete retrieval set. Otherwise, it could silently rescue a bad citation by finding support in an uncited Reflection. The evaluation is about the original claim-to-citation relationship, not whether support exists somewhere else.

### `SupportResult`

The first result contract contained:

- `claimId`;
- `status: supported | partial | unsupported`;
- a free-text `reason`.

The intended meanings were:

- `supported`: the core relationship and all material details are supported;
- `partial`: the core is supported, but at least one added detail is not;
- `unsupported`: the core claimed relationship is not supported.

Structured Output constrained the response shape. Application code also checked that the returned `claimId` matched the input. Neither mechanism could guarantee that the semantic judgment was correct.

### Initial implementation checks

The first unit tests covered claim construction and source preservation. During development, the new tests initially failed because the implementation did not yet exist, then passed after the claim-input builder was completed. The observed progression included 4 passing tests and later 9 passing tests in `lib/claim-verification.test.ts`.

The first real manual call also failed with `服务器尚未配置 OPENAI_API_KEY`. This was a configuration failure, not a semantic result. After the key was supplied, the synthetic Case-5-style attribution was correctly classified as `unsupported` in 4027 ms.

## 4. Attempt 2 — First Verifier Evaluation

The first evaluation reused the frozen Grounding Reliability V3 Case 5 data:

- 10 saved generator runs;
- one Insight per run;
- two claims per Insight: Pattern and Interpretation;
- 20 total Verifier calls;
- Run 05 and Run 10 labeled `supported`;
- the other 8 runs labeled `needs_detection`.

At this stage, ground truth was run-level. A run counted as detected if either of its two claims returned `partial` or `unsupported`.

The experiment was detection-only. It did not modify or regenerate the Insight. Route integration was intentionally postponed so the Verifier’s classification quality, failures, latency, and cost could be measured in isolation.

### First measured result

| Metric | Result |
|---|---:|
| True positives | 3/8 |
| True negatives | 2/2 |
| False positives | 0 |
| False negatives | 5 |
| Detection recall | 37.5% |
| False-negative rate | 62.5% |
| Structured Output success | 20/20 |
| Average latency per claim | ~2122 ms |
| Total duration for 20 calls | ~42.4 seconds |

There were no unclassified runs, Structured Output failures, or other call failures in this measured run.

## 5. What Failed in Attempt 2

### Run 02 — quantity/cardinality

1. The Interpretation said Historical records mentioned the Starbucks/focused-development behavior multiple times.
2. It cited only one independent Historical Reflection.
3. One source cannot establish that something appeared in multiple Historical records.
4. The Verifier returned `supported` for both claims.
5. This was wrong because the prompt’s quantity rule was not enforced in the final judgment.

### Run 04 — not all cited sources support the claim

1. The Interpretation said multiple cited Historical Reflections supported Evidence-backed Reflection/UI work.
2. One Historical source mentioned that work; the second mentioned continuing the LifeOS project but not Evidence-backed Reflection or its UI.
3. The all-sources support relationship was therefore false.
4. The Verifier allowed the run through.
5. Its reason also described both Historical sources as supporting the more specific work, inventing a support relationship that was not present.

### Run 06 — quantity/cardinality

1. The Interpretation referred to multiple Historical records.
2. Only one independent Historical Reflection was cited.
3. The frequency/cardinality statement was unsupported.
4. The Verifier returned a non-detection.
5. The model did not reliably execute a count that application code could calculate exactly.

### Run 07 — unsupported environment

1. The Pattern said Current and Historical evidence showed LifeOS work in different environments.
2. Historical evidence named Starbucks; Current evidence did not state a location.
3. Missing Current location means the location is unknown. It does not prove that the environments were different.
4. The Verifier returned `supported`.
5. Its reason treated a shared-environment relationship as established even though one side lacked environment evidence.

### Run 08 — unsupported mental state

1. The Pattern treated focused work as shared by Current and Historical evidence.
2. Historical evidence explicitly described focus. Current evidence described work and repairs but did not state the same mental state.
3. Completing or mainly working on a task does not prove a focused mental state.
4. The Verifier returned `supported`.
5. It incorrectly converted topical emphasis into evidence of an internal state.

### Other failure types

The frozen set also contained Historical-only attribution. A detail supported only by Historical evidence was sometimes expressed as a Current/Historical shared property. This was especially visible for focus and environment claims in Runs 07–09.

### Useful successful detections

- Run 01: the Verifier returned `partial` for unsupported repeated development based on insufficient independent Historical evidence.
- Run 03: it returned `partial` for a claim that said history mentioned something multiple times while citing one Historical source.
- Run 09: it detected that the cited excerpt said only “我在那里” and did not itself identify Starbucks.

These examples showed that the task was possible for the model, but the behavior was inconsistent across similar cases.

## 6. Engineering Discovery After Attempt 2

```text
Structured output reliability
≠
Semantic classification reliability
```

All 20 calls returned valid structured results, but five of eight failing runs were missed. Schema compliance measured output format, not entailment quality.

```text
Prompt rule
≠
Deterministic enforcement
```

The prompt explicitly said that one Historical Reflection could not prove “multiple” or “repeatedly.” Runs 02 and 06 still passed. Natural-language instructions can influence probability; they do not give an application-level guarantee.

```text
Verifier reason
≠
Auditable fact
```

The free-text reason was generated by the same probabilistic model. It sometimes claimed relationships that were not in the cited evidence:

- Run 04 said both Historical sources supported Evidence-backed Reflection/UI work;
- Run 07 claimed support for different or shared environments without a Current location;
- Run 10 used “matching locations” even though Current evidence did not provide a location.

The reason was useful for debugging the model’s behavior. It was not independently verified evidence and could not be treated as an audit record.

The larger discovery was that a Verifier is another probabilistic model. Calling it a Verifier does not make it trusted infrastructure; it needs its own ground truth, evaluation, error analysis, and rollout criteria.

## 7. Decision After Attempt 2

We decided not to:

- integrate the Verifier into Shadow Mode;
- use it to block user output;
- implement repair or regeneration.

The reasons were concrete:

- recall was only 37.5%;
- the false-negative rate was 62.5%;
- five known failing runs were allowed through;
- two sequential claims added about 4.2 seconds per Insight at the measured average;
- every extra model call added cost and operational complexity;
- the Verifier’s reasons were not consistently trustworthy;
- the measured diagnostic value was not strong enough to justify Route integration.

Shadow Mode itself would be non-blocking and would not change or contaminate user-visible output. The decision to wait was about insufficient diagnostic value, not direct product-output risk.

## 8. Attempt 3 — Claim-Level Ground Truth

Run-level ground truth was too coarse because each run contained two independently verifiable claims.

We added human labels for all 20 claims:

| Human status | Claims |
|---|---:|
| `supported` | 10 |
| `partial` | 10 |
| `unsupported` | 0 |
| **Total** | **20** |

Each label recorded:

- the claim `kind`: Pattern or Interpretation;
- `expectedStatus` from human review;
- one or more `failureTypes`;
- a human `note` based on the frozen claim and cited excerpts.

The evaluation paired those fields with the actual Verifier status and model-generated reason. Human notes remained separate from the Verifier reason so the model could not define its own ground truth.

No frozen compound claim was labeled `unsupported`: each bad compound claim still had a supported core LifeOS/project-continuity idea, with an unsupported quantity, attribution, environment, mental state, or source-wide detail. The separate synthetic manual fixture covered an unsupported core relationship.

The key metric problem was:

```text
bad claim missed
+
good claim falsely flagged
=
run may still look detected
```

A run-level true positive could therefore be accidentally correct without localizing the real error.

## 9. Latest Claim-Level Results

This section records the first claim-level rerun, which was the “latest” result at this point in the chronology. Later Step 5D experiments are recorded separately in Section 12.

### Run-level result at this stage

| Metric | Result |
|---|---:|
| Correctly detected failing runs | 4/8 |
| Correctly classified supported runs | 1/2 |
| False positives | 1 |
| False negatives | 4 |
| Run-level recall | 50% |
| Average latency per claim | 1764 ms |

### Claim-level result at this stage

| Metric | Result |
|---|---:|
| Claims needing detection | 10 |
| Supported claims | 10 |
| Correctly detected bad claims | 3/10 |
| Correctly classified supported claims | 8/10 |
| False positives | 2 |
| False negatives | 7 |
| Claim-level recall | 30% |
| Claim-level false-negative rate | 70% |
| Structured Output failures | 0 |

Four failing runs were marked `needs_detection`, but only three genuinely bad claims were correctly detected. Since three correct bad-claim detections cannot cover four different runs, at least one run-level “success” came from an alert on the wrong, supported claim.

In engineering terms, the detector sometimes knew that something looked suspicious without finding the actual defect. That is insufficient for auditing, blocking, or targeted repair.

## 10. Why the Latest Result Changed Our Understanding

Claim-level ground truth gave a more accurate picture because it used the same unit as the Verifier: one Pattern or one Interpretation.

It showed that:

- a run-level true positive may be accidentally correct;
- a false positive on a good claim can hide a false negative on the bad claim;
- aggregate run metrics can look better than actual error localization;
- detection quality and localization quality are different properties;
- verifier quality must be judged at the granularity of the object being verified.

This changed the evaluation question from “Did the run receive any warning?” to “Did the Verifier identify the correct claim and the correct evidence-support problem?”

## 11. Current Failure Taxonomy

| Failure type | Best current direction | Evidence-based reasoning |
|---|---|---|
| `quantity/cardinality` | **A. Deterministic validation** | The application already has validated source labels and Reflection IDs, so it can count unique Historical sources exactly. |
| `historical-only attribution` | **B. LLM semantic verification, with deterministic scope/coverage checks** | Determining whether an attribute such as focus belongs to Current, Historical, or both requires understanding text. Exact source identity and required coverage can still be enforced deterministically. |
| `unsupported environment` | **B. LLM semantic verification; still uncertain** | Recognizing whether an excerpt explicitly supports a location or environment is semantic. Today’s results show this remains unreliable. |
| `unsupported mental state` | **B. LLM semantic verification; still uncertain** | Distinguishing explicit focus from task completion or topical emphasis requires semantic judgment. The Verifier missed this in compound claims. |
| `not-all-cited-sources-support` | **Mixed** | Each source’s semantic support requires interpretation, but once per-source assessments exist, coverage and some overall aggregation constraints can be deterministic. |

The evidence supports moving cardinality out of the LLM. It does not yet support a final production architecture for the remaining semantic categories.

## 12. Current Engineering Decision

### Step 5D work completed after the first claim-level rerun

The work did not stop at the metrics in Section 9.

#### Deterministic Historical cardinality pre-check

A pure application-level check was added for explicit Historical quantity terms such as `多次`, `多条`, `反复`, `multiple`, `repeatedly`, and `often`.

It counts unique cited Historical `reflectionId` values. Multiple excerpts from the same Reflection still count as one independent source.

On the 20 frozen claims:

| Result | Count |
|---|---:|
| Correctly detected cardinality failures | 5/5 |
| False positives | 0 |

Passing this rule does not prove semantic support. It only means this known deterministic violation was not found.

#### Per-source semantic assessments

`SupportResult` was expanded to require one assessment per unique cited source:

```ts
{
  source,
  reflectionId,
  support: 'full' | 'partial' | 'none',
  reason,
}
```

Application code then deterministically rejects missing sources, duplicate sources, fabricated Reflection IDs, and Current/Historical label mismatches. This guarantees assessment coverage, not semantic correctness.

A manual Case-5-style call returned the expected `unsupported`, with Current assessed as `none` and Historical as `full`, in 4426 ms.

#### Full compound rerun after per-source changes

| Level/signal | Correct detection | Correct non-detection | FP | FN |
|---|---:|---:|---:|---:|
| Run level | 3/8 | 2/2 | 0 | 5 |
| Claim semantic | 2/10 | 9/10 | 1 | 8 |
| Deterministic claim signal | 5/10 | 10/10 | 0 | 5 |
| Combined claim signal | 5/10 | 9/10 | 1 | 5 |

Additional results:

- run-level recall: 37.5%;
- semantic claim recall: 20%;
- semantic claim false-negative rate: 80%;
- combined claim recall: 50%;
- Structured Output failures: 0;
- other call failures: 0;
- average latency: 2285 ms per claim.

The semantic model’s two correct detections overlapped with failures already detected by the deterministic cardinality rule. It added zero unique correct detections in that measured compound-claim run.

#### Atomic-claim experiment

Five known semantic failures were manually decomposed into smaller claims with only their target evidence. The first five-call run detected all five, but there were no supported controls, so false-positive risk could not be measured.

Five matched supported controls were then added. The final 10-call result was:

| Metric | Result |
|---|---:|
| Correctly detected failures | 4/5 |
| Correctly classified supported controls | 5/5 |
| False positives | 0 |
| False negatives | 1 |
| Detection recall | 80% |
| False-negative rate | 20% |
| Exact status matches | 6/10 |
| Structured Output failures | 0 |
| Other call failures | 0 |
| Average latency per atomic claim | 2032 ms |

Four detected failures returned `partial` rather than the human label `unsupported`. The remaining false negative was Run 07’s different-environment claim. The model treated an unstated Current location as evidence of a location different from Starbucks and returned `supported`. Its own Current source assessment was only `partial`, making the result internally inconsistent.

### End-of-day decision

Day 2 ends at the evaluation and verifier-improvement stage:

- no Route integration;
- no Shadow Mode integration yet;
- no production blocking;
- no repair/regeneration;
- keep deterministic rules for application-known facts;
- continue evaluating semantic error localization;
- evaluate automatic atomic decomposition separately before relying on the promising manual atomic result.

Automatic decomposition is a new reliability boundary because it could omit, alter, or invent subclaims or attach the wrong evidence. The final manual atomic result cannot be assumed to transfer to an automatic pipeline.

## 13. What Changed in My Understanding Today

### At the start

I understood that valid IDs and excerpts were necessary for Grounding. I also knew that Case 5 still contained a semantic attribution problem.

### What I expected

I expected a separate, stricter model to catch claims that the deterministic provenance layer could not understand. A clear prompt and Structured Output seemed like a reasonable way to make that Verifier reliable.

### What the evaluation proved

The Verifier could always return the requested shape and could correctly solve some cases. However, it missed most known failures in the first compound evaluations, sometimes flagged the wrong claim, and sometimes invented support inside its explanation.

Claim-level labels showed that the first run metric was too generous. Deterministic cardinality checking then solved five known failures more reliably than the LLM. Per-source output improved visibility but did not improve semantic correctness by itself. Manual atomic claims improved recall to 80% on a small matched set, but still produced one logically important false negative.

### What I understand differently now

Grounding is not one check. It is a layered problem:

```text
retrieval validity
→ citation/provenance validity
→ deterministic structural rules
→ semantic entailment
→ safe rollout decision
```

I now understand that an LLM Verifier must be treated like any other model component. Its output format, detection accuracy, localization accuracy, reasoning quality, latency, and failure behavior must all be measured separately.

I also understand that “missing” means “unknown,” not “different.” If Current evidence does not name a location, it may be the same location, another location, or unavailable information. The system cannot choose one without evidence.

## 14. Interview Story — Raw Version

**Problem →** LifeOS could validate that generated Insights cited real Reflection IDs and exact excerpts, but Case 5 showed that valid citations could still support the wrong semantic attribution.

**Initial architecture →** Retrieval selected evidence, the generator produced Evidence-backed Insights, provenance checks validated IDs and excerpts, and confidence was constrained by independent source count.

**New hypothesis →** I treated Pattern and Interpretation as separate claims and built a Verifier that saw only each claim’s cited Current and Historical evidence.

**Experiment →** I ran it offline on 10 frozen runs and 20 claims before Route integration. I measured detection only, without repair.

**Unexpected failure →** Structured Output was 20/20, but first run-level recall was only 37.5%, with a 62.5% false-negative rate. The model missed cardinality, Historical-only attribution, environment, mental-state, and all-cited-source failures. Some reasons invented support relationships.

**Measurement →** Claim-level ground truth later showed 30% claim recall at that stage, while run recall appeared to be 50%. Four failing runs looked detected, but only three bad claims were correctly identified. A later per-source compound rerun produced only 20% semantic claim recall. Deterministic cardinality checks detected 5/5 relevant failures with zero false positives. Manual atomic claims with matched controls reached 80% recall, 0 false positives, and 6/10 exact status matches.

**Engineering decision →** I did not integrate the Verifier, block output, or add repair. The final atomic experiment was promising but small, manually decomposed, and still had a false negative. It also required about two seconds per atomic claim.

**Next step →** Evaluate automatic decomposition with its own ground truth, add deterministic consistency rules between source assessments and top-level status, and repeat the frozen evaluation before reconsidering non-blocking Shadow Mode.

## 15. Interview Story — 60 Second English Version

LifeOS already checked provenance. It verified that a Reflection ID was allowed and that each quoted excerpt really existed in that Reflection. But Case 5 showed a different problem: valid Historical evidence was used to describe the Current Reflection, so the final claim was not semantically grounded.

I built a separate verifier for the Pattern and Interpretation claims and tested it before Route integration. I used 10 frozen runs with 20 claims. The output structure was stable in all 20 calls, but semantic quality was poor. The first run-level recall was only 37.5%. After I added claim-level human labels, one evaluation showed only 30% claim recall and proved that a run could look detected because the model flagged the wrong claim.

I decided not to integrate it or use it for repair. I moved source counting into deterministic code, because the application already knew the IDs. That check caught all five frozen cardinality failures. Manual atomic claims later improved recall to 80% on five failures and five controls, but the sample was small and one false negative remained. My lesson was to use code for facts the application knows and use an LLM only for real semantic judgments, with its own evaluation.

## 16. Interview Follow-Up Questions

### What problem were you trying to solve?

I was trying to detect generated claims that cited real evidence but assigned details or relationships that the cited excerpts did not support.

### Why wasn't provenance validation enough?

It proved that the citation was authentic. It did not prove entailment or correct source attribution.

### Why wasn't prompt engineering enough?

The same rule could pass in one frozen run and fail in another. Prompt text changed model probability but did not enforce counts, source coverage, or semantic correctness.

### Why did you build a Verifier?

Deterministic code could not directly understand every location, mental-state, action, or relationship claim. A separate model was an experiment to judge those semantic cases without changing the generator.

### Why did the Verifier fail?

It was still a probabilistic model. Compound claims mixed supported and unsupported details, it made unsupported inferences, and its final status sometimes disagreed with its own source-level assessment.

### Why did you evaluate at claim level?

Pattern and Interpretation fail independently. Run-level scoring could count a false alert on a good claim as successful detection of a different bad claim.

### Why didn't you integrate it into Shadow Mode?

Shadow Mode would not affect user output, but the incomplete pipeline did not yet provide stable enough diagnostic value to justify latency, API cost, and integration complexity.

### What is the difference between deterministic validation and semantic verification?

Deterministic validation calculates facts already represented in application data, such as source count or ID coverage. Semantic verification interprets whether text supports a location, state, action, or relationship.

### Which rules would you move out of the LLM?

Unique-source cardinality, expected source coverage, duplicate assessment detection, Reflection ID matching, source-label matching, and consistency constraints that can be derived from structured fields.

### What would you change in Verifier V2?

I would evaluate automatic atomic decomposition, keep exact evidence scope, preserve per-source assessments, add deterministic top-level aggregation constraints, repeat runs to measure variance, and define acceptance criteria before integration.

### What did you learn from this failure?

The word “Verifier” does not imply reliability. A validating model needs ground truth and regression evaluation just like the model it checks.

### How would this affect a production rollout decision?

I would keep it offline until it provides repeatable value beyond deterministic checks. Then I would consider non-blocking Shadow Mode. Blocking and repair would require stronger, separate evidence.

## 17. Exact Artifacts / Evidence

### Implementation and unit tests

- `lib/claim-verification.ts` — claim schemas, compound input construction, cardinality pre-check, and source-assessment coverage validation.
- `lib/claim-verification.test.ts` — unit tests for claim construction, scope, cardinality, source coverage, and atomic evidence targeting.
- `lib/claim-support-verifier.ts` — semantic Verifier prompt, OpenAI call, Structured Output schema use, claim-ID validation, and source-coverage assertion.
- `evals/claim-support-verifier.manual.test.ts` — opt-in real manual Case-5-style Verifier call.
- `evals/claim-support-verifier-v3.test.ts` — frozen run, claim-level, signal-level, and atomic real-evaluation harnesses.

### Frozen labels and fixtures

- `evals/fixtures/claim-verification.ts` — synthetic claim-verification fixture.
- `evals/fixtures/v3-case-5-run-labels.ts` — 10 run labels and 20 claim-level human labels.
- `evals/fixtures/v3-case-5-atomic-claims.ts` — five semantic failures, five matched supported controls, and atomic input construction with target-evidence filtering.
- `evals/grounding-reliability-v3-case-5.md` — Case 5 evaluation documentation.

### Frozen generator outputs

- `evals/runs/grounding-reliability-v3/case-5/measured-20260829T202623Z/run-01-response.pretty.json` through `run-10-response.pretty.json` — the 10 frozen responses used by the evaluation.
- `evals/runs/grounding-reliability-v3/case-5/measured-20260829T202623Z/semantic-review.md` — saved semantic review of the frozen runs.
- `evals/runs/grounding-reliability-v3/case-5/measured-20260829T202623Z/mechanical-summary.tsv` — mechanical summary for the measured set.
- `evals/runs/grounding-reliability-v3/case-5/measured-20260829T202623Z/route-source.sha256` — recorded Route-source hash for the frozen evaluation.

### Engineering notes

- `docs/grounding-reliability-v3-engineering-notes.md` — earlier Grounding Reliability V3 engineering notes.
- `docs/lifeos-semantic-verifier-failure-engineering-decision.md` — semantic Verifier experiments, decisions, final atomic result, and interview notes.
- `docs/lifeos-day-2-grounding-reliability-semantic-verifier.md` — this chronological Day 2 learning log.

### Observed verification evidence

- Unit/evaluation suite output reached `28 passed | 2 skipped` across three test files before the final real atomic run.
- The final atomic evaluation completed 10 real calls with 4/5 failure detections, 5/5 supported controls, 0 Structured Output failures, and 0 other call failures.
- Earlier targeted unit-test runs progressed through 4, 9, 12, 19, and 20 passing tests as individual capabilities were added.
- Development also exposed expected missing-implementation failures, including `calculateClaimSignalMetrics is not defined` and `buildAtomicClaimVerificationInput is not a function`, before the corresponding implementation was completed and the targeted tests passed.

No dedicated persisted JSON report for the Day 2 Verifier call results was found in the repository. The aggregate Verifier results were observed in test stdout and preserved in the engineering documentation. This limitation should be fixed in a later evaluation workflow if exact machine-readable replay of Verifier outputs is required.

## 18. End-of-Day Summary

### Completed today

* Built and tested claim-level inputs for Pattern and Interpretation.
* Added 20 claim-level human labels and a failure taxonomy.
* Evaluated run-level, claim-level, deterministic, semantic, and combined signals separately.
* Added a deterministic Historical cardinality pre-check that detected 5/5 frozen cardinality failures with no false positives.
* Added per-source support assessments and exact source-coverage validation.
* Evaluated five manually atomic failures and five matched supported controls.

### Tried but did not work

* A prompt-driven compound-claim Verifier did not provide reliable semantic detection. Its first run-level recall was 37.5%, and a later semantic claim-level run reached only 20% recall.
* Per-source Structured Output improved observability but did not make semantic classification reliable.
* The final atomic Verifier still allowed the Run 07 unsupported-environment claim through.

### Important discovery

* Valid structure, valid citations, and convincing explanations do not prove that a claim is semantically supported. Evaluation must measure the exact claim and exact failure being verified.

### Decision made

* Keep the work offline. Do not enter Shadow Mode, block output, or implement repair/regeneration yet.

### Next step

* Evaluate automatic atomic decomposition with human ground truth, add deterministic aggregation/consistency checks, and rerun the frozen regression set multiple times.

### One sentence I should remember for interviews

* A Verifier is still a probabilistic model: use deterministic code for facts the application already knows, and evaluate semantic judgments at the exact claim level before they affect users.
