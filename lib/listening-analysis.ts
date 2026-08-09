import { z } from 'zod';

// 同时用于：
// 1. 约束 AI 的结构化输出
// 2. 校验数据库中保存的 JSON
// 3. 为前端提供 TypeScript 类型
export const ListeningAnalysisSchema = z.object({
  understandingScore: z.number().int().min(0).max(100),

  mainIdea: z.object({
    captured: z.boolean(),
    feedback: z.string(),
  }),

  keyInformation: z.object({
    who: z.boolean(),
    whatHappened: z.boolean(),
    why: z.boolean(),
    whatsNext: z.boolean(),
  }),

  missedKeyInformation: z.array(z.string()),

  suggestedSummary: z.string(),

  improvements: z.array(z.string()).min(1).max(2),
});

export type ListeningAnalysis = z.infer<
  typeof ListeningAnalysisSchema
>;