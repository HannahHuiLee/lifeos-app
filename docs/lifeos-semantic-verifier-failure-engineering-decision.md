# LifeOS — Semantic Verifier Failure & Engineering Decision

## 1. Context

LifeOS 的 Grounding Reliability 工作要解决一个具体问题：Evidence-backed Reflection 生成的 Pattern 和 Interpretation 可能引用真实 Reflection，却仍然产生证据不支持的语义结论。

现有实现已经能确定性地验证：

- Current Evidence ID 是否等于当前 Reflection ID；
- Historical Evidence ID 是否属于 Retrieval allowlist；
- excerpt 是否为对应 Reflection 的连续原文；
- 重复 Reflection 内容是否在进入 LLM 前被去除；
- confidence 是否超过有效独立历史来源数量允许的上限。

但 provenance validation 只能证明“引用来自真实来源”，不能证明“引用支持生成的 claim”。Case 5 中，模型曾把只存在于 Historical Evidence 的“星巴克”和“专注”描述为 Current 与 Historical 共同属性，而所有 Evidence ID 和 excerpt 都是合法的。

因此，我们引入了 claim-level semantic verifier：把每个已经通过 provenance validation 的 Insight 拆成一个 Pattern claim 和一个 Interpretation claim，再分别判断其支持状态。

## 2. Hypothesis

我们预期 Verifier 能够：

- 检测 Evidence 不支持的语义 claim；
- 区分 `supported`、`partial` 和 `unsupported`；
- 发现 Evidence ID/excerpt 校验无法发现的来源归属、数量、状态和关系错误；
- 只使用 claim 已引用的 Current/Historical Evidence，不重新选择证据；
- 在影响正式 API 输出前，先以离线评测证明自身可靠性。

## 3. Experiment Design

实验复用了 Grounding Reliability V3 冻结的 Case 5 数据：

- 10 个已经保存的真实模型响应；
- 每个响应包含 1 个 Insight；
- 每个 Insight 被确定性拆成 Pattern 和 Interpretation；
- 总计 20 个 claims；
- 原评测中的 run-level 人工标签保持不变：Run 05、10 为 `supported`，其余 8 个 run 为 `needs_detection`；
- 一个 run 中只要任一 claim 被判为 `partial` 或 `unsupported`，该 run 就算成功检测到问题；
- 如果两个 claims 都是 `supported`，该 run 被视为 Verifier 放行。

我们在 Route 集成前评测 Verifier，是为了隔离它自身的准确性、失败率和延迟，避免把 Retrieval、generator、provenance validation、Verifier 与 Route assembly 的问题混在一起。

本实验只做 detection，不做 repair/regeneration。这样可以单独回答“Verifier 能否可靠发现问题”，而不会把检测能力与重写能力混成一个指标。

## 4. Results

实际结果如下，不做重新解释或调整：

| Metric | Result |
|---|---:|
| True Positive | 3/8 |
| True Negative | 2/2 |
| False Positive | 0 |
| False Negative | 5 |
| Detection recall | 37.5% |
| False-negative rate | 62.5% |
| Structured output | 20/20 |
| Average latency per claim | ~2122 ms |
| Total duration for 20 calls | ~42.4 seconds |

20 次调用中没有 Structured Output failure、其他调用失败或 unclassified run。

## 5. Important Failure Examples

### Missed failures

- **Run 02 — quantity/cardinality failure:** Interpretation 声称历史记录“多次”提到在星巴克专注开发，但只引用了一个 Historical Reflection。Verifier 把 Pattern 和 Interpretation 都判为 `supported`。
- **Run 04 — not-all-cited-sources-support:** Claim 声称多条 Historical Reflections 都特别支持 Evidence-backed Reflection/UI。第二条历史证据只描述在 Starbucks 继续 LifeOS 项目，没有提到 Evidence-backed Reflection 或 UI。Verifier 仍声称“两条历史证据”支持相关工作，并放行整个 run。
- **Run 06 — quantity/cardinality failure:** Interpretation 使用“历史多条记录”，实际只引用一个 Historical Reflection。Verifier 没有执行独立来源数量规则。
- **Run 07 — unsupported environment:** Pattern 声称 Current 与 Historical 共同显示“在不同环境下”开发 LifeOS，但 Current Evidence 没有任何地点。Verifier 仍说两边都支持在不同环境推进项目。
- **Run 08 — unsupported mental state:** Pattern 把“专注推进”当作共同属性。Historical Evidence 明确写了专注，Current Evidence 只写“主要是在修复”证据验证和 UI。Verifier 错误地把主题上的“主要/聚焦于”理解成专注状态，并判为 `supported`。

这些 false negatives 覆盖了五类关键问题：

1. quantity/cardinality；
2. Historical-only attribution；
3. unsupported environment；
4. unsupported mental state；
5. not-all-cited-sources-support。

### Useful detections

- **Run 01:** Pattern 被判为 `partial`；Verifier 正确发现“多次持续开发”缺少足够的独立历史证据。
- **Run 03:** Interpretation 被判为 `partial`；Verifier 正确指出一条历史来源不能证明历史中“多次提到”。
- **Run 09:** Interpretation 被判为 `partial`；实际 cited excerpt 只有“我在那里”，没有明确写出“星巴克”，Verifier 正确坚持只使用引用 excerpt，而不是用完整来源补足 claim。

## 6. Key Engineering Discovery

```text
Structured output reliability
≠
semantic classification reliability
```

Verifier 的 Structured Output 成功率是 20/20，这只证明每次输出都满足预期结构，不证明语义分类正确。它在 8 个已知失败 run 中只检出 3 个，漏掉了 5 个。

```text
Prompt rules
≠
deterministic enforcement
```

Prompt 明确规定一条 Historical Reflection 不能证明“多次”，但 Run 02 和 Run 06 仍被放行。用自然语言写出规则可以影响模型行为，但不能提供应用级的确定性保证。

```text
Verifier reason
≠
auditable fact
```

Verifier 有时会生成听起来合理、但与 cited evidence 不符的 `reason`。例如：

- Run 04 的 reason 声称两条历史证据都支持 Evidence-backed Reflection/UI；
- Run 07 的 reason 声称 Current 与 Historical 证据共同支持“不同环境”，但 Current Evidence 没有地点；
- Run 10 的 reason 使用了“matching locations”，但 Current Evidence 同样没有地点。

这些解释可以用于诊断，但不能被当作已经验证的审计事实。Verifier 本身也是另一个 probabilistic model；它不能因为处于“验证”位置就被假定为正确，而必须独立评测。

## 7. Decision

当前工程决定：

- **Do not enter Step 6 Shadow Mode yet.**
- **Do not use the Verifier to block output.**
- **Do not implement repair/regeneration yet.**

原因：

- recall 只有 37.5%；
- false-negative rate 是 62.5%；
- 5 个已知失败 run 被错误放行；
- 额外延迟平均约为每个 claim 2.1 秒，即每个 Insight 约 4.2 秒；
- Verifier 的自由文本 `reason` 并不始终可信；
- 当前的检测价值不足以抵消额外延迟、模型成本和集成复杂度。

Shadow Mode 本身的产品风险较低，因为它不会直接阻止或修改用户输出。但在当前质量下，Verifier 还不能提供足够可靠的诊断价值，所以现在进行 Route 集成仍然过早。

## 8. Next Engineering Step

计划中的 Step 5D 工作是：

1. 人工标注全部 20 个 Pattern/Interpretation claims；
2. 从 run-level ground truth 转向 claim-level ground truth；
3. 为每个失败标记类型：`quantity/cardinality`、`historical-only attribution`、`unsupported environment`、`unsupported mental state` 和 `not-all-cited-sources-support`；
4. 重新评估哪些检查应该是确定性的；
5. 在可行的地方，把 quantity/cardinality 规则移到应用级 pre-check；
6. 要求 Verifier 输出逐来源的 support assessment，不再只依赖自由文本 reason；
7. 考虑将复合 claim 拆成更原子的 claims；
8. 每次改动后都使用完全相同的 frozen inputs 重新评测。

核心原则：**对于应用已经知道的事实，使用确定性检查；只把真正需要语义判断的问题交给 LLM Verifier。**

## 9. Interview Story — 60 Second Version

**Problem →** LifeOS already had provenance validation. It could verify reflection IDs and exact quoted text. However, valid evidence could still be used to support the wrong semantic claim.

**First Solution →** I built a separate claim-level verifier. It checked each Pattern and Interpretation against the Current and Historical evidence cited by that claim.

**Evaluation →** Before integrating it into the route, I tested it on 10 frozen runs containing 20 claims. The structured output was stable: 20 out of 20 calls returned the expected format.

**Failure →** Semantic classification was not reliable enough. Recall was only 37.5%, and five known failing runs were allowed through. Some explanations also claimed support that was not present in the cited evidence.

**Engineering Decision →** I deliberately did not integrate the verifier, use it to block output, or add repair. Its diagnostic value did not justify the latency, cost, and complexity.

**Lesson →** A verifier is still a probabilistic model and needs its own evaluation. I moved toward deterministic code for facts the application already knows, and better claim-level evaluation for judgments that truly need semantic understanding.

## 10. Interview Deep-Dive Points

### Why wasn't provenance validation enough?

Provenance validation proves that an ID is allowed and an excerpt exists in the source. It does not prove that the excerpt entails the generated Pattern or Interpretation. Case 5 used valid excerpts while wrongly treating Historical-only details as shared.

### Why wasn't prompt engineering enough?

Both the generator and Verifier had explicit rules about source attribution and quantity words. Frozen repeated evaluations showed that the models still violated them. Prompt rules improve probability; they do not create deterministic guarantees.

### Why did you evaluate the verifier before integrating it?

Testing it separately isolated the Verifier's classification quality, latency and failure modes. Integrating first would have mixed those results with Retrieval, generation, provenance validation and Route assembly.

### Why did you separate detection from repair?

If detection and regeneration were introduced together, a better final answer would not show which component caused the improvement. Detection first answered whether the Verifier could reliably identify bad claims; repair could be evaluated later as a separate stage.

### Why is a false negative especially dangerous in a grounding verifier?

A false negative labels an unsupported claim as supported. If the Verifier were later used for gating, the system could present a Grounding error as verified. In this experiment, five known failing runs were incorrectly allowed through.

### Why can a verifier's reason not be treated as an audit fact?

The `reason` is also model-generated text. In the frozen runs, it sometimes claimed shared locations or support relationships that were absent from the cited evidence. It can help diagnosis, but it is not independently verified evidence.

### Why move quantity/cardinality checks into deterministic code?

The application already has validated Reflection IDs and can count unique Historical sources exactly. Asking an LLM to count them adds uncertainty to a fact the application can guarantee.

### Why keep frozen evaluation inputs?

Frozen inputs allow prompt, model and code iterations to be compared against the same cases. Without them, an apparent improvement may come from easier examples rather than a better system.

### What would Verifier V2 change?

- Add claim-level human labels for all 20 claims;
- tag each failure type;
- move deterministic quantity/cardinality checks into application code;
- require a structured support assessment for each cited source;
- split compound claims into more atomic claims;
- rerun the same frozen inputs after each change.

### When would you consider moving to Shadow Mode?

After V2 is re-evaluated on the same frozen inputs and provides reliable enough diagnostic value to justify its latency, cost and integration complexity. Shadow Mode would still remain non-blocking; blocking or repair would require separate evidence.

## 11. Lessons Learned

1. A verifier is another probabilistic model and must itself be evaluated.
2. Structured output success does not imply semantic correctness.
3. Prompt instructions are not deterministic enforcement.
4. Facts already known by the application should be enforced in deterministic code.
5. AI reliability changes should be measured on frozen regression sets before affecting user-visible output.

---

## 12. Step 5D Progress Record

> Updated: 2026-09-05  
> Scope: evaluation and verifier reliability only; no Route integration, output blocking, or repair/regeneration.

Step 5D was started because the original run-level evaluation was too coarse. A run contained two claims—Pattern and Interpretation—but the original ground truth only said whether the whole run was `supported` or `needs_detection`. If the Verifier flagged the wrong claim inside a failing run, the run-level metric could still count it as a successful detection.

The work completed in Step 5D:

1. Defined a claim-level human-label contract.
2. Added labels for all 20 frozen Pattern/Interpretation claims.
3. Paired every extracted claim with its human ground truth and checked the claim kind.
4. Added pure functions for claim-level and multi-signal metrics.
5. Added a deterministic Historical quantity/cardinality pre-check.
6. Added per-source semantic assessments to the Verifier output contract.
7. Added deterministic source-coverage validation.
8. Updated the Verifier prompt with per-source assessment rules.
9. Ran a single manual Case-5-style check.
10. Re-ran the complete 20-call evaluation on the same frozen inputs.
11. Decomposed five semantic failures into manually defined atomic claims with exact target evidence.
12. Added five matched supported controls and ran a 10-call atomic evaluation.

The frozen claim-level ground truth contains:

| Human status | Claims |
|---|---:|
| `supported` | 10 |
| `partial` | 10 |
| `unsupported` | 0 |
| **Total** | **20** |

No frozen claim was labeled `unsupported` because each failing generated claim still had a supported core LifeOS/project-continuity relationship. Its error was an unsupported quantity, attribution, environment, mental state, or source-coverage detail. The separate synthetic Case-5 fixture still covers a genuinely `unsupported` core relationship.

## 13. Step 5D Engineering Process

### 13.1 Move from run-level to claim-level ground truth

Each of the 10 frozen runs contains one Insight, and each Insight produces two verification inputs:

```text
10 frozen runs
× 2 claims per Insight
= 20 claim-level examples
```

Each human label records:

- `kind`: Pattern or Interpretation;
- `expectedStatus`: `supported`, `partial`, or `unsupported`;
- `failureTypes`: one or more known failure categories;
- `note`: the human evidence-based reason for the label.

The human note is kept separate from the Verifier `reason`. Model-generated explanations cannot define their own ground truth.

Every extracted claim is explicitly paired with its label. Tests verify that each run has exactly two labels in Pattern/Interpretation order and that the claim kinds match. The claim-level labels must also reconstruct the original run-level label: if either claim is `partial` or `unsupported`, the run is `needs_detection`.

### 13.2 Classify the known failure types

The 10 problematic claims use five failure tags:

| Failure type | Tagged claims | What the error means |
|---|---:|---|
| `quantity/cardinality` | 5 | The claim says historical evidence occurred multiple times or exists in multiple records, but cites too few independent Historical IDs. |
| `historical-only attribution` | 3 | An attribute found only in Historical evidence is presented as shared by Current and Historical evidence. |
| `unsupported environment` | 2 | The claim introduces or shares a location/environment not present in the source to which it is attributed. |
| `unsupported mental state` | 2 | Focus or another internal state is attributed to a source that does not explicitly support it. |
| `not-all-cited-sources-support` | 1 | The claim says multiple cited sources support a detail, although at least one cited source does not. |

Some claims have more than one tag, so the tagged counts sum to more than 10.

### 13.3 Build a deterministic cardinality pre-check

The application already has the cited `source` and `reflectionId` values, so it can count unique Historical sources without an LLM.

The pre-check:

1. detects explicit Historical quantity/frequency wording such as `多次`, `多条`, `反复`, `multiple`, `repeatedly`, or `often`;
2. counts unique cited Historical `reflectionId` values with a `Set`;
3. returns a structured `quantity/cardinality` violation when fewer than two independent Historical sources are cited;
4. returns `null` when this specific deterministic violation is not found.

Two different excerpts with the same `reflectionId` still count as one source. Passing this pre-check does **not** mean the claim is semantically supported; it only means this known cardinality violation was not detected.

On the 20 frozen claims, this rule produced:

| Cardinality pre-check result | Count |
|---|---:|
| Correctly detected cardinality failures | 5/5 |
| False positives | 0 |

This converted one unreliable prompt instruction into deterministic application behavior.

### 13.4 Add per-source semantic assessments

The original Verifier returned only:

```ts
{
  claimId,
  status,
  reason,
}
```

The revised contract also requires one assessment for every cited source:

```ts
{
  source,
  reflectionId,
  support: "full" | "partial" | "none",
  reason,
}
```

The source-level assessment asks whether a source supports the portion of the claim attributed to that source. It prevents all evidence from being hidden behind one global explanation and makes source-specific mistakes observable.

Application code then checks that the result contains every unique cited `source + reflectionId` exactly once. It rejects:

- a missing source;
- a duplicated source;
- a fabricated Reflection ID;
- a correct ID with the wrong Current/Historical label.

This validation proves that the model assessed the correct source set. It does not prove that `full`, `partial`, `none`, or the reason is semantically correct.

### 13.5 Keep three detection signals separate

The evaluation now reports:

```text
Deterministic signal
= application-known rule violation

Semantic signal
= LLM returns partial or unsupported

Combined signal
= deterministic OR semantic detection
```

The system does not convert a deterministic violation into a fake LLM `partial` result. The signals remain separate so their contribution can be measured.

If the LLM call fails but the deterministic rule already finds a violation, Combined can still report that a problem was detected. If neither signal produces a result, the claim remains unclassified rather than being counted as supported.

## 14. Step 5D Evaluation Results

### 14.1 Single manual Case-5-style check

The manually selected synthetic claim said Current and Historical evidence both showed working with focus at Starbucks for three hours. Only the Historical evidence supported those attributes.

Actual result:

| Field | Result |
|---|---|
| Expected status | `unsupported` |
| Actual status | `unsupported` |
| Current assessment | `none` |
| Historical assessment | `full` |
| Source coverage | Passed |
| Duration | 4426 ms |

The Current reason correctly said Starbucks and focused work duration were absent. The Historical reason correctly identified the Starbucks and three-hour focus evidence. This proved that the new contract could work for one example, not that it was reliable across the full set.

### 14.2 Full 20-call evaluation after Step 5D changes

The same 10 frozen Case 5 runs and 20 claims were evaluated again.

#### Run-level metrics

| Metric | Result |
|---|---:|
| Correctly detected failing runs | 3/8 |
| Correctly classified supported runs | 2/2 |
| False positives | 0 |
| False negatives | 5 |
| Detection recall | 37.5% |
| False-negative rate | 62.5% |

#### Semantic claim-level metrics

| Metric | Result |
|---|---:|
| Claims needing detection | 10 |
| Supported claims | 10 |
| Correctly detected bad claims | 2/10 |
| Correctly classified supported claims | 9/10 |
| False positives | 1 |
| False negatives | 8 |
| Detection recall | 20% |
| False-negative rate | 80% |

#### Signal comparison

| Signal | Correct detections | Correct non-detections | FP | FN |
|---|---:|---:|---:|---:|
| Deterministic only | 5 | 10 | 0 | 5 |
| Semantic only | 2 | 9 | 1 | 8 |
| Combined | 5 | 9 | 1 | 5 |

Additional operational results:

- Structured Output failures: 0;
- other call failures: 0;
- unclassified claims: 0;
- average model latency: 2285 ms per claim;
- approximate model latency for two claims in one Insight: 4.57 seconds.

The last figure is derived from two sequential claim calls at the measured per-claim average; it is not a separately measured Route latency.

## 15. What the New Results Mean

### 15.1 Per-source structure improved observability, not classification

The Verifier produced the required structured result and passed source-coverage checks for all 20 calls. This means the model returned the correct source identities in the expected shape.

However, semantic claim recall fell to 20% in this measured run. The model still missed 8 of 10 claims that required detection.

```text
Correct source-assessment structure
≠
correct source-support judgment
```

### 15.2 The semantic Verifier added no unique correct detections

In the signal comparison:

```text
Deterministic TP = 5
Semantic TP = 2
Combined TP = 5
```

Therefore, both semantic true positives overlapped with claims already detected by the deterministic cardinality rule. The semantic model contributed no additional correct detection for the remaining genuinely semantic failures in this run.

### 15.3 Run-level metrics can still hide wrong-claim detection

Run-level correct detections were `3`, while semantic claim-level correct detections were only `2` and there was one claim-level false positive. Because two correct claim detections can cover at most two runs, at least one failing run was counted as detected because the Verifier alerted on the wrong claim.

This is why claim-level ground truth is necessary. A correct run-level label does not prove that the model found the real error.

### 15.4 The deterministic rule delivered the reliable improvement

The cardinality pre-check detected all five frozen quantity failures with zero false positives. It raised combined recall from the semantic-only `2/10` to `5/10`, but it could not address the five remaining semantic claims.

This supports the engineering split:

```text
Application-known facts
→ deterministic enforcement

Meaning, attribution, and entailment
→ semantic evaluation
```

### 15.5 Latency remains material

The new full evaluation averaged 2285 ms per claim. Since each Insight currently produces a Pattern and an Interpretation claim, the model-only verification path adds roughly 4.57 seconds per Insight when the calls are sequential.

The per-source output did not produce enough semantic improvement in this run to justify that latency, cost, and integration complexity.

## 16. Current Engineering Decision

The decision remains:

- do not enter Step 6 Shadow Mode yet;
- do not use the Verifier to block user-visible output;
- do not implement repair/regeneration yet;
- do not treat source-level `support` or `reason` as an audit fact;
- keep the deterministic cardinality pre-check as a separately measured signal;
- continue evaluating before any Route integration.

Shadow Mode remains low product risk because it would not alter output. Integration is still premature because the semantic Verifier did not add unique correct detections in the latest full run and added substantial latency and cost.

The later atomic-claim experiment improved diagnostic performance, but it did not change this integration decision. The result came from only 10 manually constructed claims in one measured run, automatic decomposition has not been built or evaluated, and one important semantic false negative remained.

## 17. Atomic-Claim Experiment

### 17.1 Why atomic claims were tested

The compound Pattern and Interpretation claims mixed several assertions, such as project continuity, UI work, environment, mental state, and source-wide support. A supported core assertion could hide one unsupported detail.

The experiment therefore isolated five known semantic failures into manually written atomic claims. Each atomic fixture contained only the evidence needed for that assertion and declared whether the assertion was:

- `shared`: attributed across all target sources; or
- `source-specific`: attributed to one named source.

The first five-call experiment contained only failing claims. It detected all five, but that result could not measure false positives. Five matched supported controls were then added so the final evaluation tested both sensitivity and specificity.

### 17.2 Final matched-control result

The final atomic evaluation used 10 claims:

| Ground-truth group | Claims |
|---|---:|
| Semantic failures | 5 |
| Matched supported controls | 5 |
| **Total** | **10** |

Actual metrics:

| Metric | Result |
|---|---:|
| Correctly detected failures | 4/5 |
| Correctly classified controls | 5/5 |
| False positives | 0 |
| False negatives | 1 |
| Detection recall | 80% |
| False-negative rate | 20% |
| Exact status matches | 6/10 |
| Structured Output failures | 0 |
| Other call failures | 0 |
| Unclassified claims | 0 |
| Average latency per atomic claim | 2032 ms |

Detection counted both `partial` and `unsupported` as a successful alert for a known failing claim. Four detected failures were classified as `partial` rather than the human label `unsupported`; only one of the five failing claims was an exact status match. All five supported controls were exact `supported` matches. Together, those outcomes explain the `6/10` exact-status result.

### 17.3 What improved

Compared with evaluating compound claims, manual atomic decomposition made the evidence relationship clearer:

- four of five known semantic failures produced a detection signal;
- all five supported controls passed;
- no output-schema or API-call failure occurred;
- source-level assessments made the unsupported source visible in the successful detections.

This is evidence that claim granularity matters. It is not evidence that the entire Verifier is ready for integration.

### 17.4 Remaining false negative: Run 07 environment

The failed atomic claim said Current and Historical evidence showed work in two different environments. Historical evidence explicitly named Starbucks; Current evidence did not specify a location.

The Verifier returned `supported`. Its reason treated the missing Current location as evidence of a different environment. That inference is invalid:

```text
Current location is not stated
≠
Current location differs from Starbucks
```

The user could have been in Starbucks, somewhere else, or the location could simply be unknown. Absence of a value cannot establish inequality with another value.

The output was also internally inconsistent: the Current source assessment was only `partial`, while the top-level status was `supported`. This shows that source assessments are useful diagnostic evidence but still require deterministic consistency rules or aggregation logic.

### 17.5 Why automatic decomposition is a separate reliability problem

The atomic claims in this experiment were manually written from known failures. A production system would need to create them automatically. That decomposition model or rule set could:

- omit an important subclaim;
- change the meaning or scope of a claim;
- attach the wrong evidence;
- invent a subclaim that the original output did not contain.

Therefore, automatic decomposition needs its own ground truth and evaluation. The strong result from manually prepared atomic inputs cannot be transferred directly to an automatic pipeline.

## 18. Final Decision for Today

Today’s Step 5D experiment is complete. The production integration decision is still **no**:

- do not enter Step 6 Shadow Mode yet;
- do not use the Verifier to block user output;
- do not implement repair or regeneration yet.

Shadow Mode itself would not control or contaminate user-visible output; it is non-blocking by definition. The reason to wait is engineering value: the current diagnostic pipeline is not yet complete or reliable enough to justify integration latency, API cost, and operational complexity.

The atomic result is promising, but the evidence is limited to 10 manually prepared claims and one measured run. One of five known failures was still allowed through, exact status agreement was 6/10, and each atomic call averaged about 2.0 seconds. Automatic decomposition and top-level/source-level consistency have not yet been evaluated.

## 19. Recommended Next Step

1. Preserve the same frozen compound inputs, claim-level labels, atomic fixtures, and matched controls as regression data.
2. Define the contract for automatic claim decomposition, including atomic text, scope, and target evidence.
3. Create human ground truth for decomposition itself: which subclaims must exist and which evidence each one may use.
4. Add deterministic aggregation rules so a top-level `supported` result cannot conflict with a required source assessed as `partial` or `none`.
5. Keep cardinality, ID coverage, duplicate detection, source labels, and other application-known facts in deterministic code.
6. Reserve the LLM for entailment questions that actually require semantic judgment.
7. Re-run the exact frozen inputs across multiple measured runs before comparing the result with explicit acceptance criteria.
8. Reconsider non-blocking Shadow Mode only when the complete pipeline adds stable diagnostic value beyond deterministic checks at an acceptable latency and cost.

Blocking and repair should remain later, separately evaluated decisions.

## 20. Interview Story — 90 Second Version

**Problem →** LifeOS already validated provenance: the model had to cite real Reflection IDs and exact excerpts. But a valid excerpt could still be used to support the wrong meaning, such as sharing a Historical-only location or mental state with the Current Reflection.

**First solution →** I built a separate claim-level semantic Verifier and evaluated it before Route integration. On 10 frozen runs, its structured output was stable, but run-level detection recall was only 37.5%, so I chose not to ship it.

**Better evaluation →** I added human labels for all 20 Pattern and Interpretation claims. That showed semantic claim recall of only 20% and revealed that a run-level success could come from flagging the wrong claim.

**Engineering split →** Five failures were cardinality problems that the application could calculate from unique Historical IDs. A deterministic pre-check detected all five with no false positives. I also required one assessment per cited source and validated exact source coverage.

**Atomic experiment →** I manually decomposed five remaining semantic failures and added five matched supported controls. The Verifier detected four of five failures, passed all five controls, and reached 80% recall with no false positives. However, it still inferred that an unstated Current location meant a different environment, and exact status agreement was only 6/10.

**Decision →** I stopped before Shadow Mode, blocking, or repair. The atomic result was encouraging but too small and too manual for production. My next step is to evaluate automatic decomposition and add deterministic consistency rules.

**Lesson →** Use deterministic checks for facts the application already knows, keep semantic claims atomic, and evaluate every AI reliability component as another probabilistic system.

## 21. Interview Deep-Dive Points

### Why was provenance validation not enough?

It proved that IDs and excerpts were real and correctly copied. It did not prove that an excerpt entailed the generated claim or that an attribute belonged to every source named by the claim.

### Why did claim-level ground truth matter?

A run contained two claims. The Verifier could flag the wrong one and still make the run look correctly detected. Claim-level labels exposed that metric error and identified the actual failure type.

### Why was prompt engineering not enough?

The prompt could request source-by-source reasoning, but it could not guarantee correct semantic classification. The model still returned convincing reasons for support relationships that were absent or logically invalid.

### What did deterministic code improve?

It detected all five frozen cardinality violations with zero false positives by counting unique Historical IDs. It also enforced exact source-assessment coverage. These were facts already present in application data, so an LLM was unnecessary.

### Why separate deterministic, semantic, and combined metrics?

Without separation, the combined result could make the LLM look useful when all correct detections came from deterministic code. In the compound 20-claim rerun, the semantic Verifier added no unique true positives beyond the cardinality pre-check.

### Why did atomic decomposition help?

It removed supported details that could mask one unsupported assertion and restricted the model to the relevant evidence. In the measured 10-claim atomic set, recall reached 80% and all five controls passed.

### Why is the atomic result not enough to ship?

The sample was small, the claims were manually decomposed from known failures, and the result came from one measured run. One important false negative remained, exact status agreement was 6/10, and automatic decomposition was not tested.

### Why is the Run 07 inference wrong?

Current evidence did not state a location. That leaves the location unknown; it does not prove that it differed from Starbucks. The same location and a different location are both possible.

### Would Shadow Mode affect users?

No. Shadow Mode would observe and record results without changing user output. It is still premature because an incomplete diagnostic pipeline would add latency, cost, and complexity without stable enough information.

### Why separate detection from repair?

Detection must first show that it can locate the real error. Repair adds another model step that may change supported content or introduce new errors. Combining them too early would make failures harder to attribute.

### Why keep frozen inputs and matched controls?

Frozen inputs make iterations comparable. Matched controls test whether improved sensitivity also creates false positives on similar but genuinely supported claims.

### What would Verifier V2 change next?

It would evaluate automatic atomic decomposition, enforce deterministic consistency between source assessments and the overall status, preserve deterministic application checks, and measure repeated runs against explicit acceptance criteria.

## 22. Learning Summary

1. A Verifier is another probabilistic model and must itself be evaluated.
2. Structured output and complete source coverage do not imply semantic correctness.
3. Run-level metrics can hide detection of the wrong claim; claim-level ground truth is essential.
4. Prompt rules are not deterministic enforcement.
5. Facts already known by the application belong in deterministic code.
6. Atomic claims can improve semantic evaluation, but automatic decomposition creates a new reliability boundary.
7. Missing evidence means unknown, not the opposite value.
8. Model reasons are diagnostic text, not auditable facts.
9. Matched supported controls are necessary for measuring false-positive risk.
10. AI reliability changes should be measured on frozen regression sets before they affect user-visible output.
