import { z } from 'zod';

const DetailedUpgradeSchema = z.strictObject({
    items: z.array(z.strictObject({
        original: z.string().trim().min(1).max(500),
        improved: z.string().trim().min(1).max(700),
        reason: z.string().trim().min(1).max(160).nullable(),
    })).min(1).max(4),
    upgradedAnswer: z.string().trim().min(1).max(7_000).nullable(),
});

const GrammarNotesSchema = z.array(z.strictObject({
    original: z.string().trim().min(1).max(500),
    corrected: z.string().trim().min(1).max(500),
    explanation: z.string().trim().min(1).max(200),
    example: z.string().trim().min(1).max(200).nullable(),
})).max(2);

const ReusablePatternsSchema = z.array(z.string().trim().min(1).max(160)).max(3);

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

    // 旧记录没有 comparison；新生成的分析必须提供。
    comparison: z.strictObject({
        doneWell: z.array(z.string().trim().min(1).max(500)).max(2).optional(),
        usefulUpgrade: z.union([DetailedUpgradeSchema, z.strictObject({
            learnerWording: z.string().trim().min(1).max(500),
            suggestion: z.string().trim().min(1).max(500),
        })]).nullable(),
    }).optional(),

    reusablePatterns: ReusablePatternsSchema.optional(),
    grammarNotes: GrammarNotesSchema.optional(),

    suggestedSummary: z.string().trim().min(1).max(2_000),
});

export type ReadingAnalysis = z.infer<
    typeof ReadingAnalysisSchema
>;

// 生成只使用新结构；读取兼容两种历史结构，不自动补写反馈。
export const ReadingGenerationSchema = ReadingAnalysisSchema.extend({
    reusablePatterns: ReusablePatternsSchema,
    grammarNotes: GrammarNotesSchema,
    missedKeyPoints: ReadingAnalysisSchema.shape.missedKeyPoints.max(2),
    corrections: ReadingAnalysisSchema.shape.corrections.max(2),
    comparison: z.strictObject({
        usefulUpgrade: DetailedUpgradeSchema.extend({
            items: DetailedUpgradeSchema.shape.items.max(3),
        }).nullable(),
    }),
});
