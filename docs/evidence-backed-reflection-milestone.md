# Evidence-backed Reflection Milestone — 2026-08-16

## 1. 今日成果

今天完成了 LifeOS 的 Evidence-backed Reflection 端到端闭环：

```text
Current Reflection
→ Retrieve historical Reflections
→ LLM Structured Output
→ Evidence Validation
→ Grounding Validation
→ Evidence-backed UI
→ Manual Eval V0
→ Root-cause Analysis
→ Grounding Contract V1
→ Regression Eval
```

用户现在可以：

1. 保存一条当前 Reflection；
2. 检索它之前的历史 Reflection；
3. 让 LLM 比较当前与历史内容；
4. 获得结构化 Insight；
5. 查看当前证据与历史证据；
6. 确认当前内容是支持还是反驳历史模式；
7. 阻止伪造 Evidence 静默进入 UI；
8. 使用手动 Eval 验证 Grounding、Evidence Validity、Usefulness 和 Over-inference。

最终回归结果：

| 指标 | Eval V0 | Grounding Contract V1 |
|---|---:|---:|
| Grounded 通过 | 1/5 | 4/5 |
| Evidence Valid 通过 | 5/5 | 5/5 |
| Useful 达标 | 2/5 | 4/5 |
| Over-inference 达标 | 0/5 | 4/5 |
| 全项通过 | 0/5 | 4/5 |

---

## 2. 为什么要做 Evidence-backed Reflection

普通的 Reflection Analysis 只能分析当前输入。它可以生成摘要、情绪、挑战和建议，但无法回答：

```text
这个观察以前出现过吗？
它由哪些真实历史记录支持？
当前经历是在延续模式，还是在提供反例？
```

Evidence-backed Reflection 的目标不是生成更多内容，而是生成更可审计的内容。

每条 Insight 都必须回答：

1. 当前 Reflection 中哪段原文与结论有关？
2. 哪些历史 Reflection 支持或反驳该结论？
3. 当前与历史之间是什么关系？
4. 应用代码是否验证过这些 Evidence？

---

## 3. 最终架构

### 3.1 数据流

```text
用户保存当前 Reflection
        ↓
POST /api/reflections/[id]/analyze-with-evidence
        ↓
读取当前 Reflection
        ↓
retrieveRelevantReflections(currentReflection)
        ↓
最近最多 5 条历史 Reflection
        ↓
OpenAI Responses API + Structured Outputs
        ↓
Zod 验证输出结构
        ↓
validateAnalysisEvidence(...)
        ↓
验证 Current Evidence + Historical Evidence
        ↓
删除无效 Evidence 或整个 Insight
        ↓
UI 显示 Pattern、Interpretation、Confidence、Relationship 和 Grounding
```

### 3.2 关注点分离

| 层 | 主要职责 | 不负责什么 |
|---|---|---|
| Route | 编排完整请求流程 | 不实现具体 Retrieval 算法 |
| Retrieval | 返回候选历史 Reflection | 不生成 Insight |
| LLM | 比较当前与历史内容，提出候选 Insight | 不是可信数据源 |
| Zod Schema | 约束输出形状和 TypeScript 类型 | 不保证语义正确 |
| Validator | 验证 ID、excerpt 和证据来源 | 暂不判断重复记录是否为同一事件 |
| UI | 展示已经验证的结果 | 不自行决定 Evidence 是否有效 |
| Eval | 衡量系统真实质量 | 不参与线上请求 |

这种分离让 Retrieval 可以在未来替换为关键词、embeddings、vector search 或 hybrid retrieval，而不需要重写 Route、Schema 和 UI。

---

## 4. 领域模型与 Structured Output

Schema 位于：

```text
lib/reflection-analysis.ts
```

最终 Insight 结构：

```ts
type CurrentEvidence = {
  reflectionId: string;
  excerpt: string;
};

type HistoricalEvidence = {
  reflectionId: string;
  excerpt: string;
};

type EvidenceBackedInsight = {
  pattern: string;
  interpretation: string;
  currentEvidence: CurrentEvidence;
  evidence: HistoricalEvidence[];
  relationship: 'supports' | 'contradicts';
  confidence: 'low' | 'medium' | 'high';
};

type EvidenceBackedReflectionAnalysis = {
  status: 'insights_found' | 'insufficient_evidence';
  insights: EvidenceBackedInsight[];
  insufficientEvidenceReason: string | null;
};
```

### 设计含义

- `pattern`：当前与历史共同支持的具体观察；
- `interpretation`：在 Evidence 范围内进行谨慎解释；
- `currentEvidence`：当前 Reflection 中参与判断的原文；
- `evidence`：历史 Reflection 中参与判断的原文；
- `supports`：当前记录延续或支持历史模式；
- `contradicts`：当前记录构成历史模式的反例；
- `confidence`：模型对这条具体 Grounding 关系的置信程度；
- `insufficient_evidence`：系统可以明确承认证据不足，而不是强行生成 Pattern。

Structured Outputs 保证字段符合 Schema，但不能保证 Pattern 真的被 Evidence 支持。因此 Schema 后面仍然必须有应用层验证和 Eval。

---

## 5. Retrieval Boundary

Retrieval 位于：

```text
lib/reflection-retrieval.ts
```

边界函数：

```ts
retrieveRelevantReflections(currentReflection)
```

V1 策略：

- 排除当前 Reflection ID；
- 只检索 `createdAt < currentReflection.createdAt` 的记录；
- 按创建时间从新到旧排序；
- 最多返回 5 条；
- 只返回 `id`、`content` 和 `createdAt`。

`createdAt` 过滤可以防止时间泄漏。重新分析一条旧 Reflection 时，它不会引用后来才创建的记录作为历史 Evidence。

### 当前限制

当前实现把“相关”暂时定义为“最近”。它还没有：

- 关键词相关性；
- 语义相似度；
- embedding；
- vector search；
- hybrid retrieval；
- 内容去重。

今天没有增加向量数据库，因为 Eval 表明当前最高优先级不是扩大 Retrieval 能力，而是先建立 Grounding 约束。

---

## 6. LLM Analysis

Route 位于：

```text
app/api/reflections/[id]/analyze-with-evidence/route.ts
```

LLM 接收：

```text
currentReflection
historicalReflections[]
```

Prompt 的关键变化是从“先寻找 Pattern”改为“先判断是否存在有效 Grounding 配对”。

新的决策顺序：

```text
读取当前 Reflection
→ 找到直接相关的历史 Reflection
→ 判断 supports / contradicts
→ 确认两者支持同一个具体 Pattern
→ 生成 Insight
```

如果无法形成有效配对：

```text
status = insufficient_evidence
insights = []
```

Prompt 还明确要求：

- 0 条或 1 条高质量 Insight 优于多个弱 Insight；
- 不允许只总结历史记录；
- 不允许用“都是学习”“都是活动”等宽泛相似性制造模式；
- 不推断人格、心理诊断、未来结果、未知意图或因果关系；
- Current 和 Historical excerpt 必须是连续原文。

---

## 7. Evidence Validation

Validator 位于：

```text
lib/evidence-validation.ts
```

### 7.1 Current Evidence 验证

应用代码检查：

```text
currentEvidence.reflectionId === currentReflection.id
```

并确认：

```text
currentReflection.content.includes(currentEvidence.excerpt)
```

如果 Current Evidence ID 或 excerpt 无效，整个 Insight 被删除。

### 7.2 Historical Evidence 验证

应用代码检查：

1. Evidence ID 是否存在于 Retrieval allowlist；
2. excerpt 是否为对应历史 Reflection 的连续原文；
3. 一个 Insight 是否仍然至少保留一条有效历史 Evidence。

如果所有 Evidence 都无效：

```text
status = insufficient_evidence
insights = []
```

### 7.3 为什么不能只相信 LLM

LLM 在测试中多次返回：

- 未知 Reflection ID；
- 当前 Reflection ID 被误用为历史 Evidence；
- 不属于原文的 excerpt；
- 来源真实但语义不支持 Pattern 的 Evidence。

因此真实 AI 应用通常需要两层防线：

```text
Prompt：告诉模型应该怎么做
Application Validation：保证非法结果不能通过
```

### 7.4 负向测试

Mock 临时返回：

```text
currentEvidence.reflectionId = invalid-current-id
```

结果：

```text
status = insufficient_evidence
insights = []
removedEvidenceCount = 1
```

这证明伪造的 Current Evidence 不能静默进入 API 或 UI。

---

## 8. UI 闭环

UI 位于：

```text
app/reflection/page.tsx
```

Evidence-backed Insight 卡片现在显示：

- Pattern；
- Interpretation；
- Confidence；
- 当前记录支持历史模式；
- 当前记录反驳历史模式；
- Current Reflection excerpt 和 ID；
- Historical Evidence excerpt、ID 和日期；
- 被 Validator 移除的 Evidence 数量。

视觉约定：

- Current Evidence 使用蓝色；
- Historical Evidence 使用绿色；
- `supports` 使用绿色关系标签；
- `contradicts` 使用黄色关系标签。

UI 的重点不是装饰，而是让用户能够审计：

```text
模型为什么得出这条 Insight？
当前内容与历史内容是什么关系？
引用的是哪条真实记录？
```

---

## 9. Manual Eval V0

完整 Eval 记录位于：

```text
evals/evidence-backed-reflection-v0.md
```

评分维度：

| 维度 | 问题 |
|---|---|
| Grounded | Pattern 是否被当前和历史 Evidence 支持？ |
| Evidence Valid | ID 和 excerpt 是否真实有效？ |
| Useful | Insight 是否具体并具有价值？ |
| Over-inference | 是否超出 Evidence、扩大成长期人格或因果？ |

V0 结果：

| Case | 场景 | Grounded | Evidence Valid | Useful | Over-inference |
|---|---|---|---|---:|---|
| 1 | 强重复模式 | FAIL | PASS | 3/5 | MINOR |
| 2 | 没有相关历史证据 | FAIL | PASS | 2/5 | MINOR |
| 3 | 防止心理状态过度推断 | FAIL | PASS | 1/5 | MINOR |
| 4 | 当前反驳历史模式 | PASS | PASS | 4/5 | MINOR |
| 5 | 有 Evidence，但防止身份扩大 | FAIL | PASS | 2/5 | MINOR |

V0 的重要发现：

```text
Evidence Valid = PASS
并不等于
Semantically Grounded = PASS
```

Validator 能证明引用来自某条真实 Reflection，但不能自动证明这条 Reflection 支持对应 Claim。

---

## 10. Failure Taxonomy

| 类型 | 描述 | 涉及 Case |
|---|---|---|
| Recency contamination | 最近记录不等于相关记录 | 2、3、5 |
| Relevant-history crowd-out | 更早但相关的记录被最近内容挤出 top 5 | 5 |
| Duplicate Evidence | 同一现实事件的重复记录被视为独立 Evidence | 1、2、5 |
| Current-anchor failure | Insight 没有围绕当前 Reflection | 2、3、5 |
| Unsupported abstraction | 通过提高抽象层级制造模式 | 1、2、3、5 |
| Insufficient-evidence failure | 没有相关证据仍返回 `insights_found` | 2、3 |
| Provenance violation | ID 或 excerpt 不合法 | 2、3、4、5 |
| Semantic validation gap | Evidence 真实但不支持 Claim | 1、2、3、5 |
| Interpretation overreach | 加入意图、人格倾向或未知原因 | 1–5 |
| Confidence inflation | 重复或有限 Evidence 得到高置信度 | 1、4、5 |

Case 4 能通过的原因：

```text
历史：在星巴克能够专注
当前：在星巴克无法专注
结论：星巴克对专注的影响存在波动
```

Current 与 Historical Evidence 具有明确共同主题和清晰的正反关系，模型不需要通过高层抽象制造 Pattern。

---

## 11. Grounding Contract V1

根因分析后，只选择了一个最高杠杆改进：

> 每条 Insight 必须建立明确的“当前 Reflection ↔ 历史 Evidence”关系；无法形成有效配对时，必须返回 `insufficient_evidence`。

### 为什么没有先升级 Retrieval

- Case 4 使用相同的最近 5 条 Retrieval 也能通过；
- Case 1 即使拿到相关历史记录，仍会生成额外的不 Grounded Insight；
- 更强的向量搜索只能增加主题相似性，不能保证 Evidence 支持 Claim；
- 在没有 Grounding 合同前，更多相似内容可能反而产生更多 plausible but unsupported Patterns。

### Grounding Contract 的组成

```text
currentEvidence
+ historical evidence
+ relationship
+ narrowly supported pattern
```

准入规则：

```text
无法指出当前原文
或无法指出直接相关的历史原文
或两者不能支持同一个 Pattern
→ 不允许返回 Insight
```

---

## 12. Regression Eval V1

回归测试重新分析原始 Case ID，没有创建新的 Case 数据，因此每个旧 Reflection 仍然使用其创建时之前的历史记录。

| Case | Status | Relationship | Grounded | Evidence Valid | Useful | Over-inference |
|---|---|---|---|---|---:|---|
| 1 | insights_found | supports | FAIL | PASS | 2/5 | MINOR |
| 2 | insufficient_evidence | N/A | PASS | PASS | 4/5 | NONE |
| 3 | insufficient_evidence | N/A | PASS | PASS | 4/5 | NONE |
| 4 | insights_found | contradicts | PASS | PASS | 4/5 | NONE |
| 5 | insights_found | supports | PASS | PASS | 4/5 | NONE |

### Case 1

无关的“平衡活动”Insight 已消失，输出从 3 条减少为 1 条。但剩余 Insight 仍然把内容相同、ID 不同的数据库记录解释为重复发生的现实事件。

### Case 2

正确返回 `insufficient_evidence`，不再将陶艺与 drumming 或 LifeOS 强行关联。

### Case 3

正确返回 `insufficient_evidence`，不再忽略当前会议内容，也没有生成长期焦虑或人格推断。

### Case 4

只保留一条 `contradicts` Insight，正确连接当前负面星巴克体验与历史正面体验，并删除了“主动优化环境”的意图推断。

### Case 5

只保留一条 `supports` Insight，正确连接当前 Validation/UI 修复与历史 UI 开发，不再被星巴克主题带偏。

---

## 13. 今天学到的 AI 工程概念

### 13.1 Separation of Concerns

Retriever、LLM、Schema、Validator、UI 和 Eval 分别承担不同责任。LLM 不应该同时充当生成器、数据库和最终裁判。

### 13.2 Retrieval Quality

最近记录不等于相关记录。但在升级 Retrieval 之前，需要先定义什么样的 Evidence 才允许支持一个 Claim。

### 13.3 Structured Output

Structured Output 让 LLM 结果可解析、可验证、可显示，也让失败状态能够显式表示。但结构正确不代表语义正确。

### 13.4 Grounding

Grounding 不只是附上一段引用。它要求 Claim、当前内容与历史 Evidence 之间存在可解释的支持关系。

### 13.5 Hallucination Prevention

Prompt 是软约束，Validator 是硬边界。真实应用不能只依赖模型“遵守规则”。

### 13.6 Evals

Eval 的价值不是证明模型永远正确，而是：

```text
发现失败模式
→ 找到共享根因
→ 选择一个改进
→ 重跑同一批 Case
→ 判断质量是否真的提高
```

今天的 Grounding Contract 就是由 Eval 驱动的改进，而不是凭感觉修改 Prompt。

---

## 14. Definition of Done

- [x] 可以输入并保存真实 Reflection
- [x] 可以检索历史 Reflection
- [x] LLM 返回结构化 Insight
- [x] Insight 引用真实 Historical Evidence
- [x] Current Evidence 是结构化输出的一部分
- [x] Current Evidence ID 和 excerpt 经过应用验证
- [x] 非法 Current 或 Historical Evidence 不能静默进入 UI
- [x] UI 显示 Current 与 Historical Evidence
- [x] UI 显示 `supports` / `contradicts`
- [x] 没有相关 Evidence 时能返回 `insufficient_evidence`
- [x] 已执行 5 个 Manual Eval V0 Case
- [x] 已执行 5 个 Grounding Contract Regression Case
- [ ] 重复内容不会虚增模式强度
- [ ] Confidence 能反映独立 Evidence 数量

---

## 15. 已知限制与下一步

目前唯一仍未通过的原始 Case 是 Case 1。

剩余问题：

```text
内容相同但 ID 不同的数据库记录
被错误地视为多个独立现实事件
```

这不是 Current Anchoring 问题，而是 Evidence Independence / Duplicate Evidence 问题。

下一项最值得做的小改进：

> 在 Retrieval 边界对完全相同的 Reflection 内容进行去重。

这一步暂时只需要处理完全相同的内容，不需要 embeddings 或向量数据库。完成后应重新运行 Case 1，检查：

- 重复历史记录是否只保留一条；
- 模型是否停止把重复保存解释为重复事件；
- Confidence 是否降低；
- Case 1 是否从 Grounded FAIL 变为 PASS 或 `insufficient_evidence`。

---

## 16. 关键文件

| 文件 | 作用 |
|---|---|
| `lib/reflection-analysis.ts` | Zod Schema 和领域类型 |
| `lib/reflection-retrieval.ts` | Retrieval boundary |
| `lib/evidence-validation.ts` | Current/Historical Evidence 验证 |
| `app/api/reflections/[id]/analyze-with-evidence/route.ts` | API 编排、Prompt 和 Structured Output |
| `app/reflection/page.tsx` | Evidence-backed UI |
| `evals/evidence-backed-reflection-v0.md` | V0 与 V1 Regression 完整记录 |

---

## 17. 最终结论

今天完成的不只是一个 LLM 调用，而是一条可以被验证和评估的 AI 产品链路。

最重要的成果不是“模型生成了 Insight”，而是系统现在能够：

```text
显示模型使用了什么 Evidence
验证 Evidence 是否真实
说明当前与历史是什么关系
在证据不足时拒绝生成模式
用固定 Eval 衡量修改是否有效
```

这使 Evidence-backed Reflection 从一个自由文本 Demo，变成了一个具备初步 Grounding、Validation、Observability 和 Eval 能力的 AI MVP。
