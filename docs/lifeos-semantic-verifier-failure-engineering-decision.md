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
