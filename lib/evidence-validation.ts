import type {
    EvidenceBackedInsight,
    EvidenceBackedReflectionAnalysis,
    HistoricalEvidence,
} from '@/lib/reflection-analysis';

import type { RetrievedReflection } from '@/lib/reflection-retrieval';


type CurrentReflectionSource = {
    id: string;
    content: string;
};

function capConfidenceByEvidenceCount(
    confidence: EvidenceBackedInsight['confidence'],
    independentEvidenceCount: number
): EvidenceBackedInsight['confidence'] {
    if (independentEvidenceCount === 1) {
        return 'low';
    }

    if (
        independentEvidenceCount === 2 &&
        confidence === 'high'
    ) {
        return 'medium';
    }

    return confidence;
}


// 成功生成了结构化结果 第二个 insight 却把同一个 ID 放进了 evidence：
// 它不在 retrieval.reflectionIds 中。即使 prompt 明确禁止，模型仍然违反了规则。这正是 Step 4 不能信任 LLM、必须由应用代码验证证据的真实案例。

// 这次任务会修改两个文件，但只完成一个目标：确保 Route 永远不会返回未通过验证的证据。
// 1. 新建验证器
export type EvidenceValidationResult = {
    analysis: EvidenceBackedReflectionAnalysis;
    removedEvidenceCount: number;
};

//当前 Reflection 和历史 Reflection 是两类不同的证据来源； 
// currentReflection 只能匹配一个确定的 ID；retrievedReflections 是历史 Evidence 的 allowlist；
// Validator 不需要完整 Prisma 对象，只需要 id 和 content。
export function validateAnalysisEvidence(
    analysis: EvidenceBackedReflectionAnalysis,
    currentReflection: CurrentReflectionSource,
    retrievedReflections: RetrievedReflection[]
): EvidenceValidationResult {
    // 如果模型已经判断证据不足，就不接受它同时返回的 insights。
    if (analysis.status === 'insufficient_evidence') {
        const ignoredEvidenceCount =
            analysis.insights.reduce(
                (count, insight) =>
                    count + insight.evidence.length,
                0
            );

        return {
            analysis: {
                status: 'insufficient_evidence',
                insights: [],
                insufficientEvidenceReason:
                    analysis.insufficientEvidenceReason?.trim() ||
                    '没有足够的历史证据支持可靠洞察。',
            },
            removedEvidenceCount: ignoredEvidenceCount,
        };
    }

    const reflectionsById = new Map(
        retrievedReflections.map((reflection) => [
            reflection.id,
            reflection,
        ])
    );

    let removedEvidenceCount = 0;


    const validatedInsights =
        analysis.insights.flatMap((insight) => {
            const currentExcerpt =
                insight.currentEvidence.excerpt.trim();

            const hasValidCurrentReflectionId =
                insight.currentEvidence.reflectionId ===
                currentReflection.id;

            const currentExcerptExistsInSource =
                currentExcerpt.length > 0 &&
                currentReflection.content.includes(
                    currentExcerpt
                );

            if (
                !hasValidCurrentReflectionId ||
                !currentExcerptExistsInSource
            ) {
                removedEvidenceCount += 1;
                return [];
            }

            const validatedEvidence =
                insight.evidence.flatMap(
                    (evidence): HistoricalEvidence[] => {
                        const sourceReflection =
                            reflectionsById.get(
                                evidence.reflectionId
                            );

                        const excerpt =
                            evidence.excerpt.trim();

                        const hasValidReflectionId =
                            sourceReflection !== undefined;

                        const excerptExistsInSource =
                            sourceReflection?.content.includes(
                                excerpt
                            ) === true;

                        if (
                            !hasValidReflectionId ||
                            excerpt.length === 0 ||
                            !excerptExistsInSource
                        ) {
                            removedEvidenceCount += 1;
                            return [];
                        }

                        return [
                            {
                                reflectionId:
                                    evidence.reflectionId,
                                excerpt,
                            },
                        ];
                    }
                );

            if (validatedEvidence.length === 0) {
                return [];
            }

            const independentEvidenceCount = new Set(
                validatedEvidence.map(
                    (evidence) => evidence.reflectionId
                )
            ).size;

            return [
                {
                    ...insight,
                    confidence: capConfidenceByEvidenceCount(
                        insight.confidence,
                        independentEvidenceCount
                    ),
                    currentEvidence: {
                        reflectionId: currentReflection.id,
                        excerpt: currentExcerpt,
                    },

                    evidence: validatedEvidence,
                },
            ];
        });

    // 如果所有 Insight 都因为当前证据或历史证据无效而被删除，
    // 整个分析结果必须降级为证据不足。
    if (validatedInsights.length === 0) {
        return {
            analysis: {
                status: 'insufficient_evidence',
                insights: [],
                insufficientEvidenceReason:
                    '模型返回的证据未通过应用验证。',
            },
            removedEvidenceCount,
        };
    }

    // 至少一个 Insight 的当前证据和历史证据都通过验证。
    return {
        analysis: {
            status: 'insights_found',
            insights: validatedInsights,
            insufficientEvidenceReason: null,
        },
        removedEvidenceCount,
    };
}