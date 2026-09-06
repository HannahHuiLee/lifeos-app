import type {
    VerifyClaimInput,
} from '@/lib/claim-verification';

export type SyntheticFailureStructure =
    | 'duplicate-evidence'
    | 'insufficient-evidence'
    | 'contradiction'
    | 'historical-only-attribution'
    | 'quantity/cardinality'
    | 'unsupported-environment'
    | 'unsupported-mental-state'
    | 'not-all-cited-sources-support';

export type SyntheticReflection = {
    id: string;
    createdAt: string;
    content: string;
};

export type SyntheticCase = {
    id: string;
    failureStructure: SyntheticFailureStructure;
    currentReflectionId: string;
    expectedRetrievedIds: readonly string[];
    excludedDuplicateIds?: readonly string[];
    expectedAnalysisStatus?:
    | 'insights_found'
    | 'insufficient_evidence';
    claim?: {
        kind: 'pattern' | 'interpretation';
        scope: 'shared' | 'source-specific';
        text: string;
        relationship: 'supports' | 'contradicts';
        citedHistoricalIds: readonly string[];
        expectedStatus:
        | 'supported'
        | 'partial'
        | 'unsupported';
    };
};

export const syntheticReflectionTimeline = [
    {
        id: 'syn-ref-001',
        createdAt: '2026-01-01T09:00:00.000Z',
        content:
            '今天在虚构的 Northstar Study Room 为 Orchid Notes 项目工作。我专注了三个小时，并完成了 dashboard UI。',
    },
    {
        id: 'syn-ref-002',
        createdAt: '2026-01-01T09:05:00.000Z',
        content:
            '今天在虚构的 Northstar Study Room 为 Orchid Notes 项目工作。我专注了三个小时，并完成了 dashboard UI。',
    },
    {
        id: 'syn-ref-003',
        createdAt: '2026-01-02T09:00:00.000Z',
        content:
            '今天继续开发 Orchid Notes，修复了 import parser。',
    },
    {
        id: 'syn-ref-004',
        createdAt: '2026-01-03T09:00:00.000Z',
        content:
            '今天继续开发 Orchid Notes，修复了 evidence validator 和 dashboard UI，并完成了计划中的功能。',
    },
    {
        id: 'syn-ref-005',
        createdAt: '2026-01-04T09:00:00.000Z',
        content:
            '今天第一次参加虚构的纸艺工作坊，学习制作纸雕。这是我第一次记录这类活动。',
    },
    {
        id: 'syn-ref-006',
        createdAt: '2026-01-05T09:00:00.000Z',
        content:
            '今天在虚构的 Northstar Study Room 工作，但不断被交谈声打断。三个小时里几乎没有完成任务。',
    },
] as const satisfies readonly SyntheticReflection[];

export const syntheticCases = [
    {
        id: 'duplicate-evidence',
        failureStructure: 'duplicate-evidence',
        currentReflectionId: 'syn-ref-004',
        expectedRetrievedIds: [
            'syn-ref-003',
            'syn-ref-002',
        ],
        excludedDuplicateIds: [
            'syn-ref-001',
        ],
    },
    {
        id: 'insufficient-evidence',
        failureStructure: 'insufficient-evidence',
        currentReflectionId: 'syn-ref-005',
        expectedRetrievedIds: [
            'syn-ref-004',
            'syn-ref-003',
            'syn-ref-002',
        ],
        expectedAnalysisStatus:
            'insufficient_evidence',
    },
    {
        id: 'contradiction',
        failureStructure: 'contradiction',
        currentReflectionId: 'syn-ref-006',
        expectedRetrievedIds: [
            'syn-ref-005',
            'syn-ref-004',
            'syn-ref-003',
            'syn-ref-002',
        ],
        expectedAnalysisStatus: 'insights_found',
        claim: {
            kind: 'interpretation',
            scope: 'shared',
            text:
                '历史记录描述在该学习空间专注完成工作，而当前记录描述同一环境中的噪声阻碍了工作。',
            relationship: 'contradicts',
            citedHistoricalIds: [
                'syn-ref-002',
            ],
            expectedStatus: 'supported',
        },
    },
    {
        id: 'historical-only-attribution',
        failureStructure:
            'historical-only-attribution',
        currentReflectionId: 'syn-ref-004',
        expectedRetrievedIds: [
            'syn-ref-003',
            'syn-ref-002',
        ],
        expectedAnalysisStatus: 'insights_found',
        claim: {
            kind: 'pattern',
            scope: 'shared',
            text:
                '当前与历史记录都描述了在 Northstar Study Room 专注工作三个小时。',
            relationship: 'supports',
            citedHistoricalIds: [
                'syn-ref-002',
            ],
            expectedStatus: 'unsupported',
        },
    },
    {
        id: 'quantity-cardinality',
        failureStructure: 'quantity/cardinality',
        currentReflectionId: 'syn-ref-004',
        expectedRetrievedIds: [
            'syn-ref-003',
            'syn-ref-002',
        ],
        expectedAnalysisStatus: 'insights_found',
        claim: {
            kind: 'interpretation',
            scope: 'shared',
            text:
                '历史 Reflection 中多次记录了完成 dashboard UI。',
            relationship: 'supports',
            citedHistoricalIds: [
                'syn-ref-002',
            ],
            expectedStatus: 'partial',
        },
    },
    {
        id: 'unsupported-environment',
        failureStructure:
            'unsupported-environment',
        currentReflectionId: 'syn-ref-004',
        expectedRetrievedIds: [
            'syn-ref-003',
            'syn-ref-002',
        ],
        expectedAnalysisStatus: 'insights_found',
        claim: {
            kind: 'pattern',
            scope: 'shared',
            text:
                '当前与历史记录明确描述了两个不同的工作环境。',
            relationship: 'supports',
            citedHistoricalIds: [
                'syn-ref-002',
            ],
            expectedStatus: 'unsupported',
        },
    },
    {
        id: 'unsupported-mental-state',
        failureStructure:
            'unsupported-mental-state',
        currentReflectionId: 'syn-ref-004',
        expectedRetrievedIds: [
            'syn-ref-003',
            'syn-ref-002',
        ],
        expectedAnalysisStatus: 'insights_found',
        claim: {
            kind: 'pattern',
            scope: 'shared',
            text:
                '当前与历史记录都明确描述了专注工作三个小时。',
            relationship: 'supports',
            citedHistoricalIds: [
                'syn-ref-002',
            ],
            expectedStatus: 'unsupported',
        },
    },
    {
        id: 'not-all-cited-sources-support',
        failureStructure:
            'not-all-cited-sources-support',
        currentReflectionId: 'syn-ref-004',
        expectedRetrievedIds: [
            'syn-ref-003',
            'syn-ref-002',
        ],
        expectedAnalysisStatus: 'insights_found',
        claim: {
            kind: 'interpretation',
            scope: 'shared',
            text:
                '两条被引用的历史记录都明确提到了完成 dashboard UI。',
            relationship: 'supports',
            citedHistoricalIds: [
                'syn-ref-002',
                'syn-ref-003',
            ],
            expectedStatus: 'unsupported',
        },
    },
] as const satisfies readonly SyntheticCase[];

function getSyntheticReflection(
    reflectionId: string
): SyntheticReflection {
    const reflection =
        syntheticReflectionTimeline.find(
            ({ id }) => id === reflectionId
        );

    if (!reflection) {
        throw new Error(
            `Unknown synthetic Reflection: ${reflectionId}`
        );
    }

    return reflection;
}

export function buildSyntheticVerifyClaimInput(
    fixture: SyntheticCase
): VerifyClaimInput {
    if (!fixture.claim) {
        throw new Error(
            `Synthetic case has no claim: ${fixture.id}`
        );
    }

    const current = getSyntheticReflection(
        fixture.currentReflectionId
    );

    const historical =
        fixture.claim.citedHistoricalIds.map(
            getSyntheticReflection
        );

    const evidence: VerifyClaimInput['evidence'] = [
        {
            source: 'current',
            reflectionId: current.id,
            excerpt: current.content,
        },
        ...historical.map((reflection) => ({
            source: 'historical' as const,
            reflectionId: reflection.id,
            excerpt: reflection.content,
        })),
    ];

    return {
        claim: {
            claimId: `synthetic-${fixture.id}`,
            insightIndex: 0,
            kind: fixture.claim.kind,
            scope: fixture.claim.scope,
            claim: fixture.claim.text,
            relationship:
                fixture.claim.relationship,
            evidenceRefs: evidence.map(
                ({ source, reflectionId }) => ({
                    source,
                    reflectionId,
                })
            ),
        },
        evidence,
    };
}