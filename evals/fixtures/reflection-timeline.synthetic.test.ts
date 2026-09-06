import {
    findHistoricalCardinalityViolation,
    VerifyClaimInputSchema,
    buildClaimVerificationInputs
} from '@/lib/claim-verification';

import {
    describe,
    expect,
    it,
} from 'vitest';

import {
    buildSyntheticVerifyClaimInput,
    syntheticCases,
    syntheticReflectionTimeline,
} from '@/evals/fixtures/reflection-timeline.synthetic';

import syntheticRun01 from '@/evals/fixtures/runs/grounding-reliability-v3-case-5/run-01-response.pretty.json';

import syntheticRun04 from '@/evals/fixtures/runs/grounding-reliability-v3-case-5/run-04-response.pretty.json';

import syntheticRun07 from '@/evals/fixtures/runs/grounding-reliability-v3-case-5/run-07-response.pretty.json';

import syntheticRun08 from '@/evals/fixtures/runs/grounding-reliability-v3-case-5/run-08-response.pretty.json';

import syntheticRun09 from '@/evals/fixtures/runs/grounding-reliability-v3-case-5/run-09-response.pretty.json';

import syntheticRun05 from '@/evals/fixtures/runs/grounding-reliability-v3-case-5/run-05-response.pretty.json';

import syntheticRun10 from '@/evals/fixtures/runs/grounding-reliability-v3-case-5/run-10-response.pretty.json';

import {
    EvidenceBackedReflectionAnalysisSchema,
} from '@/lib/reflection-analysis';

import {
    validateAnalysisEvidence,
} from '@/lib/evidence-validation';

function normalizeContent(
    content: string
): string {
    return content
        .normalize('NFKC')
        .trim()
        .replace(/\s+/g, ' ');
}

function retrieveExpectedIds(
    currentReflectionId: string
): string[] {
    const current =
        syntheticReflectionTimeline.find(
            ({ id }) => id === currentReflectionId
        );

    if (!current) {
        throw new Error(
            `Unknown current reflection: ${currentReflectionId}`
        );
    }

    const seenContents = new Set([
        normalizeContent(current.content),
    ]);

    return syntheticReflectionTimeline
        .filter(
            ({ id, createdAt }) =>
                id !== current.id &&
                new Date(createdAt) <
                new Date(current.createdAt)
        )
        .sort(
            (left, right) =>
                new Date(right.createdAt).getTime() -
                new Date(left.createdAt).getTime()
        )
        .filter(({ content }) => {
            const normalized =
                normalizeContent(content);

            if (seenContents.has(normalized)) {
                return false;
            }

            seenContents.add(normalized);
            return true;
        })
        .slice(0, 5)
        .map(({ id }) => id);
}

type SyntheticSavedRun = {
    currentReflectionId: string;
    retrieval: {
        reflectionIds: readonly string[];
    };
    analysis: {
        result: unknown;
    };
    validation: {
        removedEvidenceCount: number;
    };
};

function validateSyntheticSavedRun(
    savedRun: SyntheticSavedRun
) {
    const analysis =
        EvidenceBackedReflectionAnalysisSchema.parse(
            savedRun.analysis.result
        );

    const current =
        syntheticReflectionTimeline.find(
            ({ id }) =>
                id === savedRun.currentReflectionId
        );

    if (!current) {
        throw new Error(
            `Synthetic current Reflection was not found: ${savedRun.currentReflectionId}`
        );
    }

    const retrieved =
        savedRun.retrieval.reflectionIds.map(
            (reflectionId) => {
                const reflection =
                    syntheticReflectionTimeline.find(
                        ({ id }) =>
                            id === reflectionId
                    );

                if (!reflection) {
                    throw new Error(
                        `Synthetic retrieved Reflection was not found: ${reflectionId}`
                    );
                }

                return {
                    ...reflection,
                    createdAt: new Date(
                        reflection.createdAt
                    ),
                };
            }
        );

    return {
        analysis,
        validation:
            validateAnalysisEvidence(
                analysis,
                current,
                retrieved
            ),
    };
}

describe(
    'synthetic Reflection fixture contract',
    () => {
        it('uses unique synthetic IDs and valid dates', () => {
            const ids =
                syntheticReflectionTimeline.map(
                    ({ id }) => id
                );

            expect(new Set(ids).size).toBe(
                ids.length
            );

            for (const reflection of
                syntheticReflectionTimeline) {
                expect(reflection.id).toMatch(
                    /^syn-ref-\d{3}$/
                );

                expect(
                    Number.isNaN(
                        new Date(
                            reflection.createdAt
                        ).getTime()
                    )
                ).toBe(false);
            }
        });

        it('matches the production retrieval contract', () => {
            for (const fixture of syntheticCases) {
                expect(
                    retrieveExpectedIds(
                        fixture.currentReflectionId
                    )
                ).toEqual(
                    fixture.expectedRetrievedIds
                );
            }
        });

        it('references only retrievable historical IDs', () => {
            for (const fixture of syntheticCases) {
                if (!('claim' in fixture)) {
                    continue;
                }

                for (
                    const historicalId of
                    fixture.claim.citedHistoricalIds
                ) {
                    expect(
                        fixture.expectedRetrievedIds
                    ).toContain(historicalId);
                }
            }
        });

        it('excludes declared duplicate records', () => {
            for (const fixture of syntheticCases) {
                if (
                    !('excludedDuplicateIds' in fixture)
                ) {
                    continue;
                }

                for (
                    const duplicateId of
                    fixture.excludedDuplicateIds
                ) {
                    expect(
                        fixture.expectedRetrievedIds
                    ).not.toContain(duplicateId);
                }
            }
        });

        it('builds valid verifier inputs', () => {
            for (const fixture of syntheticCases) {
                if (!('claim' in fixture)) {
                    continue;
                }

                const input =
                    buildSyntheticVerifyClaimInput(
                        fixture
                    );

                expect(() =>
                    VerifyClaimInputSchema.parse(input)
                ).not.toThrow();

                expect(
                    input.claim.evidenceRefs
                ).toHaveLength(
                    input.evidence.length
                );

                expect(input.evidence[0]).toMatchObject({
                    source: 'current',
                    reflectionId:
                        fixture.currentReflectionId,
                });
            }
        });

        it('isolates the cardinality violation', () => {
            for (const fixture of syntheticCases) {
                if (!('claim' in fixture)) {
                    continue;
                }

                const input =
                    buildSyntheticVerifyClaimInput(
                        fixture
                    );

                const violation =
                    findHistoricalCardinalityViolation(
                        input
                    );

                expect(violation !== null).toBe(
                    fixture.failureStructure ===
                    'quantity/cardinality'
                );
            }
        });

        it('preserves the synthetic Run 01 cardinality failure', () => {
            const analysis =
                EvidenceBackedReflectionAnalysisSchema.parse(
                    syntheticRun01.analysis.result
                );

            expect(analysis.insights).toHaveLength(1);

            const [patternInput, interpretationInput] =
                buildClaimVerificationInputs(
                    analysis.insights[0],
                    0
                );

            expect(
                findHistoricalCardinalityViolation(
                    patternInput
                )
            ).toMatchObject({
                failureType: 'quantity/cardinality',
                matchedTerm: '多次',
                historicalSourceCount: 1,
                requiredHistoricalSourceCount: 2,
            });

            expect(
                findHistoricalCardinalityViolation(
                    interpretationInput
                )
            ).toBeNull();
        });

        it('validates synthetic Run 01 evidence against the canonical timeline', () => {
            const {
                analysis,
                validation,
            } = validateSyntheticSavedRun(
                syntheticRun01
            );

            expect(
                validation.removedEvidenceCount
            ).toBe(
                syntheticRun01.validation
                    .removedEvidenceCount
            );

            expect(validation.analysis).toEqual(
                analysis
            );
        });

        it('validates synthetic Run 04 evidence against the canonical timeline', () => {
            const {
                analysis,
                validation,
            } = validateSyntheticSavedRun(
                syntheticRun04
            );

            expect(
                validation.removedEvidenceCount
            ).toBe(0);

            expect(validation.analysis).toEqual(
                analysis
            );
        });

        it('preserves the synthetic Run 04 not-all-sources failure', () => {
            const fixture =
                syntheticCases.find(
                    ({ id }) =>
                        id ===
                        'not-all-cited-sources-support'
                );

            if (
                !fixture ||
                !('claim' in fixture)
            ) {
                throw new Error(
                    'Synthetic not-all-sources case was not found'
                );
            }

            const {
                analysis,
            } = validateSyntheticSavedRun(
                syntheticRun04
            );

            const [
                ,
                interpretationInput,
            ] = buildClaimVerificationInputs(
                analysis.insights[0],
                0
            );

            expect(
                interpretationInput.claim.claim
            ).toBe(fixture.claim.text);

            expect(
                interpretationInput.evidence
                    .filter(
                        ({ source }) =>
                            source === 'historical'
                    )
                    .map(
                        ({ reflectionId }) =>
                            reflectionId
                    )
                    .sort()
            ).toEqual(
                [
                    ...fixture.claim
                        .citedHistoricalIds,
                ].sort()
            );

            expect(
                interpretationInput.evidence
                    .filter(
                        ({ source }) =>
                            source === 'historical'
                    )
                    .map(({ excerpt }) =>
                        excerpt.includes(
                            'dashboard UI'
                        )
                    )
            ).toEqual([
                false,
                true,
            ]);
        });

        it('validates synthetic Run 07 evidence against the canonical timeline', () => {
            const {
                analysis,
                validation,
            } = validateSyntheticSavedRun(
                syntheticRun07
            );

            expect(
                validation.removedEvidenceCount
            ).toBe(0);

            expect(validation.analysis).toEqual(
                analysis
            );
        });

        it('preserves the synthetic Run 07 unsupported environment failure', () => {
            const fixture =
                syntheticCases.find(
                    ({ id }) =>
                        id ===
                        'unsupported-environment'
                );

            if (
                !fixture ||
                !('claim' in fixture)
            ) {
                throw new Error(
                    'Synthetic unsupported environment case was not found'
                );
            }

            const {
                analysis,
            } = validateSyntheticSavedRun(
                syntheticRun07
            );

            const [patternInput] =
                buildClaimVerificationInputs(
                    analysis.insights[0],
                    0
                );

            expect(
                patternInput.claim.claim
            ).toBe(fixture.claim.text);

            const currentEvidence =
                patternInput.evidence.find(
                    ({ source }) =>
                        source === 'current'
                );

            const historicalEvidence =
                patternInput.evidence.find(
                    ({ source }) =>
                        source === 'historical'
                );

            expect(
                currentEvidence?.excerpt
            ).not.toContain(
                'Northstar Study Room'
            );

            expect(
                historicalEvidence?.excerpt
            ).toContain(
                'Northstar Study Room'
            );
        });

        it('validates synthetic Run 08 evidence against the canonical timeline', () => {
            const {
                analysis,
                validation,
            } = validateSyntheticSavedRun(
                syntheticRun08
            );

            expect(
                validation.removedEvidenceCount
            ).toBe(0);

            expect(validation.analysis).toEqual(
                analysis
            );
        });

        it('preserves the synthetic Run 08 mental-state and cardinality failures', () => {
            const mentalStateFixture =
                syntheticCases.find(
                    ({ id }) =>
                        id ===
                        'unsupported-mental-state'
                );

            const cardinalityFixture =
                syntheticCases.find(
                    ({ id }) =>
                        id ===
                        'quantity-cardinality'
                );

            if (
                !mentalStateFixture ||
                !('claim' in mentalStateFixture) ||
                !cardinalityFixture ||
                !('claim' in cardinalityFixture)
            ) {
                throw new Error(
                    'Synthetic Run 08 case definitions were not found'
                );
            }

            const {
                analysis,
            } = validateSyntheticSavedRun(
                syntheticRun08
            );

            const [
                patternInput,
                interpretationInput,
            ] = buildClaimVerificationInputs(
                analysis.insights[0],
                0
            );

            expect(
                patternInput.claim.claim
            ).toBe(
                mentalStateFixture.claim.text
            );

            expect(
                interpretationInput.claim.claim
            ).toBe(
                cardinalityFixture.claim.text
            );

            const currentEvidence =
                patternInput.evidence.find(
                    ({ source }) =>
                        source === 'current'
                );

            const historicalEvidence =
                patternInput.evidence.find(
                    ({ source }) =>
                        source === 'historical'
                );

            expect(
                currentEvidence?.excerpt
            ).not.toContain('专注');

            expect(
                currentEvidence?.excerpt
            ).not.toContain('三个小时');

            expect(
                historicalEvidence?.excerpt
            ).toContain('专注');

            expect(
                historicalEvidence?.excerpt
            ).toContain('三个小时');

            expect(
                findHistoricalCardinalityViolation(
                    patternInput
                )
            ).toBeNull();

            expect(
                findHistoricalCardinalityViolation(
                    interpretationInput
                )
            ).toMatchObject({
                failureType: 'quantity/cardinality',
                matchedTerm: '多次',
                historicalSourceCount: 1,
            });
        });

        it('validates synthetic Run 09 evidence against the canonical timeline', () => {
            const {
                analysis,
                validation,
            } = validateSyntheticSavedRun(
                syntheticRun09
            );

            expect(
                validation.removedEvidenceCount
            ).toBe(0);

            expect(validation.analysis).toEqual(
                analysis
            );
        });

        it('preserves the synthetic Run 09 historical-only attribution failures', () => {
            const fixture =
                syntheticCases.find(
                    ({ id }) =>
                        id ===
                        'historical-only-attribution'
                );

            if (
                !fixture ||
                !('claim' in fixture)
            ) {
                throw new Error(
                    'Synthetic historical-only attribution case was not found'
                );
            }

            const {
                analysis,
            } = validateSyntheticSavedRun(
                syntheticRun09
            );

            const [
                patternInput,
                interpretationInput,
            ] = buildClaimVerificationInputs(
                analysis.insights[0],
                0
            );

            expect(
                patternInput.claim.claim
            ).toBe(fixture.claim.text);

            const currentEvidence =
                patternInput.evidence.find(
                    ({ source }) =>
                        source === 'current'
                );

            const historicalEvidence =
                patternInput.evidence.find(
                    ({ source }) =>
                        source === 'historical'
                );

            expect(
                currentEvidence?.excerpt
            ).not.toContain(
                'Northstar Study Room'
            );

            expect(
                currentEvidence?.excerpt
            ).not.toContain('专注');

            expect(
                historicalEvidence?.excerpt
            ).toContain('专注');

            expect(
                historicalEvidence?.excerpt
            ).toContain('三个小时');

            expect(
                historicalEvidence?.excerpt
            ).not.toContain(
                'Northstar Study Room'
            );

            expect(
                interpretationInput.claim.claim
            ).toContain(
                'Northstar Study Room'
            );
        });

        it('validates synthetic Run 05 evidence against the canonical timeline', () => {
            const {
                analysis,
                validation,
            } = validateSyntheticSavedRun(
                syntheticRun05
            );

            expect(
                validation.removedEvidenceCount
            ).toBe(0);

            expect(validation.analysis).toEqual(
                analysis
            );
        });

        it('preserves synthetic Run 05 as a supported control', () => {
            const {
                analysis,
            } = validateSyntheticSavedRun(
                syntheticRun05
            );

            const [
                patternInput,
                interpretationInput,
            ] = buildClaimVerificationInputs(
                analysis.insights[0],
                0
            );

            expect(
                findHistoricalCardinalityViolation(
                    patternInput
                )
            ).toBeNull();

            expect(
                findHistoricalCardinalityViolation(
                    interpretationInput
                )
            ).toBeNull();

            for (
                const input of [
                    patternInput,
                    interpretationInput,
                ]
            ) {
                expect(
                    input.claim.claim
                ).toContain('dashboard UI');

                expect(
                    input.claim.claim
                ).not.toContain(
                    'Northstar Study Room'
                );

                expect(
                    input.claim.claim
                ).not.toContain('专注');

                expect(
                    input.claim.claim
                ).not.toContain('三个小时');

                for (
                    const evidence of
                    input.evidence
                ) {
                    expect(
                        evidence.excerpt
                    ).toContain('Orchid Notes');

                    expect(
                        evidence.excerpt
                    ).toContain('dashboard UI');
                }
            }
        });

        it('validates synthetic Run 10 evidence against the canonical timeline', () => {
            const {
                analysis,
                validation,
            } = validateSyntheticSavedRun(
                syntheticRun10
            );

            expect(
                validation.removedEvidenceCount
            ).toBe(0);

            expect(validation.analysis).toEqual(
                analysis
            );
        });

        it('preserves synthetic Run 10 as a supported attribution control', () => {
            const {
                analysis,
            } = validateSyntheticSavedRun(
                syntheticRun10
            );

            const [
                patternInput,
                interpretationInput,
            ] = buildClaimVerificationInputs(
                analysis.insights[0],
                0
            );

            expect(
                findHistoricalCardinalityViolation(
                    patternInput
                )
            ).toBeNull();

            expect(
                findHistoricalCardinalityViolation(
                    interpretationInput
                )
            ).toBeNull();

            expect(
                patternInput.claim.claim
            ).not.toContain(
                'Northstar Study Room'
            );

            expect(
                patternInput.claim.claim
            ).not.toContain('专注');

            expect(
                interpretationInput.claim.claim
            ).toContain(
                '历史记录描述了在 Northstar Study Room'
            );

            expect(
                interpretationInput.claim.claim
            ).toContain(
                '当前记录只描述继续修复'
            );

            const currentEvidence =
                interpretationInput.evidence.find(
                    ({ source }) =>
                        source === 'current'
                );

            const historicalEvidence =
                interpretationInput.evidence.find(
                    ({ source }) =>
                        source === 'historical'
                );

            expect(
                currentEvidence?.excerpt
            ).not.toContain(
                'Northstar Study Room'
            );

            expect(
                historicalEvidence?.excerpt
            ).toContain(
                'Northstar Study Room'
            );
        });

    }
);