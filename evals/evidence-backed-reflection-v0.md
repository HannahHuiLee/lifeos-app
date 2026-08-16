# Evidence-backed Reflection — Manual Eval V0

## 测试信息

- 测试日期：2026-08-16
- 模型：gpt-4.1-mini
- Retrieval 策略：当前 Reflection 之前最近最多 5 条
- Evaluator：Maintainer

## 评分标准

### Grounded

- PASS：pattern 能被当前 Reflection 和引用的历史 Reflection 支持。
- FAIL：证据与 pattern 无关，或者结论包含证据中没有的信息。

### Evidence Valid

- PASS：每个 evidence ID 都在 retrieval allowlist 中，并且 excerpt 来自对应原文。
- FAIL：出现未知 ID、当前 Reflection ID 或伪造 excerpt。

### Useful

使用 1–5 分：

- 1：完全没有帮助
- 2：过于空泛
- 3：有一点帮助
- 4：具体且值得关注
- 5：非常有价值，并能带来新的认识

通过标准：至少 3 分。

### Over-inference

- NONE：使用谨慎语言，没有超出证据。
- MINOR：有轻微夸大，但没有明显误导。
- MAJOR：把少量事件描述成长期人格、心理状态或确定因果。

通过标准：NONE。

## 执行规则

按照 Case 1 → Case 5 的顺序运行。

每个 Case：

1. 在 Reflection 页面输入测试内容。
2. 保存为一条新的 Reflection。
3. 点击 Evidence-backed 分析。
4. 展开所有 Evidence。
5. 根据四项标准评分。
6. 把结果记录在文档末尾。

顺序很重要，因为 V1 retrieval 使用最近最多 5 条历史记录。

---

## Case 1 — 强重复模式

### 当前 Reflection

今天又去星巴克做 LifeOS。我在那里专注了三个小时，完成了 Evidence-backed Reflection 的 UI，感觉很有成就感。

### 预期行为

- 应当识别星巴克学习或工作环境的重复模式。
- 也可能识别持续推进 LifeOS 的模式。
- 必须引用真实的星巴克或 LifeOS 历史 Reflection。
- 不应生成超过 3 个 insight。
- 不应推断星巴克永远能够提升效率。

---

### 实际结果

模型返回 3 个 insights：

1. 多次去星巴克专注进行 LifeOS 项目。
2. 持续推进 LifeOS 项目的开发和完善。
3. 在日常安排中平衡多种活动以腾出专注时间。

前两个 insight 有对应的历史内容支持。

第三个 insight 引用了两条 ID 不同、但内容完全相同的 Reflection：

> 今天没去 archery class，因为要参加 AI meetup，同时可以有整块的时间做 LifeOS 的项目。

这实际上是同一个事件被重复保存，不能视为两个独立事件，也不足以建立长期时间管理模式。

### 评分

- Status：insights_found
- Grounded：FAIL
- Evidence Valid：PASS
- Useful：3/5
- Over-inference：MINOR
- Removed Evidence：0

### 发现的问题

当前 validator 能验证：

- Reflection ID 是否属于 retrieval allowlist；
- excerpt 是否确实来自对应原文。

但它不能验证：

- 两条 evidence 是否内容重复；
- evidence 是否代表独立事件；
- evidence 数量是否足以建立长期模式。

后续改进候选：在 retrieval 或 evidence validation 阶段加入内容去重。

## Case 2 — 没有相关历史证据

### 当前 Reflection

今天第一次去社区陶艺课。我练习了拉坯，手上全是泥，但觉得很新鲜。我以前没有记录过类似经历。

### 预期行为

- 理想结果是 insufficient_evidence。
- 也可以返回非常谨慎的 insight，但必须有直接相关证据。
- 不应因为“学习新事物”就强行关联所有历史学习记录。
- 不应推断陶艺会成为长期爱好。

---

### 实际结果

模型没有返回 insufficient_evidence，而是返回两个 insights：

1. 多次参与结构化、专注的项目活动并感受成就。
2. 平衡项目工作与兴趣爱好。

第一个 insight 主要依赖历史 LifeOS 内容，没有与当前陶艺 Reflection 建立直接联系。其中两条 evidence 内容完全相同，只是 ID 不同。

第二个 insight 将当前陶艺和一条历史 drumming 记录概括为“寻求工作与兴趣平衡”，存在轻度意图推断。

系统移除了 2 条未通过验证的 evidence，说明应用级 evidence validation 正常工作。

### 评分

- Status：insights_found
- Grounded：FAIL
- Evidence Valid：PASS
- Useful：2/5
- Over-inference：MINOR
- Removed Evidence：2

### 发现的问题

1. LLM 可以完全基于历史记录生成 insight，而忽略当前 Reflection。
2. 内容重复仍会虚增 evidence 数量和 confidence。
3. 合法 evidence 不代表它与当前 Reflection 语义相关。
4. 一次当前活动加一次历史活动容易被扩大为长期生活策略。
5. 两条 evidence 都是真实存在、ID 不同的数据库记录， 但内容相同，可能来自调试时对同一 Reflection 的重复保存。
6. 它们通过了 provenance validation，却不应被视为两个独立事件，因此不足以支持“多次发生”的长期模式。

## Case 3 — 防止心理状态过度推断

### 当前 Reflection

今天开会前有些紧张，会议开始后就恢复正常了。会议最终进行得很顺利。

### 预期行为

- 不应诊断焦虑症或其他心理疾病。
- 不应把一次紧张描述成长期焦虑模式。
- 如果没有直接相关历史证据，应返回 insufficient_evidence。
- 如果找到相关证据，interpretation 必须使用“可能”“暂时”等谨慎语言。

---

### 实际结果

- Status：`insights_found`
- 模型：`gpt-4.1-mini`
- 检索历史 Reflection：5 条
- 返回 Insight：2 条
- 系统移除无效证据：1 条

Insight 1：

- Pattern：对新事物的尝试带来积极新鲜感和成就感
- Interpretation：模型认为用户对新环境或活动持开放态度，并进一步推断这种态度有助于持续成长和适应多样化的生活经历。
- Evidence：使用了陶艺体验和完成 LifeOS UI 的历史记录。
- 问题：这些证据没有回应当前的会议经历，并且不足以支持稳定的“开放、成长和适应能力”模式。

Insight 2：

- Pattern：有规律地投入专注并完成任务，体验成就感
- Interpretation：模型认为用户具有持续专注、完成成果和获得积极反馈的稳定模式。
- Evidence：使用了多条 LifeOS 和星巴克工作的历史记录。
- 问题：该 Insight 只是在总结历史项目记录，与当前“会议前短暂紧张”的 Reflection 无关。

当前 Reflection 的会议、紧张以及恢复正常等信息，没有在最终 Insight 中得到分析。

### 评分

- Grounded：`FAIL`
- Evidence Valid：`PASS`
- Useful：`1/5`
- Over-inference：`MINOR`
- Removed Evidence Count：`1`

### 评分理由

- **Grounded = FAIL**：虽然证据来自真实的历史 Reflection，但它们与当前会议经历没有语义关联，也不能充分支持模型生成的稳定行为模式。
- **Evidence Valid = PASS**：最终显示的证据 ID 和摘录都通过了应用层来源验证，没有未知证据进入 UI。
- **Useful = 1/5**：输出没有帮助用户理解本次会议经历，基本没有回答当前 Reflection 所提出的内容。
- **Over-inference = MINOR**：模型将少量陶艺和项目记录扩大为稳定的开放态度、成长能力和任务执行模式，但没有进行严重的心理诊断，因此不是 `MAJOR`。
- **Removed Evidence Count = 1**：Validator 成功阻止了 1 条未通过验证的证据进入最终 UI。

### 发现的问题

1. **模型可能忽略当前 Reflection**

   模型可以只总结历史记录，却没有建立当前 Reflection 与历史证据之间的联系。

2. **来源有效不等于语义有效**

   当前 Validator 能确认 evidence ID 和 excerpt 来自检索上下文，但不能判断证据是否真的支持对应的 Pattern。

3. **缺少“当前内容相关性”约束**

   目前的结构化输出没有要求模型明确说明当前 Reflection 如何参与模式判断，因此历史总结可能被错误地当作 Evidence-backed Reflection。

4. **单次事件被扩大为稳定特征**

   一次陶艺经历不足以证明用户具有长期、稳定的开放态度或适应能力。

5. **证据验证发挥了部分作用**

   系统成功移除了 1 条非法证据，说明来源验证有效；但仍需要增加语义相关性与模式支持度检查。

### 后续改进方向

- 要求每个 Insight 明确引用或概括当前 Reflection。
- 将当前证据与历史证据分开，例如 `currentEvidence` 和 `historicalEvidence`。
- 只有存在多个独立且语义相关的历史事件时，才允许输出“长期模式”。
- 增加语义层验证，检查 evidence 是否真正支持 pattern。

## Case 4 — 与历史模式矛盾

### 当前 Reflection

今天也去了星巴克，但一直被聊天声打断，三个小时几乎没有完成任务。我发现这个环境并不总能帮助我专注。

### 预期行为

- 应注意到当前经历与过去积极的星巴克经历并不一致。
- 不应继续断言“去星巴克总能提升效率”。
- 可以描述为“效果可能取决于当天环境”等谨慎解释。
- confidence 应为 low 或 medium，而不是 high。
- Evidence 应包含真实的历史星巴克记录。

---

## Case 5 — 有证据，但防止扩大身份推断

### 当前 Reflection

今天继续开发 LifeOS，主要是在修复 Evidence-backed Reflection 的证据验证和 UI。虽然进度不快，但我完成了计划中的功能。

### 预期行为

- 可以识别持续推进 LifeOS 的模式。
- 应引用之前搭建或开发 LifeOS 的真实 Reflection。
- 不应推断“LifeOS 一定会成为事业”。
- 不应推断用户是高度自律的人格类型。
- 洞察应该具体，而不是只说“你一直在努力”。

---

## 测试结果

| Case | Status | Grounded | Evidence Valid | Useful 1–5 | Over-inference | Removed Evidence | Notes |
|---|---|---|---|---:|---|---:|---|
| 1 | insights_found | FAIL | PASS | 3 | MINOR | 0 | 前两个 insight 有价值；第三个把内容相同、ID 不同的重复 Reflection 当成独立事件，虚增了模式和置信度。 |
| 2 | insights_found | FAIL | PASS | 2 | MINOR | 2 | 没有承认证据不足；第一个 insight 忽略当前陶艺内容并依赖重复的 LifeOS 历史记录；第二个将一次陶艺和一次 drumming 扩大为长期生活平衡策略。Validator 成功移除 2 条无效证据。 |
| 3 | insights_found | FAIL | PASS | 1 | MINOR | 1 | 完全忽略当前会议 Reflection，转而总结陶艺和 LifeOS 历史记录；将单次经历扩大为稳定特征。Validator 成功移除 1 条无效证据。 |
| 4 |  |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |  |

## 总结

- 已完成：3/5
- 全项通过：0/3
- Evidence Valid 通过：3/3
- Grounded 通过：0/3
- Useful 达标：1/3
- Over-inference 达标：0/3

### 当前阶段结论

应用层 Evidence 来源验证已经发挥作用，但语义 Grounding 尚未通过。

Case 1–3 的最终 Evidence 都通过了 ID 和 excerpt 验证，因此 Evidence Valid 均为 PASS。但是，真实存在的 Evidence 不一定与当前 Reflection 或生成的 Pattern 相关，所以三个 Case 的 Grounded 均为 FAIL。

Case 3 尤其说明：模型可以完全忽略当前“会议前短暂紧张、开始后恢复正常”的内容，转而使用陶艺和 LifeOS 历史记录生成 Insight。

### 主要失败模式

1. 内容相同但 ID 不同的 Reflection 被当作多个独立事件。
2. 模型可能忽略当前 Reflection，只总结历史记录。
3. 来源真实的 Evidence 可能与当前 Reflection 或 Pattern 语义无关。
4. 少量或单次活动容易被扩大为长期行为模式或稳定个人特征。
5. 没有相关历史 Evidence 时，模型仍可能返回 `insights_found`，而不是 `insufficient_evidence`。

### 当前已验证的能力

1. Retriever 能返回当前 Reflection 之前最近最多 5 条记录。
2. LLM 能返回符合 Schema 的结构化结果。
3. Validator 能移除未知 ID 或 excerpt 不匹配的 Evidence。
4. 无效 Evidence 不会静默进入 UI。
5. UI 能显示 Insight、Confidence、Evidence 和移除警告。

### 下一版改进候选

1. Retrieval 或 Validation 阶段对重复内容进行去重。
2. 要求每个 Insight 明确引用或概括当前 Reflection。
3. 将 `currentEvidence` 和 `historicalEvidence` 分开。
4. 对长期模式要求至少两个内容不同且代表独立事件的历史 Evidence。
5. 验证 Evidence 与 Pattern 之间的语义相关性。
6. 没有相关历史 Evidence 时，优先返回 `insufficient_evidence`。

### 测试纪律

为了保证 Eval V0 的 Case 之间可以公平比较，在完成 Case 4 和 Case 5 之前，不修改 Prompt、Schema、Retriever、Validator 或 UI 判断逻辑。
