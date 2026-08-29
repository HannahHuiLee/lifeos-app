import {
    describe,
    expect,
    it,
} from 'vitest';

import {
    validateAnalysisEvidence,
} from '@/lib/evidence-validation';

describe('validateAnalysisEvidence', () => {
    it('removes an Insight with no validated Historical Evidence', () => {
        const result = validateAnalysisEvidence(
            {
                status: 'insights_found',
                insights: [
                    {
                        pattern: 'Repeated focus pattern',
                        interpretation:
                            'The current entry continues the pattern.',
                        currentEvidence: {
                            reflectionId:
                                'current-reflection',
                            excerpt: 'Current evidence',
                        },
                        evidence: [
                            {
                                reflectionId:
                                    'unknown-reflection',
                                excerpt:
                                    'Unvalidated evidence',
                            },
                        ],
                        relationship: 'supports',
                        confidence: 'high',
                    },
                ],
                insufficientEvidenceReason: null,
            },
            {
                id: 'current-reflection',
                content:
                    'Current evidence appears here.',
            },
            []
        );

        expect(result.analysis.status).toBe(
            'insufficient_evidence'
        );
        expect(result.analysis.insights).toEqual([]);
        expect(result.removedEvidenceCount).toBe(1);
    });

    it('caps high confidence at low with one validated Historical Evidence', () => {
        const result = validateAnalysisEvidence(
            {
                status: 'insights_found',
                insights: [
                    {
                        pattern: 'Repeated focus pattern',
                        interpretation:
                            'The current entry continues the pattern.',
                        currentEvidence: {
                            reflectionId:
                                'current-reflection',
                            excerpt: 'Current evidence',
                        },
                        evidence: [
                            {
                                reflectionId:
                                    'historical-1',
                                excerpt:
                                    'Historical evidence one',
                            },
                        ],
                        relationship: 'supports',
                        confidence: 'high',
                    },
                ],
                insufficientEvidenceReason: null,
            },
            {
                id: 'current-reflection',
                content:
                    'Current evidence appears here.',
            },
            [
                {
                    id: 'historical-1',
                    content:
                        'Historical evidence one appears here.',
                    createdAt: new Date(
                        '2026-08-28T12:00:00.000Z'
                    ),
                },
            ]
        );

        expect(
            result.analysis.insights[0]?.confidence
        ).toBe('low');
    });

    it('caps high confidence at medium with two validated Historical Evidence', () => {
        const result = validateAnalysisEvidence(
            {
                status: 'insights_found',
                insights: [
                    {
                        pattern: 'Repeated focus pattern',
                        interpretation:
                            'The current entry continues the pattern.',
                        currentEvidence: {
                            reflectionId:
                                'current-reflection',
                            excerpt: 'Current evidence',
                        },
                        evidence: [
                            {
                                reflectionId:
                                    'historical-1',
                                excerpt:
                                    'Historical evidence one',
                            },
                            {
                                reflectionId:
                                    'historical-2',
                                excerpt:
                                    'Historical evidence two',
                            },
                        ],
                        relationship: 'supports',
                        confidence: 'high',
                    },
                ],
                insufficientEvidenceReason: null,
            },
            {
                id: 'current-reflection',
                content:
                    'Current evidence appears here.',
            },
            [
                {
                    id: 'historical-1',
                    content:
                        'Historical evidence one appears here.',
                    createdAt: new Date(
                        '2026-08-28T12:00:00.000Z'
                    ),
                },
                {
                    id: 'historical-2',
                    content:
                        'Historical evidence two appears here.',
                    createdAt: new Date(
                        '2026-08-27T12:00:00.000Z'
                    ),
                },
            ]
        );

        expect(
            result.analysis.insights[0]?.confidence
        ).toBe('medium');
    });

    it.each([
        ['low', 'low'],
        ['medium', 'medium'],
        ['high', 'high'],
    ] as const)(
        'keeps model %s confidence with three validated Historical Evidence',
        (modelConfidence, expectedConfidence) => {
            const result = validateAnalysisEvidence(
                {
                    status: 'insights_found',
                    insights: [
                        {
                            pattern:
                                'Repeated focus pattern',
                            interpretation:
                                'The current entry continues the pattern.',
                            currentEvidence: {
                                reflectionId:
                                    'current-reflection',
                                excerpt:
                                    'Current evidence',
                            },
                            evidence: [
                                {
                                    reflectionId:
                                        'historical-1',
                                    excerpt:
                                        'Historical evidence one',
                                },
                                {
                                    reflectionId:
                                        'historical-2',
                                    excerpt:
                                        'Historical evidence two',
                                },
                                {
                                    reflectionId:
                                        'historical-3',
                                    excerpt:
                                        'Historical evidence three',
                                },
                            ],
                            relationship: 'supports',
                            confidence:
                                modelConfidence,
                        },
                    ],
                    insufficientEvidenceReason: null,
                },
                {
                    id: 'current-reflection',
                    content:
                        'Current evidence appears here.',
                },
                [
                    {
                        id: 'historical-1',
                        content:
                            'Historical evidence one appears here.',
                        createdAt: new Date(
                            '2026-08-28T12:00:00.000Z'
                        ),
                    },
                    {
                        id: 'historical-2',
                        content:
                            'Historical evidence two appears here.',
                        createdAt: new Date(
                            '2026-08-27T12:00:00.000Z'
                        ),
                    },
                    {
                        id: 'historical-3',
                        content:
                            'Historical evidence three appears here.',
                        createdAt: new Date(
                            '2026-08-26T12:00:00.000Z'
                        ),
                    },
                ]
            );

            expect(
                result.analysis.insights[0]
                    ?.confidence
            ).toBe(expectedConfidence);
        }
    );

    it('caps confidence after invalid Historical Evidence has been removed', () => {
        const result = validateAnalysisEvidence(
            {
                status: 'insights_found',
                insights: [
                    {
                        pattern: 'Repeated focus pattern',
                        interpretation:
                            'The current entry continues the pattern.',
                        currentEvidence: {
                            reflectionId:
                                'current-reflection',
                            excerpt: 'Current evidence',
                        },
                        evidence: [
                            {
                                reflectionId:
                                    'historical-1',
                                excerpt:
                                    'Valid historical evidence',
                            },
                            {
                                reflectionId:
                                    'historical-2',
                                excerpt:
                                    'Excerpt not in its source',
                            },
                            {
                                reflectionId:
                                    'unknown-reflection',
                                excerpt:
                                    'Unknown historical evidence',
                            },
                        ],
                        relationship: 'supports',
                        confidence: 'high',
                    },
                ],
                insufficientEvidenceReason: null,
            },
            {
                id: 'current-reflection',
                content:
                    'Current evidence appears here.',
            },
            [
                {
                    id: 'historical-1',
                    content:
                        'Valid historical evidence appears here.',
                    createdAt: new Date(
                        '2026-08-28T12:00:00.000Z'
                    ),
                },
                {
                    id: 'historical-2',
                    content:
                        'Different source content.',
                    createdAt: new Date(
                        '2026-08-27T12:00:00.000Z'
                    ),
                },
            ]
        );

        expect(
            result.analysis.insights[0]?.evidence
        ).toHaveLength(1);

        expect(
            result.analysis.insights[0]?.confidence
        ).toBe('low');

        expect(result.removedEvidenceCount).toBe(2);
    });

    it('caps medium confidence at low with one validated Historical Evidence', () => {
        const result = validateAnalysisEvidence(
            {
                status: 'insights_found',
                insights: [
                    {
                        pattern: 'Repeated focus pattern',
                        interpretation:
                            'The current entry continues the pattern.',
                        currentEvidence: {
                            reflectionId:
                                'current-reflection',
                            excerpt: 'Current evidence',
                        },
                        evidence: [
                            {
                                reflectionId:
                                    'historical-1',
                                excerpt:
                                    'Historical evidence one',
                            },
                        ],
                        relationship: 'supports',
                        confidence: 'medium',
                    },
                ],
                insufficientEvidenceReason: null,
            },
            {
                id: 'current-reflection',
                content:
                    'Current evidence appears here.',
            },
            [
                {
                    id: 'historical-1',
                    content:
                        'Historical evidence one appears here.',
                    createdAt: new Date(
                        '2026-08-28T12:00:00.000Z'
                    ),
                },
            ]
        );

        expect(
            result.analysis.insights[0]?.confidence
        ).toBe('low');
    });

    it('counts repeated citations of one Historical Reflection as one independent evidence source', () => {
        const result = validateAnalysisEvidence(
            {
                status: 'insights_found',
                insights: [
                    {
                        pattern: 'Repeated focus pattern',
                        interpretation:
                            'The current entry continues the pattern.',
                        currentEvidence: {
                            reflectionId:
                                'current-reflection',
                            excerpt: 'Current evidence',
                        },
                        evidence: [
                            {
                                reflectionId:
                                    'historical-1',
                                excerpt: 'First excerpt',
                            },
                            {
                                reflectionId:
                                    'historical-1',
                                excerpt: 'Second excerpt',
                            },
                        ],
                        relationship: 'supports',
                        confidence: 'high',
                    },
                ],
                insufficientEvidenceReason: null,
            },
            {
                id: 'current-reflection',
                content:
                    'Current evidence appears here.',
            },
            [
                {
                    id: 'historical-1',
                    content:
                        'First excerpt. Second excerpt.',
                    createdAt: new Date(
                        '2026-08-28T12:00:00.000Z'
                    ),
                },
            ]
        );

        expect(
            result.analysis.insights[0]?.confidence
        ).toBe('low');
    });

    it.each([
        ['low', 'low'],
        ['medium', 'medium'],
    ] as const)(
        'does not increase model %s confidence with two validated Historical Evidence',
        (modelConfidence, expectedConfidence) => {
            const result = validateAnalysisEvidence(
                {
                    status: 'insights_found',
                    insights: [
                        {
                            pattern:
                                'Repeated focus pattern',
                            interpretation:
                                'The current entry continues the pattern.',
                            currentEvidence: {
                                reflectionId:
                                    'current-reflection',
                                excerpt:
                                    'Current evidence',
                            },
                            evidence: [
                                {
                                    reflectionId:
                                        'historical-1',
                                    excerpt:
                                        'Historical evidence one',
                                },
                                {
                                    reflectionId:
                                        'historical-2',
                                    excerpt:
                                        'Historical evidence two',
                                },
                            ],
                            relationship: 'supports',
                            confidence:
                                modelConfidence,
                        },
                    ],
                    insufficientEvidenceReason: null,
                },
                {
                    id: 'current-reflection',
                    content:
                        'Current evidence appears here.',
                },
                [
                    {
                        id: 'historical-1',
                        content:
                            'Historical evidence one appears here.',
                        createdAt: new Date(
                            '2026-08-28T12:00:00.000Z'
                        ),
                    },
                    {
                        id: 'historical-2',
                        content:
                            'Historical evidence two appears here.',
                        createdAt: new Date(
                            '2026-08-27T12:00:00.000Z'
                        ),
                    },
                ]
            );

            expect(
                result.analysis.insights[0]
                    ?.confidence
            ).toBe(expectedConfidence);
        }
    );

});