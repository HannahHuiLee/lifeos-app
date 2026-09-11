import { z } from 'zod';

// 同时用于校验分析结果、读取保存的 JSON，以及推导前端类型。
export const ReadingAnalysisSchema = z.strictObject({
    mainIdea: z.strictObject({
        captured: z.boolean(),
        feedback: z.string().trim().min(1).max(1_000),
    }),

    // 只列出当前文本单元中重要、但用户总结遗漏的信息。
    // 没有重要遗漏时返回空数组。
    missedKeyPoints: z.array(
        z.string().trim().min(1).max(500)
    ).max(3),

    // 用户答案中需要纠正的理解错误，没有错误时返回空数组。
    corrections: z.array(
        z.strictObject({
            learnerClaim: z.string().trim().min(1).max(500),
            correction: z.string().trim().min(1).max(1_000),
        })
    ).max(3),

    suggestedSummary: z.string().trim().min(1).max(2_000),
});

export type ReadingAnalysis = z.infer<
    typeof ReadingAnalysisSchema
>;