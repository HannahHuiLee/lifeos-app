import { z } from 'zod';


const ReadingAnswerSchema = z
    .string()
    .trim()
    .min(1)
    .max(5_000);

export const CreateReadingSessionInputSchema =
    z.strictObject({
        learningUnitId: z.string().trim().min(1),
        answer: ReadingAnswerSchema,
    });

export type CreateReadingSessionInput =
    z.infer<
        typeof CreateReadingSessionInputSchema
    >;