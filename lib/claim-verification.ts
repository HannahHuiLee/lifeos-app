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
            claim,
            relationship: insight.relationship,
            evidenceRefs,
        },
        evidence,
    }));
}

export const SupportResultSchema = z.object({
    claimId: z.string().min(1),
    status: z.enum([
        'supported',
        'partial',
        'unsupported',
    ]),
    reason: z.string().min(1),
});

export type SupportResult = z.infer<
    typeof SupportResultSchema
>;