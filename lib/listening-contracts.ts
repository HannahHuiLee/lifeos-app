import { z } from 'zod';

const OptionalHttpUrlSchema = z.preprocess(
    (value) => {
        if (
            typeof value === 'string' &&
            value.trim() === ''
        ) {
            return undefined;
        }

        return value;
    },
    z
        .string()
        .trim()
        .url()
        .refine(
            (value) => {
                const protocol = new URL(value).protocol;

                return (
                    protocol === 'http:' ||
                    protocol === 'https:'
                );
            },
            {
                message: 'sourceUrl must use http or https',
            }
        )
        .optional()
);

export const ListeningSourceInputSchema = z.object({
    title: z.string().trim().min(1).max(120),

    sourceType: z.enum([
        'video',
        'podcast',
        'audio',
        'other',
    ]),

    sourceUrl: OptionalHttpUrlSchema,

    transcript: z
        .string()
        .trim()
        .min(200)
        .max(20_000),

    difficulty: z.enum([
        'B1',
        'B1-B2',
        'B2',
    ]),
});

const VocabularyItemSchema = z.object({
    term: z.string().trim().min(1).max(80),
    meaning: z.string().trim().min(1).max(200),
});

export const GeneratedListeningExerciseSchema =
    z.object({
        topic: z.string().trim().min(1).max(120),

        mainIdeaQuestion: z
            .string()
            .trim()
            .min(1)
            .max(240),

        detailQuestions: z
            .array(
                z.string().trim().min(1).max(240)
            )
            .min(2)
            .max(3),

        usefulPhrases: z
            .array(
                z.string().trim().min(1).max(160)
            )
            .min(3)
            .max(5),

        vocabulary: z
            .array(VocabularyItemSchema)
            .min(3)
            .max(5),

        summaryPrompt: z
            .string()
            .trim()
            .min(1)
            .max(300),
    });

export const ListeningPracticeSnapshotSchema =
    z.object({
        source: ListeningSourceInputSchema,
        exercise: GeneratedListeningExerciseSchema,
    });

const ListeningAnswerSchema = z
    .string()
    .trim()
    .min(1)
    .max(5_000);

export const CreateListeningSessionInputSchema =
    z.union([
        // V1 legacy practice
        z.object({
            practiceId: z.string().trim().min(1),
            practiceSnapshot: z.never().optional(),
            answer: ListeningAnswerSchema,
        }),

        // V2 custom practice
        z.object({
            practiceId: z.never().optional(),
            practiceSnapshot:
                ListeningPracticeSnapshotSchema,
            learningUnitId: z
                .string()
                .trim()
                .min(1)
                .optional(),
            answer: ListeningAnswerSchema,
        }),
    ]);

export type ListeningSourceInput = z.infer<
    typeof ListeningSourceInputSchema
>;

export type GeneratedListeningExercise = z.infer<
    typeof GeneratedListeningExerciseSchema
>;

export type ListeningPracticeSnapshot = z.infer<
    typeof ListeningPracticeSnapshotSchema
>;

export type CreateListeningSessionInput =
  z.infer<
    typeof CreateListeningSessionInputSchema
  >;
