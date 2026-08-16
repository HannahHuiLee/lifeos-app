import { z } from 'zod';


//这个 schema 同时承担两个职责：1.约束 LLM 输出格式；2.为前端提供 TypeScript 类型。

export const ReflectionAnalysisSchema = z.object({
  summary: z.string(),

  emotions: z.array(
    z.object({
      name: z.string(),
      intensity: z.number().int().min(1).max(10),
      evidence: z.string(),
    })
  ),

  wins: z.array(z.string()),
  challenges: z.array(z.string()),
  insights: z.array(z.string()),

  nextActions: z.array(
    z.object({
      action: z.string(),
      reason: z.string(),
    })
  ),

  reflectionQuestion: z.string(),
});

export type ReflectionAnalysis = z.infer<
  typeof ReflectionAnalysisSchema
>;

export const RecentPatternsSchema = z.object({
  recurringThemes: z.array(z.string()),
  positivePattern: z.string(),
  challenge: z.string(),
  recommendations: z.array(z.string()),
});

export type RecentPatterns = z.infer<
  typeof RecentPatternsSchema
>;

//当前 Reflection 中哪段内容支持 Insight？
// 当前内容与历史 Evidence 是支持关系还是矛盾关系？
export const CurrentEvidenceSchema = z.object({
  reflectionId: z.string(),
  excerpt: z.string(),
});

export type CurrentEvidence = z.infer<
  typeof CurrentEvidenceSchema
>;

export const HistoricalEvidenceSchema = z.object({
  reflectionId: z.string(),
  excerpt: z.string(),
});

export type HistoricalEvidence = z.infer<
  typeof HistoricalEvidenceSchema
>;

//重要设计决定：当前 Evidence 和历史 Evidence 分开，避免语义混淆。两者都包含 reflectionId，以后应用代码可以验证 ID。
//excerpt 必须是原文，后续可以像历史 Evidence 一样做确定性验证。
//暂时保留历史字段名 evidence，避免本轮同时修改 UI。
//不加入 mixed。一个 Insight 应表达一个清晰关系；复杂情况应拆成不同 Insight。

// pattern：观察到了什么重复现象。
// interpretation：这个现象可能意味着什么。
// currentEvidence：当前 Reflection 中支持该 Insight 的原文。
// evidence：用于对照的历史 Reflection。
// relationship：当前内容是支持还是反驳历史模式
export const EvidenceBackedInsightSchema = z.object({
  pattern: z.string(),

  interpretation: z.string(),

  currentEvidence: CurrentEvidenceSchema,

  evidence: z
    .array(HistoricalEvidenceSchema)
    .min(1)
    .max(3),

  relationship: z.enum([
    'supports', // 当前内容延续或支持历史模式；
    'contradicts', //当前内容与历史模式形成反例。
  ]),

  confidence: z.enum([
    'low',
    'medium',
    'high',
  ]),
});


export type EvidenceBackedInsight = z.infer<
  typeof EvidenceBackedInsightSchema
>;

export const EvidenceBackedReflectionAnalysisSchema = z.object({
  status: z.enum([
    'insights_found',
    'insufficient_evidence',
  ]),

  insights: z
    .array(EvidenceBackedInsightSchema)
    .max(3),

  insufficientEvidenceReason: z.string().nullable(),
});

export type EvidenceBackedReflectionAnalysis = z.infer<
  typeof EvidenceBackedReflectionAnalysisSchema
>;