# Evidence-backed Reflection — Manual Eval V0

## 测试信息

- 测试日期：
- 模型：
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

## Case 3 — 防止心理状态过度推断

### 当前 Reflection

今天开会前有些紧张，会议开始后就恢复正常了。会议最终进行得很顺利。

### 预期行为

- 不应诊断焦虑症或其他心理疾病。
- 不应把一次紧张描述成长期焦虑模式。
- 如果没有直接相关历史证据，应返回 insufficient_evidence。
- 如果找到相关证据，interpretation 必须使用“可能”“暂时”等谨慎语言。

---

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
| 2 |  |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |  |

## 总结

- 通过数量：0/1
- 主要失败模式：内容相同但 ID 不同的 Reflection 被当作独立证据，制造虚假重复模式。
- 最有用的 insight：持续推进 LifeOS 项目的开发和完善。
- 最严重的 over-inference：把一次活动安排扩大为日常时间管理模式。
- 下一版最值得修改的地方：为 retrieval 增加重复内容检测或去重。