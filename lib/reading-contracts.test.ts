import { describe, expect, it } from 'vitest';
import { CreateReadingSessionInputSchema } from './reading-contracts';

describe('CreateReadingSessionInputSchema', () => {
    it('accepts valid input and trims surrounding whitespace', () => {
        const result = CreateReadingSessionInputSchema.safeParse({
            learningUnitId: '  unit-1  ',
            answer: '  The article explains a useful idea.  ',
        });

        expect(result.success).toBe(true);

        if (!result.success) {
            throw new Error('Expected valid reading input');
        }

        expect(result.data).toEqual({
            learningUnitId: 'unit-1',
            answer: 'The article explains a useful idea.',
        });
    });

    it('rejects missing required learningUnitId', () => {
        const result =
            CreateReadingSessionInputSchema.safeParse({
                answer: 'My summary.'
            });

        expect(result.success).toBe(false);
    });

    it('rejects a missing answer', () => {
        const result =
            CreateReadingSessionInputSchema.safeParse({
                learningUnitId: 'unit-1',
            });

        expect(result.success).toBe(false);
    });

    it('rejects a non-string learningUnitId', () => {
        const result = CreateReadingSessionInputSchema.safeParse({
            learningUnitId: 123,
            answer: 'My summary.',
        });

        expect(result.success).toBe(false);
    });

    it('rejects a null answer', () => {
        const result = CreateReadingSessionInputSchema.safeParse({
            learningUnitId: 'unit-1',
            answer: null,
        });

        expect(result.success).toBe(false);
    });

    it('rejects a whitespace-only learningUnitId', () => {
        const result = CreateReadingSessionInputSchema.safeParse({
            learningUnitId: '   ',
            answer: 'My summary.',
        });

        expect(result.success).toBe(false);
    });

    it('rejects a whitespace-only answer', () => {
        const result = CreateReadingSessionInputSchema.safeParse({
            learningUnitId: 'unit-1',
            answer: '   ',
        });

        expect(result.success).toBe(false);
    });

    it('accepts an answer with 5,000 characters', () => {
        const result =
            CreateReadingSessionInputSchema.safeParse({
                learningUnitId: '  unit-1  ',
                answer: 'a'.repeat(5_000)
            });

        expect(result.success).toBe(true);
    });

    it('rejects an answer longer than 5,000 characters', () => {
        const result =
            CreateReadingSessionInputSchema.safeParse({
                learningUnitId: '  unit-1  ',
                answer: 'a'.repeat(5_001)
            });

        expect(result.success).toBe(false);
    });

    it('rejects an extra practiceId field', () => {
        const result =
            CreateReadingSessionInputSchema.safeParse({
                learningUnitId: '  unit-1  ',
                answer: 'My summary.',
                practiceId: 'legacy-practice'
            });

        expect(result.success).toBe(false);
    });

    it('rejects an extra practiceSnapshot field', () => {
        const result =
            CreateReadingSessionInputSchema.safeParse({
                learningUnitId: '  unit-1  ',
                answer: 'My summary.',
                practiceSnapshot: {}
            });

        expect(result.success).toBe(false);
    });


});