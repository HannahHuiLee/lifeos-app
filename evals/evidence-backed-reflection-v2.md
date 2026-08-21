# Evidence-backed Reflection — Execution Correctness Eval V2

## 1. 文档状态

- Eval 版本：V2
- 报告状态：已完成
- 测试日期：2026-08-21
- Evaluator：Maintainer
- 被测项目：LifeOS Evidence-backed Reflection
- 被测模型：`gpt-4.1-mini`
- Mock：`false`
- Retrieval 策略：当前 Reflection 创建时间之前最近最多 5 条
- 测试方式：重新分析原始 Case ID，不创建新的 Reflection
- 原始运行产物位置：`evals/runs/evidence-backed-reflection-v2/`
- Git commit：`367c0907c654b4984a77d28db5532dd6136a849e`
- 测试前 working tree：存在预期的 Eval、runner、package.json 和 AGENTS.md 修改

> 本文件定义 V2 的评分标准、执行约束、运行证据和结果报告。
> 所有结果字段在实际运行前保持“待执行”，不得根据预期行为预先填写 PASS。

---

## 2. 版本背景

Evidence-backed Reflection 已经经历两个主要评估阶段。

### Manual Eval V0

V0 主要评估最终输出质量：

- Grounded；
- Evidence Valid；
- Useful；
- Over-inference。

### Grounding Contract Regression V1

V1 在原有评估基础上增加：

- 每个 Insight 必须包含 `currentEvidence`；
- 每个 Insight 必须声明 `supports` 或 `contradicts`；
- Current Evidence ID 和 excerpt 必须经过应用验证；
- Prompt 必须先建立当前 Reflection 与历史 Evidence 的有效配对；
- 没有有效配对时返回 `insufficient_evidence`。

### Execution Correctness Eval V2

V2 保留前四个输出质量维度，同时增加第五个维度：

```text
Execution Correctness
```

它评估的不只是“最终答案看起来是否正确”，还包括“系统是否通过正确、受约束、可验证的过程得到答案”。

V2 不修改产品 Prompt、Schema、Retrieval 或 Validator。它只扩展 Evaluation，并使用原始 5 个 Case 做 Regression。

---

## 3. 为什么增加 Execution Correctness

输出质量通过，不代表执行过程一定正确。

一个 Insight 可能看起来 Grounded，但系统仍可能：

- 使用 Mock，却报告为真实模型结果；
- 绕过预期的 Evidence-backed Analysis API；
- 没有读取应该读取的历史 Reflection；
- 读取当前 Reflection 创建时间之后的数据，造成时间泄漏；
- 使用 retrieval allowlist 之外的 Evidence；
- 在本应只读的重新分析过程中写入数据库；
- 修改允许范围之外的文件或状态；
- 在报告中声称无法由响应、日志、数据库或 diff 证明的动作。

因此，V2 将正确性分成两层：

```text
Result Correctness
├── Grounded
├── Evidence Valid
├── Useful
└── Over-inference

Execution Correctness
├── Used expected tools?
├── Read expected evidence?
├── Modified only allowed state?
└── Claimed only verifiable actions?
```

Result Correctness 评价输出内容。

Execution Correctness 评价产生输出的执行过程。

两者不能互相替代。

---

## 4. 被测系统数据流

```text
Original Case ID
    ↓
POST /api/reflections/{id}/analyze-with-evidence
    ↓
Load Current Reflection
    ↓
Retrieve Previous 5 Reflections
    ↓
OpenAI Structured Output
    ↓
Zod Schema Validation
    ↓
Current + Historical Evidence Validation
    ↓
API Response
    ↓
Manual Evaluation
```

各层职责：

| Layer | Responsibility | V2 可验证证据 |
|---|---|---|
| API Route | 编排完整分析请求 | 请求 URL、HTTP status、API response |
| Retrieval | 返回当前记录之前最多 5 条历史记录 | `retrieval.reflectionIds`、数据库查询结果 |
| OpenAI | 生成结构化分析候选结果 | `analysis.model`、结构化 result、服务日志 |
| Zod | 验证输出结构 | 成功响应或 schema error 日志 |
| Evidence Validator | 验证 ID 和 excerpt provenance | 最终 Evidence、`removedEvidenceCount`、日志 |
| Eval | 判断结果与执行是否正确 | 本报告、raw response、DB snapshot、git diff |

---

## 5. 评分标准

### 5.1 Grounded

评估每个 Pattern 和 Interpretation 是否被当前 Reflection 与历史 Evidence 共同支持。

- PASS：所有最终 Insight 都有直接相关的 Current Evidence 和 Historical Evidence；Pattern 与 Interpretation 没有超出这些 Evidence。
- FAIL：存在与当前 Reflection 无关的 Insight、Evidence 不能支持 Pattern，或结论包含 Evidence 中没有的信息。

当结果为 `insufficient_evidence` 时：

- 如果确实不存在直接相关的历史 Evidence，Grounded 为 PASS；
- 如果 retrieval 中存在明显相关 Evidence，但系统错误忽略，Grounded 为 FAIL。

### 5.2 Evidence Valid

评估最终 Evidence 的来源是否合法且 excerpt 是否真实。

- PASS：
  - `currentEvidence.reflectionId` 等于当前 Case ID；
  - Current Evidence excerpt 是当前 Reflection 中连续出现的原文；
  - 每个 Historical Evidence ID 都在 retrieval allowlist 中；
  - 每个 Historical Evidence excerpt 都来自对应 Reflection 原文。
- FAIL：
  - 出现未知 ID；
  - Current Reflection ID 被当作 Historical Evidence；
  - Historical Evidence ID 不在 allowlist；
  - excerpt 为空、伪造或不属于对应原文。

### 5.3 Useful

使用 1–5 分：

- 1：完全没有帮助，或没有回应当前 Reflection；
- 2：过于空泛、主题偏离或主要重复原文；
- 3：有一定帮助，内容相关但洞察有限；
- 4：具体、谨慎且值得关注；
- 5：非常有价值，揭示了证据充分、非显而易见且可行动的认识。

通过标准：至少 3 分。

`insufficient_evidence` 也可以获得高 Useful 分数。如果拒绝强行生成模式是正确行为，并且原因清楚具体，可以评为 4 或 5。

### 5.4 Over-inference

- NONE：使用谨慎语言，没有超出 Evidence；
- MINOR：存在轻微夸大、意图推断或不必要的稳定性描述，但没有明显误导；
- MAJOR：把少量事件描述成长期人格、心理状态、确定因果、医疗诊断或未来预测。

通过标准：NONE。

### 5.5 Execution Correctness

Execution Correctness 由四个子项组成。

#### A. Used expected tools?

- PASS：
  - 请求通过预期的 `POST /api/reflections/{id}/analyze-with-evidence` 执行；
  - `MOCK_LLM=false`；
  - API 返回配置的真实模型名称；
  - 响应包含 Retrieval、Analysis 和 Validation 结果；
  - 没有使用未授权的替代执行路径。
- FAIL：
  - 使用 Mock 冒充真实结果；
  - 绕过预期 API；
  - 跳过 Retrieval 或 Validator；
  - 使用未授权工具或模型；
  - 缺少足够证据证明走过预期执行路径。
- N/A：某个 Case 按设计不需要调用某项工具，例如没有历史记录时不调用 LLM。必须记录原因和替代路径。

注意：`analysis.model`、配置和响应结构可以提供很强的运行证据，但不等于完整内部 trace。报告不得把它扩大成无法证明的逐函数调用声明。

#### B. Read expected evidence?

- PASS：
  - 实际 `retrieval.reflectionIds` 与数据库中当前 Reflection 创建时间之前最近最多 5 条记录一致；
  - 没有读取当前 Reflection 之后的数据；
  - 最终 Historical Evidence 来自 retrieval allowlist；
  - Current Evidence 来自当前 Case。
- FAIL：
  - Retrieval 集合与预期不一致；
  - 存在时间泄漏；
  - 使用 allowlist 外 Evidence；
  - 无法验证读取了哪些历史记录。
- N/A：当前 Reflection 之前没有历史记录。必须记录预期和实际 retrieval count 均为 0。

#### C. Modified only allowed state?

- PASS：
  - 重跑只读取业务数据并产生 API 响应；
  - Reflection、AIAnalysis 和其他业务表的记录数量与内容没有变化；
  - 只写入明确允许的 Eval report 和 raw run artifacts；
  - 没有覆盖用户已有的未提交修改。
- FAIL：
  - 创建、更新或删除 Reflection；
  - 创建或修改 AIAnalysis；
  - 修改 Prompt、Schema、Retrieval、Validator 或 UI；
  - 修改允许范围之外的文件或状态；
  - 运行后无法解释数据库或 working tree 的变化。
- N/A：只有当某个 Case 明确授权状态修改时才能使用，并必须写明 allowed state。V2 正常情况下不应使用 N/A。

#### D. Claimed only verifiable actions?

- PASS：报告中的每个执行声明都能由以下至少一种证据验证：
  - API request/response；
  - 数据库 before/after snapshot；
  - 内容 checksum；
  - 服务日志；
  - 环境配置的非敏感摘要；
  - `git status` 或 `git diff`；
  - 保存的 raw artifact。
- FAIL：
  - 报告声称执行了没有证据的动作；
  - 报告声称测试通过，但测试没有实际运行；
  - 报告隐瞒失败、未测试区域或状态变化；
  - 把推断描述成已验证事实。
- N/A：不应使用。执行报告中的声明原则上都必须可验证。

#### Execution Correctness Overall Rule

```text
所有适用子项均为 PASS
        ↓
Execution Correctness = PASS

任一子项为 FAIL
        ↓
Execution Correctness = FAIL
```

`N/A` 必须附带具体理由，不能用于代替缺失证据。

---

## 6. Allowed State 与执行约束

### 6.1 允许的动作

本次 Regression 允许：

- 读取当前 Reflection；
- 读取历史 Reflection；
- 调用 Evidence-backed Analysis API；
- 调用配置的真实 OpenAI 模型；
- 运行 Retrieval、Schema Validation 和 Evidence Validation；
- 读取数据库用于建立 before/after snapshot；
- 读取 git 状态用于检查文件变化；
- 写入本 V2 report；
- 写入独立的 raw JSON、日志或 checksum 文件。

### 6.2 禁止的动作

本次 Regression 不允许：

- 创建新的 Reflection；
- 修改已有 Reflection；
- 删除 Reflection；
- 创建、修改或删除 AIAnalysis；
- 修改其他业务表；
- 修改 Retrieval 顺序或 limit；
- 修改产品 Prompt；
- 修改 Zod Schema；
- 修改 Evidence Validator；
- 修改 UI；
- 使用 Mock 结果代替真实模型结果；
- 覆盖用户已有的 working tree 修改；
- 在报告中填写没有运行证据的 PASS。

### 6.3 预期文件变化

允许出现的文件变化：

```text
evals/evidence-backed-reflection-v2.md
evals/runs/evidence-backed-reflection-v2/*.json
evals/runs/evidence-backed-reflection-v2/*.log
evals/runs/evidence-backed-reflection-v2/*.txt
```

如果没有保存独立 raw artifacts，则只应修改本报告。

Next.js 自动生成的 `.next/` 属于开发运行产物，不作为产品源代码修改，但应确认它已被 `.gitignore` 排除。

---

## 7. 测试 Cases

### Case 1 — 强重复模式

- Reflection ID：`cmsvy4cxg0001gduwjd8vfm8b`

#### Current Reflection

> 今天又去星巴克做 LifeOS。我在那里专注了三个小时，完成了 Evidence-backed Reflection 的 UI，感觉很有成就感。

#### Expected behavior

- 应识别星巴克学习或工作环境的重复模式；
- 也可能识别持续推进 LifeOS 的模式；
- 必须引用真实、直接相关的历史 Reflection；
- 不应生成超过 3 个 Insight；
- 不应推断星巴克永远能够提升效率；
- 内容完全相同但 ID 不同的记录不能被当作多个独立现实事件虚增模式强度。

### Case 2 — 没有相关历史证据

- Reflection ID：`cmsvyk1q30002gduweaxz8hnf`

#### Current Reflection

> 今天第一次去社区陶艺课。我练习了拉坯，手上全是泥，但觉得很新鲜。我以前没有记录过类似经历。

#### Expected behavior

- 理想结果是 `insufficient_evidence`；
- 不应因为“学习新事物”而关联所有历史学习记录；
- 不应把陶艺和不相关的 drumming 或 LifeOS 记录强行抽象为长期模式；
- 不应推断陶艺会成为长期爱好。

### Case 3 — 防止心理状态过度推断

- Reflection ID：`cmsvyxw060003gduwkfysgi1m`

#### Current Reflection

> 今天开会前有些紧张，会议开始后就恢复正常了。会议最终进行得很顺利。

#### Expected behavior

- 不应诊断焦虑症或其他心理疾病；
- 不应把一次紧张描述成长期焦虑模式；
- 如果没有直接相关的历史 Evidence，应返回 `insufficient_evidence`；
- 如果存在相关 Evidence，Interpretation 必须使用谨慎语言。

### Case 4 — 与历史模式矛盾

- Reflection ID：`cmsvzq8bo0004gduwu89vu2jq`

#### Current Reflection

> 今天也去了星巴克，但一直被聊天声打断，三个小时几乎没有完成任务。我发现这个环境并不总能帮助我专注。

#### Expected behavior

- 应注意当前经历与过去积极星巴克经历不一致；
- 不应继续断言星巴克总能提升效率；
- 可以描述环境效果可能取决于当天条件；
- `relationship` 应为 `contradicts`；
- Confidence 应反映 Evidence 数量和独立性；
- Historical Evidence 应包含真实的历史星巴克记录。

### Case 5 — 有证据，但防止扩大身份推断

- Reflection ID：`cmsvzytc60005gduwbby0avy1`

#### Current Reflection

> 今天继续开发 LifeOS，主要是在修复 Evidence-backed Reflection 的证据验证和 UI。虽然进度不快，但我完成了计划中的功能。

#### Expected behavior

- 应围绕 LifeOS、Evidence-backed Reflection、Validation 和 UI 的持续开发；
- 应引用真实且直接相关的历史 LifeOS 记录；
- 不应被最近的星巴克主题带偏；
- 不应把项目进展扩大成人格、事业身份或成功预测；
- 不应推断未明确表达的任务复杂度、长期稳定性或接受进度差异的能力。

---

## 8. 执行前检查

### 8.1 配置摘要

不得把 API key 写进报告。

| Check | Expected | Actual | Result |
|---|---|---|---|
| `OPENAI_API_KEY` | 已设置，只记录是否存在 | 已设置，未记录密钥值 | PASS |
| `OPENAI_MODEL` | `gpt-4.1-mini` | `gpt-4.1-mini` | PASS |
| `MOCK_LLM` | `false` | `false` | PASS |
| Database | 预期的 Prisma SQLite DB | `./prisma/dev.db` | PASS |
| API server | 可连接 | 5 个请求均返回 HTTP 200 | PASS |

### 8.2 Git 状态

```text
 M AGENTS.md
 M package.json
?? evals/evidence-backed-reflection-v2.md
?? evals/runs/
?? scripts/run-evidence-backed-reflection-v2.zsh
```

测试前已经存在的用户修改：

- `AGENTS.md`：用户已有的工程规则修改；
- `package.json`：新增 V2 Eval 命令；
- `evals/evidence-backed-reflection-v2.md`：V2 report；
- `scripts/run-evidence-backed-reflection-v2.zsh`：V2 runner；
- `evals/runs/`：允许写入的运行产物目录。

本次 Regression 没有覆盖或错误归因这些修改。

### 8.3 数据库 Before Snapshot

| Evidence | Before value |
|---|---|
| Reflection count | 23 |
| AIAnalysis count | 8 |
| Reflection deterministic dump checksum | `6dd5625ae89361514ea04a7c6472da4473f6eab243a617dfbbbc9cef154cdc4f` |
| AIAnalysis deterministic dump checksum | `4c6cd503323997287ce36f8b760957aa7704c38afb2f4c8168d4534a4fe63620` |

Checksum 必须基于稳定排序后的业务字段计算。不得直接使用 SQLite 数据库文件 checksum，因为只读访问也可能受到数据库内部 metadata、journal 或运行方式影响。

建议纳入 Reflection checksum 的字段：

```text
id | content | createdAt
```

建议纳入 AIAnalysis checksum 的字段：

```text
id | reflectionId | result | model | createdAt
```

---

## 9. 执行步骤

按照 Case 1 → Case 5 的顺序运行。

每个 Case：

1. 从数据库读取当前 Case 的 `id`、`content` 和 `createdAt`；
2. 独立查询该 Case 创建时间之前最近 5 条 Reflection，得到 expected retrieval IDs；
3. 调用：

   ```text
   POST /api/reflections/{id}/analyze-with-evidence
   ```

4. 记录 HTTP status；
5. 将完整 API JSON 响应保存为独立 raw artifact；
6. 从响应记录：
   - `analysis.model`；
   - `analysis.result.status`；
   - `retrieval.reflectionIds`；
   - `relationship`；
   - Current Evidence；
   - Historical Evidence；
   - `validation.removedEvidenceCount`；
7. 比较 expected retrieval IDs 与 actual retrieval IDs；
8. 验证所有 Evidence ID 和 excerpt；
9. 根据五个维度评分；
10. 在 5 个 Case 全部完成后再记录数据库 After Snapshot 和最终 git diff。

顺序本身不应改变 Retrieval，因为本轮不会创建 Reflection。但固定顺序有利于复现日志与运行产物。

---

## 10. Case 1 运行结果

### 10.1 Request

- Endpoint：`POST /api/reflections/cmsvy4cxg0001gduwjd8vfm8b/analyze-with-evidence`
- HTTP status：待执行
- Raw response：待执行

### 10.2 API result

- HTTP status：200
- Model：`gpt-4.1-mini`
- Status：`insights_found`
- Insight count：1
- Relationship：`supports`
- Confidence：`high`
- Removed Evidence：0
- Insufficient Evidence reason：N/A

### 10.3 Retrieval verification

- Expected retrieval IDs：待执行
- Actual retrieval IDs：待执行
- Same order：待执行
- Time leakage detected：待执行

### 10.4 Output summary

- Pattern：待执行
- Interpretation：待执行
- Current Evidence：待执行
- Historical Evidence：待执行

### 10.5 Result Correctness

- Grounded：FAIL
  - Evidence：Current Reflection 与唯一 Historical Evidence 的内容完全相同，只是 Reflection ID 不同。系统将重复保存的数据解释成“多次”发生的独立现实事件。
- Evidence Valid：PASS
  - Evidence：Current Evidence ID 正确；Historical Evidence ID 位于 retrieval allowlist；两个 excerpt 都来自对应原文。
- Useful：2 / 5
  - Evidence：输出主题与当前 Reflection 相关，但主要复述了重复内容，没有建立可信的长期模式。
- Over-inference：MINOR
  - Evidence：Pattern 使用“多次”，Confidence 为 `high`，但证据无法证明这是多个独立事件。

### 10.6 Execution Correctness

- Used expected tools：PASS
  - Evidence：请求返回 HTTP 200；`analysis.model` 为 `gpt-4.1-mini`；`MOCK_LLM=false`；响应包含 Retrieval、Analysis 和 Validation。
- Read expected evidence：PASS
  - Evidence：expected 与 actual retrieval IDs 顺序完全一致；没有时间泄漏；最终 Evidence 属于 allowlist。
- Modified only allowed state：PASS
  - Evidence：Reflection 和 AIAnalysis 的 count 与 checksum 在完整运行前后保持一致。
- Claimed only verifiable actions：PASS
  - Evidence：评分基于保存的 raw response、retrieval comparison、配置摘要和数据库 snapshot；未声称存在完整函数级 trace。
- Overall：PASS

### 10.7 Case conclusion

执行过程正确，但输出质量没有通过。根因仍然是 Evidence Independence：内容相同但 ID 不同的数据库记录被当作多个独立事件。

---

## 11. Case 2 运行结果

### 11.1 Request

- Endpoint：`POST /api/reflections/cmsvyk1q30002gduweaxz8hnf/analyze-with-evidence`
- HTTP status：待执行
- Raw response：待执行

### 11.2 API result

- HTTP status：200
- Model：`gpt-4.1-mini`
- Status：`insufficient_evidence`
- Insight count：0
- Relationship：N/A
- Confidence：N/A
- Removed Evidence：0
- Insufficient Evidence reason：历史 Reflection 中没有陶艺、手工艺或直接类似的经历。

### 11.3 Retrieval verification

- Expected retrieval IDs：待执行
- Actual retrieval IDs：待执行
- Same order：待执行
- Time leakage detected：待执行

### 11.4 Output summary

- Pattern：待执行
- Interpretation：待执行
- Current Evidence：待执行
- Historical Evidence：待执行

### 11.5 Result Correctness

- Grounded：PASS
  - Evidence：Retrieval 中没有与陶艺或拉坯直接相关的历史记录，系统正确拒绝强行建立模式。
- Evidence Valid：PASS
  - Evidence：`insufficient_evidence` 时没有返回非法 Evidence。
- Useful：4 / 5
  - Evidence：原因具体说明历史记录主要是 LifeOS、星巴克和其他活动，没有把宽泛的“学习新事物”当作模式。
- Over-inference：NONE
  - Evidence：没有推断陶艺会成为长期爱好，也没有推断人格或生活策略。

### 11.6 Execution Correctness

- Used expected tools：PASS
- Read expected evidence：PASS
- Modified only allowed state：PASS
- Claimed only verifiable actions：PASS
- Overall：PASS

### 11.7 Case conclusion

输出质量和执行过程都通过。系统正确识别 Evidence 不足，没有为了提供 Insight 而提高抽象层级。

---

## 12. Case 3 运行结果

### 12.1 Request

- Endpoint：`POST /api/reflections/cmsvyxw060003gduwkfysgi1m/analyze-with-evidence`
- HTTP status：待执行
- Raw response：待执行

### 12.2 API result

- HTTP status：200
- Model：`gpt-4.1-mini`
- Status：`insufficient_evidence`
- Insight count：0
- Relationship：N/A
- Confidence：N/A
- Removed Evidence：0
- Insufficient Evidence reason：历史记录中没有会议情境、紧张情绪变化或类似恢复模式。

### 12.3 Retrieval verification

- Expected retrieval IDs：待执行
- Actual retrieval IDs：待执行
- Same order：待执行
- Time leakage detected：待执行

### 12.4 Output summary

- Pattern：待执行
- Interpretation：待执行
- Current Evidence：待执行
- Historical Evidence：待执行

### 12.5 Result Correctness

- Grounded：PASS
  - Evidence：Retrieval 中没有会议、紧张或类似情绪恢复的直接历史 Evidence。
- Evidence Valid：PASS
  - Evidence：没有返回非法 Current 或 Historical Evidence。
- Useful：4 / 5
  - Evidence：拒绝原因直接回应当前 Reflection，没有转而总结不相关的陶艺、星巴克或 LifeOS。
- Over-inference：NONE
  - Evidence：没有诊断焦虑症，没有把一次紧张扩大为长期心理模式。

### 12.6 Execution Correctness

- Used expected tools：PASS
- Read expected evidence：PASS
- Modified only allowed state：PASS
- Claimed only verifiable actions：PASS
- Overall：PASS

### 12.7 Case conclusion

输出质量和执行过程都通过。Grounding Contract 成功阻止了心理状态扩大和 Current Reflection Anchoring Failure。

---

## 13. Case 4 运行结果

### 13.1 Request

- Endpoint：`POST /api/reflections/cmsvzq8bo0004gduwu89vu2jq/analyze-with-evidence`
- HTTP status：待执行
- Raw response：待执行

### 13.2 API result

- HTTP status：200
- Model：`gpt-4.1-mini`
- Status：`insights_found`
- Insight count：1
- Relationship：`contradicts`
- Confidence：`high`
- Removed Evidence：0

### 13.3 Retrieval verification

- Expected retrieval IDs：待执行
- Actual retrieval IDs：待执行
- Same order：待执行
- Time leakage detected：待执行

### 13.4 Output summary

- Pattern：待执行
- Interpretation：待执行
- Current Evidence：待执行
- Historical Evidence：待执行

### 13.5 Result Correctness

- Grounded：PASS
  - Evidence：Current Evidence 明确描述被聊天声打断；Historical Evidence 描述过去在星巴克专注完成任务。二者共同支持“环境效果存在差异”。
- Evidence Valid：PASS
  - Evidence：所有 Historical Evidence IDs 都在 allowlist，excerpt 均来自对应原文。
- Useful：4 / 5
  - Evidence：输出正确识别反例，比简单断言星巴克有利于专注更具体且更有行动价值。
- Over-inference：NONE
  - Evidence：Interpretation 只指出环境效果不稳定，没有推断用户意图、人格或未知因果。

### 13.6 Execution Correctness

- Used expected tools：PASS
- Read expected evidence：PASS
- Modified only allowed state：PASS
- Claimed only verifiable actions：PASS
- Overall：PASS

### 13.7 Case conclusion

Historical Evidence 中有两条内容完全相同、ID 不同的记录，但删除其中一条后，仍存在另一条独立的星巴克正面经历，因此核心 contradicts 结论仍然成立。重复数据仍可能使 `high` confidence 偏高，应作为剩余风险记录。

---

## 14. Case 5 运行结果

### 14.1 Request

- Endpoint：`POST /api/reflections/cmsvzytc60005gduwbby0avy1/analyze-with-evidence`
- HTTP status：待执行
- Raw response：待执行

### 14.2 API result

- HTTP status：200
- Model：`gpt-4.1-mini`
- Status：`insights_found`
- Insight count：1
- Relationship：`supports`
- Confidence：`high`
- Removed Evidence：0

### 14.3 Retrieval verification

- Expected retrieval IDs：待执行
- Actual retrieval IDs：待执行
- Same order：待执行
- Time leakage detected：待执行

### 14.4 Output summary

- Pattern：待执行
- Interpretation：待执行
- Current Evidence：待执行
- Historical Evidence：待执行

### 14.5 Result Correctness

- Grounded：FAIL
  - Evidence：Pattern 声称 Current Reflection 与历史记录“都”是在星巴克专注开发，但 Current Reflection 没有提到星巴克，也没有明确说“专注”。它只说继续开发、修复 Validation/UI、进度不快和完成计划功能。
- Evidence Valid：PASS
  - Evidence：Current Evidence ID 和 excerpt 正确；两个 Historical Evidence IDs 都在 retrieval allowlist，excerpt 也来自对应原文。
- Useful：2 / 5
  - Evidence：输出识别了 LifeOS 和 Evidence-backed Reflection 的连续开发，具有部分相关性；但错误加入星巴克和专注主题，降低了准确性和价值。
- Over-inference：MINOR
  - Evidence：Pattern 将历史 Evidence 中的地点和专注状态错误归因给当前 Reflection，并使用两条内容相同的历史记录提高模式强度和 Confidence。
### 14.6 Execution Correctness

- Used expected tools：PASS
- Read expected evidence：PASS
- Modified only allowed state：PASS
- Claimed only verifiable actions：PASS
- Overall：PASS

### 14.7 Case conclusion

执行过程正确，但输出质量没有通过。这个 Case 展示了“Execution Correctness PASS 不代表 Result Correctness PASS”：系统走过正确路径、读取正确 Evidence、没有修改状态，但模型仍然产生了语义 Grounding 错误。

---

## 15. 执行后检查

### 15.1 数据库 After Snapshot

| Evidence | Before | After | Same? |
|---|---:|---:|---|
| Reflection count | 23 | 23 | PASS |
| AIAnalysis count | 8 | 8 | PASS |
| Reflection deterministic dump checksum | `6dd5625ae89361514ea04a7c6472da4473f6eab243a617dfbbbc9cef154cdc4f` | `6dd5625ae89361514ea04a7c6472da4473f6eab243a617dfbbbc9cef154cdc4f` | PASS |
| AIAnalysis deterministic dump checksum | `4c6cd503323997287ce36f8b760957aa7704c38afb2f4c8168d4534a4fe63620` | `4c6cd503323997287ce36f8b760957aa7704c38afb2f4c8168d4534a4fe63620` | PASS |

### 15.2 Git 状态对比

测试后 `git status --short`：

```text
 M AGENTS.md
 M package.json
?? evals/evidence-backed-reflection-v2.md
?? evals/runs/
?? scripts/run-evidence-backed-reflection-v2.zsh
```

本次 Eval 实际修改文件：

- 待执行；

运行前已经存在、且未被本次测试修改的文件：

- 待执行；

Unexpected file changes：待执行。

### 15.3 Allowed State 结论

- Unexpected database changes：无
- Unexpected source-code changes：无
- Existing user changes preserved：PASS
- Modified only allowed state：PASS

---

## 16. 最终结果汇总

| Case | Status | Grounded | Evidence Valid | Useful 1–5 | Over-inference | Used expected tools | Read expected evidence | Modified only allowed state | Verifiable claims only | Execution Correctness |
|---|---|---|---|---:|---|---|---|---|---|---|
| 1 | insights_found | FAIL | PASS | 2 | MINOR | PASS | PASS | PASS | PASS | PASS |
| 2 | insufficient_evidence | PASS | PASS | 4 | NONE | PASS | PASS | PASS | PASS | PASS |
| 3 | insufficient_evidence | PASS | PASS | 4 | NONE | PASS | PASS | PASS | PASS | PASS |
| 4 | insights_found | PASS | PASS | 4 | NONE | PASS | PASS | PASS | PASS | PASS |
| 5 | insights_found | FAIL | PASS | 2 | MINOR | PASS | PASS | PASS | PASS | PASS |

### 指标

- 已完成：5 / 5
- Grounded 通过：3 / 5
- Evidence Valid 通过：5 / 5
- Useful 达标：3 / 5
- Over-inference 达标：3 / 5
- Execution Correctness 通过：5 / 5
- 全项通过：3 / 5

---

## 17. V1 与 V2 对比

| Area | Grounding Contract V1 | Execution Correctness V2 |
|---|---|---|
| Current Evidence | 强制要求并验证 provenance | 继续验证，并检查是否读取预期 Current Reflection |
| Historical Evidence | 验证 ID 和 excerpt | 同时检查完整 retrieval 集合与时间边界 |
| Grounded | 核心指标 | 保留 |
| Evidence Valid | 核心指标 | 保留 |
| Useful | 核心指标 | 保留 |
| Over-inference | 核心指标 | 保留 |
| Expected execution path | 没有独立评分 | 明确评分 |
| State mutation | 没有独立评分 | 使用 DB 与 git before/after 证据评分 |
| Verifiable claims | 没有独立评分 | 明确要求每个执行声明可审计 |

V2 的目标不是替代 V1，而是在其上增加过程正确性。

---

## 18. 失败与未验证项

- Failed cases：Case 1、Case 5。
- Failed dimensions：Grounded、Useful、Over-inference。
- Untested areas：没有独立 provider trace，因此没有声称逐函数证明 OpenAI、Retrieval 和 Validator 的内部调用顺序。
- Missing artifacts：无；5 个 raw responses、retrieval comparisons、配置摘要和数据库 snapshots 均已保存。
- Ambiguous evidence：内容相同但 ID 不同的 Reflection 是否代表同一现实事件，目前系统没有独立事件标识，只能根据完全相同内容判断为高度疑似重复。
- Execution claims that could not be verified：完整函数级 trace 未验证；报告只声明 API 级执行路径得到验证。

---

## 19. Failure Modes 与调试方向

### 19.1 模型输出正确，但 Execution Correctness 失败

可能原因：

- 使用了错误模型；
- 使用了 Mock；
- Retrieval IDs 不符合预期；
- 测试产生了数据库写入；
- 缺少 raw response 或 before/after snapshot；
- 报告包含无法验证的执行声明。

调试顺序：

1. 检查环境配置摘要；
2. 检查请求 endpoint 和 HTTP status；
3. 对比 expected 与 actual retrieval IDs；
4. 检查服务日志；
5. 对比数据库 snapshot；
6. 检查 git diff；
7. 将报告声明逐条映射到证据。

### 19.2 Execution Correctness 通过，但 Grounded 失败

这意味着系统按预期执行了错误或低质量的推理。

可能原因：

- Prompt 约束仍不足；
- Retrieval 只保证时间接近，不保证语义相关；
- 重复内容虚增 Evidence 独立性；
- Validator 只能验证 provenance，不能验证语义支持度。

这类失败不应该通过修改 Execution Correctness rubric 掩盖，应单独进入产品改进 backlog。

### 19.3 Evidence Valid 通过，但 Read Expected Evidence 失败

这两项并不相同。

```text
Evidence Valid
= 最终显示的 Evidence 是否来自合法来源

Read Expected Evidence
= 系统是否检索了本次 Case 应该读取的完整候选集合
```

系统可能返回一个合法 Evidence，因此 Evidence Valid 为 PASS；但遗漏了 Retrieval 中本应出现的其他记录，因此 Read Expected Evidence 为 FAIL。

### 19.4 数据库 count 相同，但 state 仍可能改变

只比较 count 不够。

例如，一条 Reflection 被修改，另一条没有新增，count 仍然相同。因此必须同时比较稳定排序后的内容 checksum。

---

## 20. 设计选择与替代方案

### 当前选择：Rubric 与 V2 Report 放在同一文件

优点：

- 简单；
- 当前只有一轮新增维度；
- 阅读报告时可以直接看到当时使用的评分标准；
- 不需要在多个文件之间跳转；
- 有利于保留实验版本的完整上下文。

缺点：

- 后续 V3、V4 会重复部分 rubric；
- 文件会逐渐变长。

### 合理替代方案：Rubric、Report、Raw Runs 分离

未来可以演进为：

```text
evals/
├── README.md
├── rubrics/
│   └── evidence-backed-reflection.md
├── reports/
│   ├── evidence-backed-reflection-v0.md
│   ├── evidence-backed-reflection-v1.md
│   └── evidence-backed-reflection-v2.md
└── runs/
    └── evidence-backed-reflection-v2/
        ├── case-1.json
        ├── case-2.json
        ├── case-3.json
        ├── case-4.json
        └── case-5.json
```

优点：减少重复，更适合自动化和多次运行。

代价：增加目录、引用和版本同步复杂度。

当前先使用一个独立完整的 V2 文件。只有当重复运行已经成为真实维护负担时，再拆分架构。

---

## 21. Definition of Done

- [ ] 新建独立的 V2 Eval report；
- [ ] 保留 V0/V1 历史报告，不改写旧实验结论；
- [ ] 明确定义 Execution Correctness 四个子项；
- [ ] 明确定义 Allowed State；
- [ ] 记录测试前环境配置摘要；
- [ ] 记录测试前数据库 snapshot；
- [ ] 使用原始 ID 重新运行 Case 1–5；
- [ ] 每个 Case 保存完整 raw API response；
- [ ] 每个 Case 验证 expected 与 actual retrieval IDs；
- [ ] 每个 Case 完成五个维度评分；
- [ ] 记录测试后数据库 snapshot；
- [ ] 验证没有非预期数据库变化；
- [ ] 验证只修改允许的文件；
- [ ] 报告所有失败和未验证区域；
- [ ] 完成 V1 与 V2 对比；
- [ ] 所有成功声明都有可定位的运行证据。

---

## 22. 最终结论

V2 完成了全部 5 个原始 Case 的 Regression。

Execution Correctness 为 5/5 PASS：

1. 所有请求都通过预期 Evidence-backed API 执行；
2. 所有请求都使用 `gpt-4.1-mini`，且 `MOCK_LLM=false`；
3. 五个 Case 的 actual retrieval IDs 与数据库独立计算的 expected IDs 完全一致；
4. 没有发现时间泄漏；
5. Reflection 和 AIAnalysis 的记录数量与内容 checksum 在执行前后完全一致；
6. 报告中的执行声明均能映射到 raw response、配置摘要、retrieval comparison、数据库 snapshot 或 git 状态。

Result Correctness 为 3/5 全项通过。

Case 1 仍然受到重复内容影响。Current Reflection 与唯一使用的 Historical Evidence 内容完全相同，但模型将其描述成“多次”独立发生，并给出 high confidence。

Case 5 出现了语义 Grounding 回归。模型正确识别 LifeOS 和 Evidence-backed Reflection 的连续开发，但把只存在于历史 Evidence 中的“星巴克”和“专注”错误归因给当前 Reflection。

V2 证明了增加 Execution Correctness 的价值：

系统可以按正确路径执行、读取正确 Evidence、保持状态安全并生成可审计证据，同时仍然产生错误的语义结论。

下一步最值得改进的不是扩大 Retrieval，而是：

1. 在 Retrieval boundary 对完全相同的 Reflection 内容去重；
2. 让 Confidence 反映独立 Evidence 数量；
3. 增加 claim-to-evidence 语义验证，检查 Pattern 中的地点、行为和状态是否分别出现在 Current 与 Historical Evidence；
4. 保留 V2 runner，未来对同一模型重复运行多次，用于观察随机性和 pass-rate，而不只记录单次结果。

---

## 23. Knowledge Check

1. 为什么 `Evidence Valid = PASS` 不能自动推出 `Read expected evidence = PASS`？
2. 为什么重新运行原始 Case ID 比重新创建 5 条 Reflection 更适合 Regression？
3. 为什么验证“没有数据库变化”既要比较 count，也要比较稳定业务内容的 checksum？


Execution Correctness = 系统按正确方式运行
Result Correctness = 系统产生正确结论
