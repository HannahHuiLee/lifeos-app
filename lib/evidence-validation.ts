import type {
  EvidenceBackedReflectionAnalysis,
  HistoricalEvidence,
} from '@/lib/reflection-analysis';
import type { RetrievedReflection } from '@/lib/reflection-retrieval';


// 成功生成了结构化结果 第二个 insight 却把同一个 ID 放进了 evidence：
// 它不在 retrieval.reflectionIds 中。即使 prompt 明确禁止，模型仍然违反了规则。这正是 Step 4 不能信任 LLM、必须由应用代码验证证据的真实案例。

// 这次任务会修改两个文件，但只完成一个目标：确保 Route 永远不会返回未通过验证的证据。
// 1. 新建验证器
export type EvidenceValidationResult = {
  analysis: EvidenceBackedReflectionAnalysis;
  removedEvidenceCount: number;
};

export function validateAnalysisEvidence(
  analysis: EvidenceBackedReflectionAnalysis,
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

      // 如果一个 insight 的所有证据都无效，
      // 整个 insight 也不能继续返回。
      if (validatedEvidence.length === 0) {
        return [];
      }

      return [
        {
          ...insight,
          evidence: validatedEvidence,
        },
      ];
    });

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

  return {
    analysis: {
      status: 'insights_found',
      insights: validatedInsights,
      insufficientEvidenceReason: null,
    },
    removedEvidenceCount,
  };
}