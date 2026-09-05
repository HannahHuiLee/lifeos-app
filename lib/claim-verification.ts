import { z } from 'zod';

import type {
    EvidenceBackedInsight,
} from '@/lib/reflection-analysis';

const EvidenceReferenceSchema = z.object({
    source: z.enum(['current', 'historical']),
    reflectionId: z.string().min(1),
});

const EvidenceSourceSchema =
    EvidenceReferenceSchema.extend({
        excerpt: z.string().min(1),
    });

// claimId：一个稳定标识，让 verifier 结果能映射回原 claim，例如 insight-0-pattern。
// insightIndex：指出 claim 来自第几个 Insight，Route/UI 后续可正确关联结果。
// kind：区分观察性 pattern 和解释性 interpretation。二者可能有不同结论，例如 Pattern 正确但 Interpretation 加入了无证据因果关系。
// claim：实际接受语义验证的文字。
// relationship：Verifier 必须知道当前 Insight 声称的是共同支持，还是相互矛盾。
// source：保留 Current/Historical 边界。Case 5 正是因为 Historical-only 属性被错误说成双方共有。
// reflectionId：保留 claim 到真实来源的可审计关联。
// evidenceRefs：记录 claim 声称引用了哪些来源。
// VerifyClaimInput.evidence：提供相同来源的真实 excerpt；未来 Verifier 不需要读取其他 Reflection。
// supported：所有实质属性和关系都有支持。
// partial：核心结论成立，但存在无证据修饰词或附加细节。
// unsupported：核心共同模式或矛盾关系本身不成立。
// reason：用于调试和人工评测，不应被当作新的用户 Insight。
export const ClaimEvidenceSchema = z.object({
    claimId: z.string().min(1),
    insightIndex: z.number().int().nonnegative(),
    kind: z.enum(['pattern', 'interpretation']),
    scope: z
        .enum([
            'shared',
            'source-specific',
        ])
        .optional(),
    claim: z.string().min(1),
    relationship: z.enum([
        'supports',
        'contradicts',
    ]),
    evidenceRefs: z
        .array(EvidenceReferenceSchema)
        .min(1),
});

export type ClaimEvidence = z.infer<
    typeof ClaimEvidenceSchema
>;

export const VerifyClaimInputSchema = z.object({
    claim: ClaimEvidenceSchema,
    evidence: z
        .array(EvidenceSourceSchema)
        .min(1),
});

export type VerifyClaimInput = z.infer<
    typeof VerifyClaimInputSchema
>;


export type HistoricalCardinalityViolation = {
    failureType: 'quantity/cardinality';
    matchedTerm: string;
    historicalSourceCount: number;
    requiredHistoricalSourceCount: 2;
};

const HISTORICAL_CARDINALITY_RULES = [
    {
        term: '多次',
        pattern:
            /(?:历史[^。！？.!?\n]{0,40}多次|多次[^。！？.!?\n]{0,40}历史)/u,
    },
    {
        term: '多条',
        pattern:
            /(?:历史[^。！？.!?\n]{0,40}多条|多条[^。！？.!?\n]{0,40}历史)/u,
    },
    {
        term: '反复',
        pattern:
            /(?:历史[^。！？.!?\n]{0,40}反复|反复[^。！？.!?\n]{0,40}历史)/u,
    },
    {
        term: 'multiple',
        pattern:
            /(?:\b(?:history|historical)\b[^.!?\n]{0,80}\bmultiple\b|\bmultiple\b[^.!?\n]{0,80}\b(?:history|historical)\b)/iu,
    },
    {
        term: 'repeatedly',
        pattern:
            /(?:\b(?:history|historical)\b[^.!?\n]{0,80}\brepeatedly\b|\brepeatedly\b[^.!?\n]{0,80}\b(?:history|historical)\b)/iu,
    },
    {
        term: 'often',
        pattern:
            /(?:\b(?:history|historical)\b[^.!?\n]{0,80}\boften\b|\boften\b[^.!?\n]{0,80}\b(?:history|historical)\b)/iu,
    },
] as const;

// 它只在两个条件同时成立时报警：
// 1. claim 明确把频率/数量描述与 Historical 联系起来；
// 2. cited unique Historical IDs 少于两个。
export function findHistoricalCardinalityViolation(
    input: VerifyClaimInput
): HistoricalCardinalityViolation | null {
    const historicalSourceCount =
        new Set(
            input.claim.evidenceRefs
                .filter(
                    ({ source }) =>
                        source === 'historical'
                )
                .map(
                    ({ reflectionId }) =>
                        reflectionId
                )
        ).size;

    if (historicalSourceCount >= 2) {
        return null;
    }

    const matchedRule =
        HISTORICAL_CARDINALITY_RULES.find(
            ({ pattern }) =>
                pattern.test(input.claim.claim)
        );

    if (!matchedRule) {
        return null;
    }

    return {
        failureType: 'quantity/cardinality',
        matchedTerm: matchedRule.term,
        historicalSourceCount,
        requiredHistoricalSourceCount: 2,
    };
}

// evidence 首先放 Current，再保留 Historical Evidence 的原顺序。
// as const 防止 TypeScript 把 'historical'、'pattern' 推断成宽泛的 string。
// evidenceRefs 只保留来源标签和 ID，作为 claim 声称使用的引用。
// evidence 同时保存 exact excerpt，供未来 verifier 阅读。
// 两个 claim 使用同一组已附着 Evidence，但之后会被分别判断。
// 函数没有接收完整 retrieval，所以不可能加入 Insight 之外的历史记录。
// 输入没有被修改，因此它仍是纯函数。
export function buildClaimVerificationInputs(
    insight: EvidenceBackedInsight,
    insightIndex: number
): VerifyClaimInput[] {
    const evidence: VerifyClaimInput['evidence'] = [
        {
            source: 'current',
            reflectionId:
                insight.currentEvidence.reflectionId,
            excerpt: insight.currentEvidence.excerpt,
        },
        ...insight.evidence.map((item) => ({
            source: 'historical' as const,
            reflectionId: item.reflectionId,
            excerpt: item.excerpt,
        })),
    ];

    const evidenceRefs =
        evidence.map(({ source, reflectionId }) => ({
            source,
            reflectionId,
        }));

    return [
        {
            kind: 'pattern' as const,
            claim: insight.pattern,
        },
        {
            kind: 'interpretation' as const,
            claim: insight.interpretation,
        },
    ].map(({ kind, claim }) => ({
        claim: {
            claimId:
                `insight-${insightIndex}-${kind}`,
            insightIndex,
            kind,
            scope: 'shared' as const,
            claim,
            relationship: insight.relationship,
            evidenceRefs,
        },
        evidence,
    }));
}

export const SourceSupportAssessmentSchema =
    z.object({
        source: z.enum([
            'current',
            'historical',
        ]),
        reflectionId: z.string().min(1),
        support: z.enum([
            'full',
            'partial',
            'none',
        ]),
        reason: z.string().min(1),
    });

export type SourceSupportAssessment =
    z.infer<
        typeof SourceSupportAssessmentSchema
    >;

export const SupportResultSchema = z.object({
    claimId: z.string().min(1),
    status: z.enum([
        'supported',
        'partial',
        'unsupported',
    ]),
    reason: z.string().min(1),
    sourceAssessments: z
        .array(SourceSupportAssessmentSchema)
        .min(1),
});

export type SupportResult = z.infer<
    typeof SupportResultSchema
>;

type SourceIdentity = {
    source: 'current' | 'historical';
    reflectionId: string;
};

function createSourceIdentityKey(
    identity: SourceIdentity
): string {
    return (
        `${identity.source}:` +
        identity.reflectionId
    );
}

// - hasDuplicateAssessments：同一来源重复出现；
// - hasDifferentLength：缺少来源或添加来源；
// - hasDifferentSource：ID 或 source 标签不匹配。
// 对 expected keys 使用 Set，因为相同 source + reflectionId 表示同一个独立来源。即使输入意外包含同一 ID 的多个 excerpts，也不要求模型重复评估同一个来源。
// 排序只用于让集合比较不依赖模型输出顺序。模型可以先返回 Historical，再返回 Current，只要集合完全相同即可。

export function assertSourceAssessmentCoverage(
    input: VerifyClaimInput,
    result: SupportResult
): void {
    const expectedKeys = [
        ...new Set(
            input.claim.evidenceRefs.map(
                createSourceIdentityKey
            )
        ),
    ].sort();

    const actualKeys =
        result.sourceAssessments
            .map(createSourceIdentityKey)
            .sort();

    const uniqueActualKeys =
        new Set(actualKeys);

    const hasDuplicateAssessments =
        uniqueActualKeys.size !==
        actualKeys.length;

    const hasDifferentLength =
        expectedKeys.length !==
        actualKeys.length;

    const hasDifferentSource =
        expectedKeys.some(
            (expectedKey, index) =>
                expectedKey !== actualKeys[index]
        );

    if (
        hasDuplicateAssessments ||
        hasDifferentLength ||
        hasDifferentSource
    ) {
        throw new Error(
            'Verifier source assessments do not ' +
            'exactly match cited evidence'
        );
    }
}