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

//

export const HistoricalEvidenceSchema = z.object({
  reflectionId: z.string(),
  excerpt: z.string(),
});

export type HistoricalEvidence = z.infer<
  typeof HistoricalEvidenceSchema
>;

// pattern : 观察到了什么重复现象 ; interpretation : 这个现象可能意味着什么。 ; evidence : 这个判断依据了哪些历史记录。
export const EvidenceBackedInsightSchema = z.object({
  pattern: z.string(),
  interpretation: z.string(),
  evidence: z
    .array(HistoricalEvidenceSchema)
    .min(1)
    .max(3),

  confidence: z.enum(['low', 'medium', 'high']),
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