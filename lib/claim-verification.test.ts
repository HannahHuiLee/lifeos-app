import {
    describe,
    expect,
    it,
} from 'vitest';

import {
    assertSourceAssessmentCoverage,
    buildClaimVerificationInputs,
    findHistoricalCardinalityViolation,
    SupportResultSchema,
    VerifyClaimInputSchema,
} from '@/lib/claim-verification';

import {
    claimVerificationFixtures,
} from '@/evals/fixtures/claim-verification';

import type {
    EvidenceBackedInsight,
} from '@/lib/reflection-analysis';

const insight: EvidenceBackedInsight = {
    pattern:
        '当前与历史都在持续开发 LifeOS。',
    interpretation:
        '这些记录显示项目开发仍在继续。',
    currentEvidence: {
        reflectionId: 'current-1',
        excerpt: '今天继续开发 LifeOS。',
    },
    evidence: [
        {
            reflectionId: 'historical-1',
            excerpt: '昨天开发了 LifeOS。',
        },
        {
            reflectionId: 'historical-2',
            excerpt: '上周继续开发 LifeOS。',
        },
    ],
    relationship: 'supports',
    confidence: 'medium',
};

describe('buildClaimVerificationInputs', () => {
    it('creates the pattern claim', () => {
        const result =
            buildClaimVerificationInputs(insight, 2);

        expect(result[0]?.claim).toMatchObject({
            claimId: 'insight-2-pattern',
            insightIndex: 2,
            kind: 'pattern',
            scope: 'shared',
            claim: insight.pattern,
            relationship: 'supports',
        });
    });

    it('creates the interpretation claim', () => {
        const result =
            buildClaimVerificationInputs(insight, 2);

        expect(result[1]?.claim).toMatchObject({
            claimId: 'insight-2-interpretation',
            insightIndex: 2,
            kind: 'interpretation',
            scope: 'shared',
            claim: insight.interpretation,
            relationship: 'supports',
        });
    });

    it('preserves current and historical source labels', () => {
        const result =
            buildClaimVerificationInputs(insight, 2);

        for (const input of result) {
            expect(
                input.evidence.map(
                    (item) => item.source
                )
            ).toEqual([
                'current',
                'historical',
                'historical',
            ]);

            expect(
                input.claim.evidenceRefs.map(
                    (item) => item.source
                )
            ).toEqual([
                'current',
                'historical',
                'historical',
            ]);
        }
    });

    it('includes exactly the evidence attached to the Insight', () => {
        const result =
            buildClaimVerificationInputs(insight, 2);

        for (const input of result) {
            expect(
                input.evidence.map(
                    (item) => item.reflectionId
                )
            ).toEqual([
                'current-1',
                'historical-1',
                'historical-2',
            ]);
        }
    });

    it('preserves source-specific claim scope', () => {
        const input = {
            claim: {
                claimId:
                    'atomic-historical-location',
                insightIndex: 0,
                kind: 'interpretation',
                scope: 'source-specific',
                claim:
                    'Historical Evidence 明确指出地点是星巴克。',
                relationship: 'supports',
                evidenceRefs: [
                    {
                        source: 'historical',
                        reflectionId:
                            'historical-location',
                    },
                ],
            },
            evidence: [
                {
                    source: 'historical',
                    reflectionId:
                        'historical-location',
                    excerpt:
                        '我在那里完成了 UI。',
                },
            ],
        };

        const parsed =
            VerifyClaimInputSchema.parse(input);

        expect(parsed.claim.scope).toBe(
            'source-specific'
        );
    });

});

// 参数化测试会针对四个 fixture 分别确认：
// - 输入能通过 VerifyClaimInputSchema；
// - evidenceRefs 与实际 Evidence 的 source/ID 完全一致；
// - 恰好有一个 Current source；
// - 至少有一个 Historical source。
// 第二个测试冻结人工标签。如果以后有人意外把 Case 5 从 unsupported 改成 supported，测试会立刻失败。
describe('claimVerificationFixtures', () => {
    it.each(claimVerificationFixtures)(
        'keeps $name structurally valid',
        ({ input }) => {
            expect(() =>
                VerifyClaimInputSchema.parse(input)
            ).not.toThrow();

            const actualRefs = input.evidence.map(
                ({ source, reflectionId }) => ({
                    source,
                    reflectionId,
                })
            );

            expect(input.claim.evidenceRefs).toEqual(
                actualRefs
            );

            expect(
                input.evidence.filter(
                    (item) => item.source === 'current'
                )
            ).toHaveLength(1);

            expect(
                input.evidence.filter(
                    (item) => item.source === 'historical'
                ).length
            ).toBeGreaterThanOrEqual(1);
        }
    );

    it('keeps the manual semantic labels frozen', () => {
        expect(
            claimVerificationFixtures.map(
                ({ name, expectedStatus }) => ({
                    name,
                    expectedStatus,
                })
            )
        ).toEqual([
            {
                name: 'supported shared LifeOS work',
                expectedStatus: 'supported',
            },
            {
                name:
                    'partial historical-only location',
                expectedStatus: 'partial',
            },
            {
                name:
                    'unsupported Case 5 attribution',
                expectedStatus: 'unsupported',
            },
            {
                name:
                    'partial repeated claim with one source',
                expectedStatus: 'partial',
            },
        ]);
    });

    describe(
        'findHistoricalCardinalityViolation',
        () => {
            it('detects historical quantity wording with one source', () => {
                const fixture =
                    claimVerificationFixtures.find(
                        ({ name }) =>
                            name ===
                            'partial repeated claim with one source'
                    );

                if (!fixture) {
                    throw new Error(
                        'Repeated-claim fixture was not found'
                    );
                }

                expect(
                    findHistoricalCardinalityViolation(
                        fixture.input
                    )
                ).toEqual({
                    failureType:
                        'quantity/cardinality',
                    matchedTerm: '多次',
                    historicalSourceCount: 1,
                    requiredHistoricalSourceCount: 2,
                });
            });

            it('does not flag the same wording with two independent sources', () => {
                const result =
                    buildClaimVerificationInputs(
                        {
                            ...insight,
                            pattern:
                                '历史中曾多次开发 LifeOS，当前再次延续这一模式。',
                        },
                        0
                    );

                expect(
                    findHistoricalCardinalityViolation(
                        result[0]!
                    )
                ).toBeNull();
            });

            it('counts duplicate historical IDs as one source', () => {
                const result =
                    buildClaimVerificationInputs(
                        {
                            ...insight,
                            pattern:
                                '历史中曾多次开发 LifeOS，当前再次延续这一模式。',
                            evidence: [
                                {
                                    reflectionId:
                                        'historical-duplicate',
                                    excerpt:
                                        '昨天开发了 LifeOS。',
                                },
                                {
                                    reflectionId:
                                        'historical-duplicate',
                                    excerpt:
                                        '昨天继续完成了 UI。',
                                },
                            ],
                        },
                        0
                    );

                expect(
                    findHistoricalCardinalityViolation(
                        result[0]!
                    )
                ).toEqual({
                    failureType:
                        'quantity/cardinality',
                    matchedTerm: '多次',
                    historicalSourceCount: 1,
                    requiredHistoricalSourceCount: 2,
                });
            });
        }
    );

    describe(
        'SupportResultSchema source assessments',
        () => {
            const resultWithSourceAssessments = {
                claimId: 'insight-0-pattern',
                status: 'partial',
                reason:
                    'The shared project is supported, but one source lacks the UI detail.',
                sourceAssessments: [
                    {
                        source: 'current',
                        reflectionId: 'current-1',
                        support: 'full',
                        reason:
                            'Current supports the attributed project and UI work.',
                    },
                    {
                        source: 'historical',
                        reflectionId: 'historical-1',
                        support: 'partial',
                        reason:
                            'Historical supports the project but not every UI detail.',
                    },
                ],
            };

            it('preserves structured assessments for each source', () => {
                expect(
                    SupportResultSchema.parse(
                        resultWithSourceAssessments
                    )
                ).toEqual(
                    resultWithSourceAssessments
                );
            });

            it('requires source assessments', () => {
                expect(() =>
                    SupportResultSchema.parse({
                        claimId: 'insight-0-pattern',
                        status: 'supported',
                        reason:
                            'The claim is supported.',
                    })
                ).toThrow();
            });
        }
    );

    // What these tests distinguish
    // Zod 已经验证每个 assessment 的字段形状，但以下输出仍然都能通过 Zod：
    // - 少评估一个输入 source；
    // - 同一个 source 评估两次；
    // - 加入不存在的 Reflection ID；
    // - 给正确 ID 配上错误的 source 标签。
    // 这些不是语义问题，而是集合对应关系问题，所以必须由确定性代码拒绝。
    describe(
        'assertSourceAssessmentCoverage',
        () => {
            const input =
                buildClaimVerificationInputs(
                    insight,
                    0
                )[0]!;

            const exactAssessments = [
                {
                    source: 'current',
                    reflectionId: 'current-1',
                    support: 'full',
                    reason:
                        'Current supports its attributed content.',
                },
                {
                    source: 'historical',
                    reflectionId: 'historical-1',
                    support: 'full',
                    reason:
                        'Historical source one supports its attributed content.',
                },
                {
                    source: 'historical',
                    reflectionId: 'historical-2',
                    support: 'full',
                    reason:
                        'Historical source two supports its attributed content.',
                },
            ] as const;

            function createResult(
                sourceAssessments: unknown
            ) {
                return SupportResultSchema.parse({
                    claimId: input.claim.claimId,
                    status: 'supported',
                    reason:
                        'All cited sources were assessed.',
                    sourceAssessments,
                });
            }

            it('accepts each cited source exactly once', () => {
                const result =
                    createResult(exactAssessments);

                expect(() =>
                    assertSourceAssessmentCoverage(
                        input,
                        result
                    )
                ).not.toThrow();
            });

            it.each([
                {
                    name: 'a missing source',
                    sourceAssessments:
                        exactAssessments.slice(0, 2),
                },
                {
                    name: 'a duplicated source',
                    sourceAssessments: [
                        ...exactAssessments,
                        {
                            ...exactAssessments[1],
                        },
                    ],
                },
                {
                    name: 'a fabricated source',
                    sourceAssessments: [
                        exactAssessments[0],
                        exactAssessments[1],
                        {
                            ...exactAssessments[2],
                            reflectionId:
                                'historical-fabricated',
                        },
                    ],
                },
                {
                    name: 'an incorrect source label',
                    sourceAssessments: [
                        {
                            ...exactAssessments[0],
                            source: 'historical',
                        },
                        exactAssessments[1],
                        exactAssessments[2],
                    ],
                },
            ])(
                'rejects $name',
                ({ sourceAssessments }) => {
                    const result =
                        createResult(sourceAssessments);

                    expect(() =>
                        assertSourceAssessmentCoverage(
                            input,
                            result
                        )
                    ).toThrow(
                        'Verifier source assessments do not ' +
                        'exactly match cited evidence'
                    );
                }
            );
        }
    );

});