import {
    describe,
    expect,
    it,
} from 'vitest';

import {
    GeneratedListeningExerciseSchema,
    ListeningPracticeSnapshotSchema,
    ListeningSourceInputSchema,
    CreateListeningSessionInputSchema,
} from '@/lib/listening-contracts';

const validSource = {
    title: 'How AI Changes Technical Work',
    sourceType: 'video' as const,
    sourceUrl: 'https://example.com/video',
    transcript: 'A'.repeat(500),
    difficulty: 'B1-B2' as const,
};

const validExercise = {
    topic: 'AI in technical work',
    mainIdeaQuestion:
        "What is the speaker's main point?",
    detailQuestions: [
        'What change does the speaker describe?',
        'Why does the speaker think it matters?',
    ],
    usefulPhrases: [
        'from my perspective',
        'the main challenge is',
        'a practical next step',
    ],
    vocabulary: [
        {
            term: 'workflow',
            meaning: 'a sequence of work steps',
        },
        {
            term: 'automation',
            meaning: 'using technology to perform tasks',
        },
        {
            term: 'trade-off',
            meaning:
                'a balance between competing advantages',
        },
    ],
    summaryPrompt:
        'Summarize the main point and two important details.',
};

describe('ListeningSourceInputSchema', () => {
    it('accepts a valid source without a URL', () => {
        const result = ListeningSourceInputSchema.parse({
            ...validSource,
            sourceUrl: '',
        });

        expect(result.sourceUrl).toBeUndefined();
    });

    it('rejects transcripts that are too short', () => {
        const result =
            ListeningSourceInputSchema.safeParse({
                ...validSource,
                transcript: 'Too short',
            });

        expect(result.success).toBe(false);
    });

    it('rejects transcripts that are too long', () => {
        const result =
            ListeningSourceInputSchema.safeParse({
                ...validSource,
                transcript: 'A'.repeat(20_001),
            });

        expect(result.success).toBe(false);
    });

    it('rejects non-HTTP source URLs', () => {
        const result =
            ListeningSourceInputSchema.safeParse({
                ...validSource,
                sourceUrl: 'file:///private/transcript.txt',
            });

        expect(result.success).toBe(false);
    });
});

describe('GeneratedListeningExerciseSchema', () => {
    it('accepts a valid generated exercise', () => {
        const result =
            GeneratedListeningExerciseSchema.safeParse(
                validExercise
            );

        expect(result.success).toBe(true);
    });

    it('requires two or three detail questions', () => {
        const tooFew =
            GeneratedListeningExerciseSchema.safeParse({
                ...validExercise,
                detailQuestions: ['Only one question'],
            });

        const tooMany =
            GeneratedListeningExerciseSchema.safeParse({
                ...validExercise,
                detailQuestions: [
                    'Question one?',
                    'Question two?',
                    'Question three?',
                    'Question four?',
                ],
            });

        expect(tooFew.success).toBe(false);
        expect(tooMany.success).toBe(false);
    });

    it('requires three to five phrases and vocabulary items', () => {
        const tooFewPhrases =
            GeneratedListeningExerciseSchema.safeParse({
                ...validExercise,
                usefulPhrases: ['one', 'two'],
            });

        const tooManyVocabulary =
            GeneratedListeningExerciseSchema.safeParse({
                ...validExercise,
                vocabulary: [
                    ...validExercise.vocabulary,
                    {
                        term: 'four',
                        meaning: 'fourth item',
                    },
                    {
                        term: 'five',
                        meaning: 'fifth item',
                    },
                    {
                        term: 'six',
                        meaning: 'sixth item',
                    },
                ],
            });

        expect(tooFewPhrases.success).toBe(false);
        expect(tooManyVocabulary.success).toBe(false);
    });
});

describe('ListeningPracticeSnapshotSchema', () => {
    it('combines a valid source and exercise', () => {
        const result =
            ListeningPracticeSnapshotSchema.safeParse({
                source: validSource,
                exercise: validExercise,
            });

        expect(result.success).toBe(true);
    });

    it('requires both source and exercise', () => {
        const result =
            ListeningPracticeSnapshotSchema.safeParse({
                source: validSource,
            });

        expect(result.success).toBe(false);
    });
});

describe(
    'CreateListeningSessionInputSchema',
    () => {
        it(
            'accepts legacy and custom session inputs',
            () => {
                const legacy =
                    CreateListeningSessionInputSchema.safeParse({
                        practiceId: 'team-picnic-ride',
                        answer:
                            'Daniel needs a ride to the picnic.',
                    });

                const custom =
                    CreateListeningSessionInputSchema.safeParse({
                        practiceSnapshot: {
                            source: validSource,
                            exercise: validExercise,
                        },
                        answer:
                            'The speaker explains how AI changes technical work.',
                    });

                expect(legacy.success).toBe(true);
                expect(custom.success).toBe(true);
            }
        );

        it(
            'rejects input without practice context',
            () => {
                const result =
                    CreateListeningSessionInputSchema.safeParse({
                        answer: 'My summary.',
                    });

                expect(result.success).toBe(false);
            }
        );

        it(
            'rejects ambiguous legacy and custom input',
            () => {
                const result =
                    CreateListeningSessionInputSchema.safeParse({
                        practiceId: 'team-picnic-ride',
                        practiceSnapshot: {
                            source: validSource,
                            exercise: validExercise,
                        },
                        answer: 'My summary.',
                    });

                expect(result.success).toBe(false);
            }
        );
    }
);