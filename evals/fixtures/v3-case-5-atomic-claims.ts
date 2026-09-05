import type {
    ClaimEvidence,
    SupportResult,
    VerifyClaimInput,
} from '@/lib/claim-verification';

import type {
    V3Case5FailureType,
} from '@/evals/fixtures/v3-case-5-run-labels';

type SemanticFailureType = Exclude<
    V3Case5FailureType,
    'quantity/cardinality'
>;

const CURRENT_REFLECTION_ID =
    'cmsvzytc60005gduwbby0avy1';

const PRIMARY_HISTORICAL_ID =
    'cmsvy4cxg0001gduwjd8vfm8b';

const SECONDARY_HISTORICAL_ID =
    'cmsvwwpa70000134bobd3t23n';

export const v3Case5AtomicClaimFixtures:
    readonly V3Case5AtomicClaimFixture[] = [
        {
            run: '04',
            parentKind: 'interpretation',
            atomicClaimId:
                'run-04-all-historical-ebr',
            claim:
                '两条被引用的 Historical Evidence 都明确提到 Evidence-backed Reflection 的功能或 UI 工作。',
            scope: 'shared',
            targetEvidenceRefs: [
                {
                    source: 'historical',
                    reflectionId:
                        PRIMARY_HISTORICAL_ID,
                },
                {
                    source: 'historical',
                    reflectionId:
                        SECONDARY_HISTORICAL_ID,
                },
            ],
            expectedStatus: 'unsupported',
            failureType:
                'not-all-cited-sources-support',
            note:
                'The second Historical source mentions continuing LifeOS but does not mention Evidence-backed Reflection or UI.',
        },
        {
            run: '07',
            parentKind: 'pattern',
            atomicClaimId:
                'run-07-shared-environment',
            claim:
                'Current 与 Historical Evidence 明确描述了两个不同的工作环境。',
            scope: 'shared',
            targetEvidenceRefs: [
                {
                    source: 'current',
                    reflectionId:
                        CURRENT_REFLECTION_ID,
                },
                {
                    source: 'historical',
                    reflectionId:
                        PRIMARY_HISTORICAL_ID,
                },
            ],
            expectedStatus: 'unsupported',
            failureType:
                'unsupported environment',
            note:
                'Historical identifies Starbucks, but Current does not identify any environment.',
        },
        {
            run: '08',
            parentKind: 'pattern',
            atomicClaimId:
                'run-08-shared-focus',
            claim:
                'Current 与 Historical Evidence 都明确描述用户处于专注状态。',
            scope: 'shared',
            targetEvidenceRefs: [
                {
                    source: 'current',
                    reflectionId:
                        CURRENT_REFLECTION_ID,
                },
                {
                    source: 'historical',
                    reflectionId:
                        PRIMARY_HISTORICAL_ID,
                },
            ],
            expectedStatus: 'unsupported',
            failureType:
                'unsupported mental state',
            note:
                'Historical explicitly says the user focused for three hours; Current does not state a focused mental state.',
        },
        {
            run: '09',
            parentKind: 'pattern',
            atomicClaimId:
                'run-09-shared-focus',
            claim:
                'Current 与 Historical Evidence 都明确描述用户处于专注状态。',
            scope: 'shared',
            targetEvidenceRefs: [
                {
                    source: 'current',
                    reflectionId:
                        CURRENT_REFLECTION_ID,
                },
                {
                    source: 'historical',
                    reflectionId:
                        PRIMARY_HISTORICAL_ID,
                },
            ],
            expectedStatus: 'unsupported',
            failureType:
                'historical-only attribution',
            note:
                'Explicit focus appears only in the cited Historical excerpt and must not be attributed to Current.',
        },
        {
            run: '09',
            parentKind: 'interpretation',
            atomicClaimId:
                'run-09-historical-starbucks',
            claim:
                '被引用的 Historical Evidence 明确指出这次工作的地点是星巴克。',
            scope: 'source-specific',
            targetEvidenceRefs: [
                {
                    source: 'historical',
                    reflectionId:
                        PRIMARY_HISTORICAL_ID,
                },
            ],
            expectedStatus: 'unsupported',
            failureType:
                'unsupported environment',
            note:
                'The cited excerpt says “我在那里” but does not identify Starbucks.',
        },
    ];

function createEvidenceKey(
    source: 'current' | 'historical',
    reflectionId: string
): string {
    return `${source}:${reflectionId}`;
}

export function buildAtomicClaimVerificationInput(
    fixture: V3Case5AtomicClaimFixture,
    parentInput: VerifyClaimInput
): VerifyClaimInput {
    if (
        parentInput.claim.kind !==
        fixture.parentKind
    ) {
        throw new Error(
            `Atomic parent kind mismatch for ` +
            fixture.atomicClaimId
        );
    }

    const evidence =
        fixture.targetEvidenceRefs.map(
            ({ source, reflectionId }) => {
                const existsInParentRefs =
                    parentInput.claim.evidenceRefs.some(
                        (reference) =>
                            reference.source === source &&
                            reference.reflectionId ===
                            reflectionId
                    );

                const parentEvidence =
                    parentInput.evidence.find(
                        (item) =>
                            item.source === source &&
                            item.reflectionId ===
                            reflectionId
                    );

                if (
                    !existsInParentRefs ||
                    !parentEvidence
                ) {
                    throw new Error(
                        `Atomic target evidence ` +
                        createEvidenceKey(
                            source,
                            reflectionId
                        ) +
                        ` was not found in parent claim`
                    );
                }

                return {
                    ...parentEvidence,
                };
            }
        );

    return {
        claim: {
            claimId:
                fixture.atomicClaimId,
            insightIndex:
                parentInput.claim.insightIndex,
            kind: fixture.parentKind,
            scope: fixture.scope,
            claim: fixture.claim,
            relationship:
                parentInput.claim.relationship,
            evidenceRefs:
                fixture.targetEvidenceRefs.map(
                    ({ source, reflectionId }) => ({
                        source,
                        reflectionId,
                    })
                ),
        },
        evidence,
    };
}

export type AtomicClaimScope =
    | 'shared'
    | 'source-specific';

export type AtomicEvidenceReference = {
    source: 'current' | 'historical';
    reflectionId: string;
};

// run：定位冻结响应。
// parentKind：原始错误来自 Pattern 或 Interpretation。
// atomicClaimId：稳定标识拆出的最小 claim。
// claim：只表达一个需要判断的事实或关系。
// scope: shared：判断 Current 与 Historical 是否共享某属性。
// scope: source-specific：判断某个指定来源是否支持某属性。
// targetEvidenceRefs：明确哪些 sources 应参与判断，避免 Verifier 自己猜。
// expectedStatus：人工真值。
// failureType：这里只允许真正的 semantic failure；cardinality 已交给 deterministic code。
// note：人工判断依据。
export type V3Case5AtomicClaimFixture = {
    run: string;
    parentKind: ClaimEvidence['kind'];
    atomicClaimId: string;
    claim: string;
    scope: AtomicClaimScope;
    targetEvidenceRefs:
    readonly AtomicEvidenceReference[];
    expectedStatus:
    SupportResult['status'];
    failureType: SemanticFailureType;
    note: string;
};