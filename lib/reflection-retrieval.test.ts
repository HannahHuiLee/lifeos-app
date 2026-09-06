import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    syntheticCases,
    syntheticReflectionTimeline,
} from '@/evals/fixtures/reflection-timeline.synthetic';

const { findManyMock } = vi.hoisted(() => ({
    findManyMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    prisma: {
        reflection: {
            findMany: findManyMock,
        },
    },
}));

import {
    retrieveRelevantReflections,
} from '@/lib/reflection-retrieval';

describe('retrieveRelevantReflections', () => {
    beforeEach(() => {
        findManyMock.mockReset();
    });

    it('excludes the Current Reflection', async () => {
        const currentReflection = {
            id: 'current-reflection',
            content: 'Current content',
            createdAt: new Date('2026-08-29T12:00:00.000Z'),
        };

        findManyMock.mockResolvedValue([]);

        await expect(
            retrieveRelevantReflections(currentReflection)
        ).resolves.toEqual([]);

        expect(findManyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: {
                        not: currentReflection.id,
                    },
                }),
            })
        );
    });


    it('excludes future Reflections', async () => {
        const currentReflection = {
            id: 'current-reflection',
            content: 'Current content',
            createdAt: new Date('2026-08-29T12:00:00.000Z'),
        };

        findManyMock.mockResolvedValue([]);

        await retrieveRelevantReflections(currentReflection);

        expect(findManyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    createdAt: {
                        lt: currentReflection.createdAt,
                    },
                }),
            })
        );
    });


    it('preserves newest to oldest order', async () => {
        const currentReflection = {
            id: 'current-reflection',
            content: 'Current content',
            createdAt: new Date('2026-08-29T12:00:00.000Z'),
        };

        const newestReflection = {
            id: 'newest-reflection',
            content: 'Newest historical content',
            createdAt: new Date('2026-08-29T11:00:00.000Z'),
        };

        const oldestReflection = {
            id: 'oldest-reflection',
            content: 'Oldest historical content',
            createdAt: new Date('2026-08-29T09:00:00.000Z'),
        };

        findManyMock.mockResolvedValue([
            newestReflection,
            oldestReflection,
        ]);

        await expect(
            retrieveRelevantReflections(currentReflection)
        ).resolves.toEqual([
            newestReflection,
            oldestReflection,
        ]);

        expect(findManyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: {
                    createdAt: 'desc',
                },
            })
        );
    });


    it('excludes a Historical Reflection that duplicates the Current Reflection', async () => {
        const currentReflection = {
            id: 'current-reflection',
            content: 'Repeated insight',
            createdAt: new Date('2026-08-29T12:00:00.000Z'),
        };

        const historicalDuplicate = {
            id: 'historical-duplicate',
            content: 'Repeated insight',
            createdAt: new Date('2026-08-29T11:00:00.000Z'),
        };

        findManyMock.mockResolvedValue([
            historicalDuplicate,
        ]);

        await expect(
            retrieveRelevantReflections(currentReflection)
        ).resolves.toEqual([]);
    });

    it('retrieves the canonical synthetic timeline with duplicate evidence removed', async () => {
        const fixture =
            syntheticCases.find(
                ({ id }) =>
                    id === 'duplicate-evidence'
            );

        if (!fixture) {
            throw new Error(
                'Synthetic duplicate case was not found'
            );
        }

        const current =
            syntheticReflectionTimeline.find(
                ({ id }) =>
                    id ===
                    fixture.currentReflectionId
            );

        if (!current) {
            throw new Error(
                'Synthetic current Reflection was not found'
            );
        }

        const historicalCandidates =
            syntheticReflectionTimeline
                .filter(
                    ({ id, createdAt }) =>
                        id !== current.id &&
                        new Date(createdAt) <
                        new Date(
                            current.createdAt
                        )
                )
                .sort(
                    (left, right) =>
                        new Date(
                            right.createdAt
                        ).getTime() -
                        new Date(
                            left.createdAt
                        ).getTime()
                )
                .map((reflection) => ({
                    ...reflection,
                    createdAt: new Date(
                        reflection.createdAt
                    ),
                }));

        findManyMock.mockResolvedValue(
            historicalCandidates
        );

        const result =
            await retrieveRelevantReflections({
                ...current,
                createdAt: new Date(
                    current.createdAt
                ),
            });

        expect(
            result.map(({ id }) => id)
        ).toEqual(
            fixture.expectedRetrievedIds
        );

        expect(
            result.map(({ id }) => id)
        ).not.toContain('syn-ref-001');
    });

    it('keeps only the newest of duplicate Historical Reflections', async () => {
        const currentReflection = {
            id: 'current-reflection',
            content: 'Current content',
            createdAt: new Date('2026-08-29T12:00:00.000Z'),
        };

        const newestDuplicate = {
            id: 'newest-duplicate',
            content: 'Repeated historical insight',
            createdAt: new Date('2026-08-29T11:00:00.000Z'),
        };

        const olderDuplicate = {
            id: 'older-duplicate',
            content: 'Repeated historical insight',
            createdAt: new Date('2026-08-29T10:00:00.000Z'),
        };

        const independentReflection = {
            id: 'independent-reflection',
            content: 'Independent insight',
            createdAt: new Date('2026-08-29T09:00:00.000Z'),
        };

        findManyMock.mockResolvedValue([
            newestDuplicate,
            olderDuplicate,
            independentReflection,
        ]);

        await expect(
            retrieveRelevantReflections(currentReflection)
        ).resolves.toEqual([
            newestDuplicate,
            independentReflection,
        ]);
    });



    it('deduplicates content with whitespace and newline differences', async () => {
        const currentReflection = {
            id: 'current-reflection',
            content: '  Plan   the\nnext\tstep  ',
            createdAt: new Date('2026-08-29T12:00:00.000Z'),
        };

        const historicalDuplicate = {
            id: 'historical-duplicate',
            content: 'Plan the next step',
            createdAt: new Date('2026-08-29T11:00:00.000Z'),
        };

        findManyMock.mockResolvedValue([
            historicalDuplicate,
        ]);

        await expect(
            retrieveRelevantReflections(currentReflection)
        ).resolves.toEqual([]);
    });



    it('deduplicates Unicode NFKC-equivalent content', async () => {
        const currentReflection = {
            id: 'current-reflection',
            content: 'ＡＢＣ １２３',
            createdAt: new Date('2026-08-29T12:00:00.000Z'),
        };

        const historicalDuplicate = {
            id: 'historical-duplicate',
            content: 'ABC 123',
            createdAt: new Date('2026-08-29T11:00:00.000Z'),
        };

        findManyMock.mockResolvedValue([
            historicalDuplicate,
        ]);

        await expect(
            retrieveRelevantReflections(currentReflection)
        ).resolves.toEqual([]);
    });


    it('fills five slots with older independent Reflections after deduplication', async () => {
        const currentReflection = {
            id: 'current-reflection',
            content: 'Current content',
            createdAt: new Date('2026-08-29T12:00:00.000Z'),
        };

        const historicalCandidates = [
            {
                id: 'reflection-a-newest',
                content: 'Insight A',
                createdAt: new Date('2026-08-29T11:00:00.000Z'),
            },
            {
                id: 'reflection-a-duplicate',
                content: 'Insight A',
                createdAt: new Date('2026-08-29T10:00:00.000Z'),
            },
            {
                id: 'reflection-b',
                content: 'Insight B',
                createdAt: new Date('2026-08-29T09:00:00.000Z'),
            },
            {
                id: 'reflection-c',
                content: 'Insight C',
                createdAt: new Date('2026-08-29T08:00:00.000Z'),
            },
            {
                id: 'reflection-d',
                content: 'Insight D',
                createdAt: new Date('2026-08-29T07:00:00.000Z'),
            },
            {
                id: 'reflection-e',
                content: 'Insight E',
                createdAt: new Date('2026-08-29T06:00:00.000Z'),
            },
            {
                id: 'reflection-f',
                content: 'Insight F',
                createdAt: new Date('2026-08-29T05:00:00.000Z'),
            },
        ];

        findManyMock.mockImplementation(
            async (query: { take?: number }) =>
                historicalCandidates.slice(
                    0,
                    query.take ??
                    historicalCandidates.length
                )
        );

        await expect(
            retrieveRelevantReflections(currentReflection)
        ).resolves.toEqual([
            historicalCandidates[0],
            historicalCandidates[2],
            historicalCandidates[3],
            historicalCandidates[4],
            historicalCandidates[5],
        ]);
    });

    it('returns an empty array when all Historical candidates duplicate the Current Reflection', async () => {
        const currentReflection = {
            id: 'current-reflection',
            content: 'ABC plan',
            createdAt: new Date('2026-08-29T12:00:00.000Z'),
        };

        findManyMock.mockResolvedValue([
            {
                id: 'exact-duplicate',
                content: 'ABC plan',
                createdAt: new Date('2026-08-29T11:00:00.000Z'),
            },
            {
                id: 'whitespace-duplicate',
                content: '  ABC\nplan  ',
                createdAt: new Date('2026-08-29T10:00:00.000Z'),
            },
            {
                id: 'unicode-duplicate',
                content: 'ＡＢＣ plan',
                createdAt: new Date('2026-08-29T09:00:00.000Z'),
            },
        ]);

        await expect(
            retrieveRelevantReflections(currentReflection)
        ).resolves.toEqual([]);
    });


});