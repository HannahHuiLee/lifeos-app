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

### 实际结果

- Status：`insights_found`
- 模型：`gpt-4.1-mini`
- 检索历史 Reflection：5 条
- 返回 Insight：2 条
- 系统移除无效 Evidence：2 条

Insight 1：

- Pattern：在星巴克工作时，专注体验存在波动；有时能够长时间专注完成任务，有时容易被聊天声干扰。
- Interpretation：星巴克并不总是适合专注，实际效果可能受到当天噪音等环境因素影响。
- Confidence：`high`
- Evidence：引用了两条真实的历史星巴克工作记录。
- 评价：模型正确结合了当前负面经历与历史正面经历，没有继续断言星巴克总能提升效率。

Insight 2：

- Pattern：关注并反思自身的专注状态以及环境对专注的影响。
- Interpretation：模型认为用户正在尝试理解和优化工作环境，以提升效率和体验。
- Confidence：`medium`
- Evidence：引用了两条与星巴克专注工作相关的历史记录。
- 评价：“关注和反思环境影响”能够被当前 Reflection 支持，但“正在优化工作环境”属于轻度意图推断。

### 评分

- Grounded：`PASS`
- Evidence Valid：`PASS`
- Useful：`4/5`
- Over-inference：`MINOR`
- Removed Evidence Count：`2`

### 评分理由

- **Grounded = PASS**：第一条 Insight 同时考虑了当前被聊天声干扰的反例和历史上能够专注工作的正面记录，正确识别了效果存在波动。
- **Evidence Valid = PASS**：最终显示的 Evidence ID 和 excerpt 均来自 Retriever 提供的历史 Reflection。Validator 还成功移除了 2 条未通过验证的 Evidence。
- **Useful = 4/5**：相比简单重复“星巴克有助于专注”，识别环境效果存在波动更具体，也更有行动价值。
- **Over-inference = MINOR**：第二条 Interpretation 将反思环境影响扩大为“正在尝试优化工作环境”，属于合理但没有直接证据证明的意图推断。
- **Removed Evidence Count = 2**：应用层 Validator 阻止了 2 条不合法 Evidence 进入最终 UI。

### 发现的问题

1. **第二条 Insight 存在轻度意图推断**

   当前 Reflection 表明用户注意到环境会影响专注，但没有明确说明正在执行工作环境优化计划。

2. **第一条 Confidence 可能偏高**

   当前反例加上两条正面历史记录足以支持“体验存在波动”，但样本仍然较少。`medium` 会比 `high` 更谨慎。

3. **当前 Reflection 的作用无法在 Evidence UI 中直接审计**

   第一条 Insight 明显使用了当前负面经历，但展开的 Evidence 只显示历史 Reflection。用户无法从 Evidence 列表直接确认当前内容如何参与结论生成。

4. **Validator 仍只验证来源**

   Validator 成功移除了 2 条不合法 Evidence，但无法判断第二条 Interpretation 中“优化环境”的意图是否被证据充分支持。

### Case 4 结论

Case 4 通过了 Grounding 和 Evidence Valid 测试。

模型正确处理了当前经历与历史模式之间的矛盾，将结论调整为“星巴克对专注的影响存在波动，并可能受到当天噪音影响”，没有继续生成绝对化的正面模式。

这是目前第一个 Grounded 通过的 Case。主要剩余问题是第二条 Insight 存在轻度意图推断，以及 UI 没有明确展示当前 Reflection 如何参与 Grounding。

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

### 实际结果

- Status：`insights_found`
- 模型：`gpt-4.1-mini`
- 检索历史 Reflection：5 条
- 返回 Insight：3 条
- 系统移除无效 Evidence：2 条

Insight 1：

- Pattern：多次在星巴克进行 LifeOS 相关工作，有时能够专注完成任务，有时受到嘈杂环境影响。
- Interpretation：模型认为用户经常选择星巴克工作，但环境对专注力的影响存在波动。
- Confidence：`high`
- Evidence：引用了 Case 4 的星巴克负面经历，以及两条内容相同、ID 不同的星巴克 LifeOS 正面记录。
- 问题：该 Insight 主要分析工作地点，而当前 Case 5 的重点是继续开发和修复 Evidence-backed Reflection。两条相同内容还被当作独立事件，提高了重复程度和 Confidence。

Insight 2：

- Pattern：Evidence-backed Reflection 的 UI 功能是近期反复完成的具体任务。
- Interpretation：模型认为用户近期重点开发和完善该 UI，并且已经多次完成该任务。
- Confidence：`high`
- Evidence：引用了两条 ID 不同但内容相同的“完成 Evidence-backed Reflection UI”记录。
- 问题：两条记录来自同一内容的重复保存，不能证明用户多次完成了同一 UI 任务。“反复完成”和“已经多次完成”不符合真实事件数量。

Insight 3：

- Pattern：LifeOS 项目开发进度存在波动，既有高效完成，也有进度不快的情况。
- Interpretation：模型认为效率波动可能与外部环境和任务复杂度有关，并认为用户能够意识和接受进度差异。
- Confidence：`medium`
- Evidence：最终只显示了一条关于星巴克被聊天声干扰、几乎没有完成任务的历史记录。
- 问题：该历史 Evidence 没有明确说明当时执行的是 LifeOS 项目，也没有证明任务复杂度或用户“能够接受进度差异”。

### 评分

- Grounded：`FAIL`
- Evidence Valid：`PASS`
- Useful：`2/5`
- Over-inference：`MINOR`
- Removed Evidence Count：`2`

### 评分理由

- **Grounded = FAIL**：第一条主要分析星巴克环境，没有回应当前修复 Evidence Validation 和 UI 的进展；第二条依赖重复内容虚构“反复完成”；第三条使用没有明确提到 LifeOS 的历史记录支持 LifeOS 进度模式，并加入了任务复杂度和接受进度差异等未被证明的信息。
- **Evidence Valid = PASS**：最终显示的 Evidence ID 和 excerpt 均来自 Retriever 提供的历史 Reflection。Validator 还成功移除了 2 条未通过验证的 Evidence。
- **Useful = 2/5**：输出提到了 LifeOS、UI 和进度波动，但没有准确呈现项目从 UI 开发推进到 Evidence Validation 修复的连续过程。
- **Over-inference = MINOR**：模型没有进行事业、人格或成功预测，但推断了“多次完成同一任务”“任务复杂度影响效率”和“能够接受进度差异”等未被充分证明的信息。
- **Removed Evidence Count = 2**：应用层 Validator 成功阻止了 2 条不合法 Evidence 进入最终 UI。

### 发现的问题

1. **重复内容继续虚增模式强度**

   两条 ID 不同但内容相同的 UI 完成记录，被模型解释为用户多次完成同一个任务，并生成 `high` Confidence。

2. **模型没有抓住当前开发阶段的变化**

   当前 Reflection 描述的是修复 Evidence Validation 和 UI，历史记录描述的是完成 UI。模型本可以识别项目从 UI 构建进入验证和修复阶段，但没有生成这个更具体的连续性 Insight。

3. **相关主题不等于充分 Grounding**

   Evidence 中出现 LifeOS 或 UI，并不自动证明“反复完成任务”或“项目开发进度长期波动”。

4. **模型容易被最近的突出主题带偏**

   Case 4 的星巴克环境内容影响了 Case 5，使第一条 Insight 继续讨论星巴克，而不是优先分析当前 LifeOS 开发进度。

5. **Interpretation 引入未被证明的原因和心理判断**

   “任务复杂度影响效率”和“用户能够接受进度差异”都没有直接 Evidence 支持。

6. **来源验证继续有效**

   Validator 成功移除了 2 条不合法 Evidence，但无法识别重复事件、主题偏离和语义支持不足。

### Case 5 结论

Case 5 没有通过 Grounding 测试。

模型识别到了 LifeOS 和 Evidence-backed Reflection UI 等相关主题，但没有准确生成“项目从 UI 开发推进到 Evidence Validation 修复”的连续性 Insight。

重复保存的相同 Reflection 再次被当作多个独立事件，导致模型错误生成“反复完成同一任务”的高置信度结论。最终 Evidence 均通过来源验证，但来源真实仍不能保证结论获得充分支持。

## 测试结果

| Case | Status | Grounded | Evidence Valid | Useful 1–5 | Over-inference | Removed Evidence | Notes |
|---|---|---|---|---:|---|---:|---|
| 1 | insights_found | FAIL | PASS | 3 | MINOR | 0 | 前两个 insight 有价值；第三个把内容相同、ID 不同的重复 Reflection 当成独立事件，虚增了模式和置信度。 |
| 2 | insights_found | FAIL | PASS | 2 | MINOR | 2 | 没有承认证据不足；第一个 insight 忽略当前陶艺内容并依赖重复的 LifeOS 历史记录；第二个将一次陶艺和一次 drumming 扩大为长期生活平衡策略。Validator 成功移除 2 条无效证据。 |
| 3 | insights_found | FAIL | PASS | 1 | MINOR | 1 | 完全忽略当前会议 Reflection，转而总结陶艺和 LifeOS 历史记录；将单次经历扩大为稳定特征。Validator 成功移除 1 条无效证据。 |
| 4 | insights_found | PASS | PASS | 4 | MINOR | 2 | 正确识别当前负面经历与历史正面记录之间的矛盾，得出星巴克专注效果存在波动；第二条将环境反思扩大为主动优化意图，存在轻度过度推断。Validator 移除 2 条无效 Evidence。 |
| 5 | insights_found | FAIL | PASS | 2 | MINOR | 2 | 识别到 LifeOS 和 UI 主题，但没有准确呈现当前从 UI 开发推进到 Evidence Validation 修复的连续过程；重复内容被解释为多次完成同一任务，且加入任务复杂度和接受进度差异等未充分支持的推断。Validator 移除 2 条无效 Evidence。 |

## 总结

- 已完成：5/5
- 全项通过：0/5
- Grounded 通过：1/5
- Evidence Valid 通过：5/5
- Useful 达标：2/5
- Over-inference 达标：0/5

### Eval V0 总体结论

Evidence-backed Reflection 的完整技术流程已经跑通：

Current Reflection → Retrieval → LLM Structured Output → Evidence Validation → UI Display → Manual Eval

应用层 Evidence 来源验证表现稳定。5 个 Case 最终展示的 Evidence 都通过了 ID 和 excerpt 验证，Validator 也在多个 Case 中成功移除了不合法 Evidence。

但是，语义 Grounding 仍然不稳定。只有 Case 4 正确结合当前 Reflection 与历史 Evidence，识别了历史模式中的反例。其余 Case 存在忽略当前内容、依赖重复记录、使用不相关 Evidence 或扩大结论等问题。

### 最终评分

| Case | 场景 | Grounded | Evidence Valid | Useful | Over-inference | Removed Evidence |
|---|---|---|---|---:|---|---:|
| 1 | 强重复模式 | FAIL | PASS | 3/5 | MINOR | 0 |
| 2 | 没有相关历史证据 | FAIL | PASS | 2/5 | MINOR | 2 |
| 3 | 防止心理状态过度推断 | FAIL | PASS | 1/5 | MINOR | 1 |
| 4 | 与历史模式矛盾 | PASS | PASS | 4/5 | MINOR | 2 |
| 5 | 有证据但防止身份扩大 | FAIL | PASS | 2/5 | MINOR | 2 |

### 已经达到的目标

1. 用户可以输入并保存真实 Reflection。
2. 系统可以检索当前 Reflection 之前最近最多 5 条历史记录。
3. LLM 能返回符合 Schema 的结构化 Insight。
4. Insight 能引用真实历史 Reflection。
5. 未通过 ID 或 excerpt 验证的 Evidence 会被移除。
6. 无效 Evidence 不会静默进入 UI。
7. UI 能显示 Pattern、Interpretation、Confidence 和可展开 Evidence。
8. 已完成并记录 5 个手动 Eval Case。

### 尚未达到的质量目标

1. 模型不能稳定地将当前 Reflection 作为分析中心。
2. 来源真实的 Evidence 不一定与 Pattern 语义相关。
3. 内容相同但 ID 不同的记录会被当作独立事件。
4. 单次事件容易被扩大为长期模式、稳定特征或用户意图。
5. 没有相关历史 Evidence 时，模型不能稳定返回 `insufficient_evidence`。
6. UI 没有明确展示当前 Reflection 如何参与每个 Insight 的 Grounding。
7. Confidence 没有充分反映证据数量、重复情况和矛盾程度。

### 主要失败模式

#### 1. 当前 Reflection 被忽略

Case 2、Case 3 和部分 Case 5 中，模型主要总结历史记录，而没有围绕当前内容生成 Insight。

#### 2. 重复记录被当作独立 Evidence

Case 1、Case 2 和 Case 5 中，内容相同但 ID 不同的 Reflection 虚增了事件数量、模式强度和 Confidence。

#### 3. Provenance Valid 不等于 Semantically Grounded

Validator 能确认 Evidence 来自检索上下文，但不能确认：

- Evidence 是否与当前 Reflection 相关；
- Evidence 是否真正支持 Pattern；
- Interpretation 是否超出 Evidence；
- 多条 Evidence 是否代表独立事件。

#### 4. 模型扩大少量观察

模型出现了以下轻度扩大：

- 将少量活动解释为长期生活平衡策略；
- 将一次新体验解释为稳定的开放和成长倾向；
- 将反思环境影响解释为主动优化环境；
- 将重复 UI 记录解释为多次完成同一任务；
- 推断任务复杂度和接受进度差异。

### 最重要的下一版改进

#### Priority 1：让当前 Reflection 必须参与 Grounding

修改结构化输出，使每个 Insight 明确包含：

- `currentEvidence`
- `historicalEvidence`

应用代码同时验证当前 excerpt 和历史 Evidence。

#### Priority 2：对 Retrieval 结果进行内容去重

在传给 LLM 前，对完全相同或高度相似的 Reflection 去重，避免重复保存的数据被当作独立事件。

#### Priority 3：增加模式最低证据要求

只有至少两个内容不同、代表独立事件并且语义相关的历史 Reflection，才允许生成长期模式。

证据不足时返回：`insufficient_evidence`。

#### Priority 4：限制 Interpretation 的推断范围

Prompt 明确禁止推断 Evidence 中没有表达的：

- 人格；
- 心理诊断；
- 长期身份；
- 未来结果；
- 用户意图；
- 未知因果关系。

#### Priority 5：让 Confidence 由证据质量决定

Confidence 应考虑：

- 独立 Evidence 数量；
- Evidence 是否重复；
- 是否存在反例；
- Evidence 与当前 Reflection 的相关程度；
- Pattern 是否包含推断。

### Definition of Done 检查

- [x] 可以输入并保存真实 Reflection
- [x] 可以检索历史 Reflection
- [x] LLM 返回结构化 Insight
- [x] Insight 可以显示真实 Evidence
- [x] 非法 Evidence 不能静默进入 UI
- [x] 可以手动执行至少 5 个 Eval Case
- [ ] 模型能稳定围绕当前 Reflection 生成 Grounded Insight
- [ ] 重复内容不会虚增模式强度
- [ ] 证据不足时能稳定返回 insufficient_evidence

### 最终判断

今天的 MVP 工程目标已经完成，Evidence-backed Reflection 的端到端流程可以运行，应用层 Evidence Validation 也已证明有效。

Eval V0 同时表明，下一版不应优先增加向量数据库或更复杂的 Retrieval。

当前最重要的问题是 Grounding 约束、重复数据处理和 Evidence 的语义相关性。

因此，下一步应先改进结构化输出和验证边界，再考虑 embeddings、vector search 或 hybrid retrieval。

---

## Grounding Contract Regression — V1

### 测试信息

- 测试日期：2026-08-16
- 模型：gpt-4.1-mini
- Retrieval 策略：保持 V0 不变，仍使用当前 Reflection 之前最近最多 5 条
- 测试方式：重新分析原始 Case ID，不创建新的测试 Reflection
- 修改范围：
  - 每个 Insight 增加 `currentEvidence`
  - 每个 Insight 增加 `relationship`
  - Prompt 改为先判断是否存在 Grounding 配对
  - Validator 验证 Current Evidence ID 和 excerpt
  - UI 分开显示 Current Reflection 和 Historical Evidence

### 回归目的

验证强制的“当前 Reflection ↔ 历史 Evidence Grounding 合同”是否能够：

1. 防止模型忽略当前 Reflection；
2. 在没有相关历史 Evidence 时返回 `insufficient_evidence`；
3. 区分 `supports` 和 `contradicts`；
4. 减少与当前内容无关的额外 Insight；
5. 阻止伪造的 Current Evidence 进入 API 和 UI。

### 回归结果

| Case | Status | Relationship | Grounded | Evidence Valid | Useful 1–5 | Over-inference | Removed Evidence | Notes |
|---|---|---|---|---|---:|---|---:|---|
| 1 | insights_found | supports | FAIL | PASS | 2 | MINOR | 0 | 无关的“平衡活动”Insight 已消失，输出从 3 条降到 1 条；但内容相同、ID 不同的记录仍被解释成重复发生的现实事件。 |
| 2 | insufficient_evidence | N/A | PASS | PASS | 4 | NONE | 0 | 正确识别历史记录中没有陶艺、拉坯或相似手工活动，不再将陶艺与 drumming 或 LifeOS 强行关联。 |
| 3 | insufficient_evidence | N/A | PASS | PASS | 4 | NONE | 0 | 正确识别历史记录中没有会议、紧张或类似情绪变化，不再忽略当前 Reflection，也没有心理状态扩大。 |
| 4 | insights_found | contradicts | PASS | PASS | 4 | NONE | 只保留 1 条 Insight，正确对比当前星巴克负面经历与历史正面经历；不再推断用户正在优化工作环境。 |
| 5 | insights_found | supports | PASS | PASS | 4 | NONE | 只保留 1 条 Insight，正确识别 LifeOS、Evidence-backed Reflection、Validation 和 UI 的持续开发；不再被星巴克主题带偏。 |

### 结果汇总

- 已完成：5/5
- 全项通过：4/5
- Grounded 通过：4/5
- Evidence Valid 通过：5/5
- Useful 达标：4/5
- Over-inference 达标：4/5
- 所有 Case 的 Removed Evidence：0

### V0 与 V1 对比

| 指标 | Eval V0 | Grounding Contract V1 |
|---|---:|---:|
| Grounded 通过 | 1/5 | 4/5 |
| Evidence Valid 通过 | 5/5 | 5/5 |
| Useful 达标 | 2/5 | 4/5 |
| Over-inference 达标 | 0/5 | 4/5 |
| 全项通过 | 0/5 | 4/5 |

### 按 Case 对比

#### Case 1

V0：

- 返回 3 条 Insight；
- 前两条与当前内容相关；
- 第三条将重复保存的 archery/meetup 记录扩大为长期时间管理模式。

V1：

- 只返回 1 条 Insight；
- 无关的时间管理 Pattern 已消失；
- Current Evidence 和 Historical Evidence 主题一致；
- 但两条内容完全相同的数据库记录仍被视为两个现实事件。

结论：

Grounding 合同解决了额外无关 Insight，但没有解决 Evidence Independence 和内容去重。

#### Case 2

V0：

- 错误返回 `insights_found`；
- 将陶艺、drumming 和 LifeOS 扩大为生活平衡策略；
- Useful 为 2/5。

V1：

- 正确返回 `insufficient_evidence`；
- 明确说明没有陶艺、拉坯或类似手工活动历史；
- 不再强行提高抽象层级制造 Pattern。

结论：

Grounding 合同修复了“没有相关证据仍强行生成模式”的问题。

#### Case 3

V0：

- 完全忽略当前会议 Reflection；
- 转而总结陶艺、成长和 LifeOS；
- Useful 为 1/5。

V1：

- 正确返回 `insufficient_evidence`；
- 明确说明没有会议、紧张或类似情绪变化的历史 Evidence；
- 没有进行长期焦虑或人格推断。

结论：

Grounding 合同修复了 Current Reflection Anchoring Failure。

#### Case 4

V0：

- 核心矛盾 Pattern 正确；
- 但生成了第二条关于主动优化环境的意图推断；
- Validator 移除 2 条 Evidence。

V1：

- 只生成 1 条高质量 Insight；
- 明确返回 `contradicts`；
- Current Evidence 是被聊天声干扰的负面经历；
- Historical Evidence 是过去在星巴克专注工作的正面经历；
- 没有额外意图推断；
- Removed Evidence 为 0。

结论：

Grounding 合同保留了原本正确的反例处理，同时减少了额外推断。

#### Case 5

V0：

- 返回 3 条 Insight；
- 被最近的星巴克主题带偏；
- 重复 UI 记录被解释为反复完成任务；
- 加入任务复杂度和接受进度差异等推断。

V1：

- 只返回 1 条 Insight；
- 明确返回 `supports`；
- 正确连接当前 Validation/UI 修复与历史 UI 开发；
- 没有讨论无关的星巴克环境；
- 没有人格、事业或未知因果推断。

结论：

Grounding 合同修复了主题偏离，并让模型围绕当前开发阶段生成 Insight。

### Current Evidence 负向验证

为了验证应用层不会信任模型返回的 Current Evidence，Mock 临时返回：

```text
reflectionId = invalid-current-id
```

Validator 结果：

```text
status = insufficient_evidence
insights = []
removedEvidenceCount = 1
```

恢复正确 ID 后：

```text
status = insights_found
removedEvidenceCount = 0
```

结论：伪造的 Current Reflection ID 不能静默进入 API 或 UI。

### Supports / Contradicts 验证

#### Supports

当前与历史都描述 Evidence-backed Reflection、Validation 和 UI 的持续开发。

结果：

```text
relationship = supports
Grounded = PASS
Evidence Valid = PASS
```

#### Contradicts

当前描述 Grounding 测试未通过，历史描述完成了计划测试。

结果：

```text
relationship = contradicts
Grounded = PASS
Evidence Valid = PASS
```

### UI 验证

UI 现在能够显示：

- 当前记录支持历史模式；
- 当前记录反驳历史模式；
- Current Reflection excerpt；
- Historical Evidence excerpts；
- Current Reflection ID；
- Historical Reflection ID 和日期；
- Current 与 Historical Evidence 的独立数量。

Current Evidence 使用蓝色，Historical Evidence 使用绿色，使用户能够直接审计 Grounding 关系。

### Grounding Contract V1 结论

Grounding Contract 是一次高杠杆改进。

它同时改善了 Case 2、Case 3、Case 4 和 Case 5，并减少了 Case 1 中无关的额外 Pattern。

最明显的改善包括：

1. 模型不再只总结历史记录；
2. 没有相关 Evidence 时能够返回 `insufficient_evidence`；
3. Current Evidence 成为每个 Insight 的强制组成部分；
4. 模型能够明确区分 `supports` 和 `contradicts`；
5. Current Evidence ID 和 excerpt 经过应用验证；
6. UI 可以直接展示并审计 Grounding 关系；
7. Insight 数量更少，但相关性和实用性更高。

### 剩余失败模式

唯一仍未通过的原始 Case 是 Case 1。

剩余根因不是 Current Reflection Anchoring，而是：

```text
内容相同但 ID 不同的数据库记录
被错误地视为多个独立现实事件
```

这属于 Evidence Independence / Duplicate Evidence 问题。

当前系统仍然只能确认：

- Evidence ID 真实；
- excerpt 来自原文；
- Current 与 Historical Evidence 主题相关。

它仍然不能确认：

- 多条 Evidence 是否代表不同现实事件；
- 重复内容是否应该增加 Pattern 强度；
- Confidence 是否被重复数据虚增。

### 更新后的 Definition of Done

- [x] 可以输入并保存真实 Reflection
- [x] 可以检索历史 Reflection
- [x] LLM 返回结构化 Insight
- [x] Insight 可以显示真实历史 Evidence
- [x] Current Evidence 是结构化输出的一部分
- [x] Current Evidence ID 和 excerpt 经过应用验证
- [x] 非法 Current 或 Historical Evidence 不能静默进入 UI
- [x] UI 显示 Current 与 Historical Evidence
- [x] UI 显示 `supports` / `contradicts`
- [x] 没有相关 Evidence 时能返回 `insufficient_evidence`
- [x] 已执行 5 个 V0 Case
- [x] 已重新执行 5 个 Grounding Contract Regression Case
- [ ] 重复内容不会虚增模式强度
- [ ] Confidence 能反映独立 Evidence 数量

### 下一优先级

下一项最值得解决的问题是：

```text
在 Retrieval 边界对完全相同的 Reflection 内容进行去重
```

暂时不需要增加 embeddings 或向量数据库。

首先处理完全相同的内容，就能直接解决当前唯一剩余失败的 Case 1，并防止重复保存的数据虚增 Pattern 和 Confidence。
