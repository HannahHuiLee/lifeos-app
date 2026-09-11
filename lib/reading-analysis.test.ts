import { describe, expect, it } from 'vitest';
import { ReadingAnalysisSchema } from './reading-analysis';

// 每次返回新对象，避免测试之间互相影响。
function makeAnalysis() {
    return {
        mainIdea: {
            captured: true,
            feedback: 'You identified the main idea.',
        },
        missedKeyPoints: [],
        corrections: [],
        suggestedSummary: 'Regular practice helps people improve.',
    };
}

describe('ReadingAnalysisSchema', () => {
    it('accepts feedback with no omissions or corrections', () => {
        const result = ReadingAnalysisSchema.safeParse(makeAnalysis());

        expect(result.success).toBe(true);
    });

    it('accepts a correction paired with the learner claim', () => {
        const result = ReadingAnalysisSchema.safeParse({
            ...makeAnalysis(),
            corrections: [
                {
                    learnerClaim: 'Practice guarantees immediate success.',
                    correction:
                        'The text describes gradual improvement, not guaranteed immediate success.',
                },
            ],
        });

        expect(result.success).toBe(true);
    });

    it('trims feedback and summary text', () => {
        const result = ReadingAnalysisSchema.parse({
            ...makeAnalysis(),
            mainIdea: {
                captured: true,
                feedback: '  You identified the main idea.  ',
            },
            suggestedSummary: '  Regular practice helps people improve.  ',
        });

        expect(result.mainIdea.feedback).toBe(
            'You identified the main idea.'
        );
        expect(result.suggestedSummary).toBe(
            'Regular practice helps people improve.'
        );
    });

    it('rejects a correction without its learner claim', () => {
        const result = ReadingAnalysisSchema.safeParse({
            ...makeAnalysis(),
            corrections: [
                { correction: 'Improvement happens gradually.' },
            ],
        });

        expect(result.success).toBe(false);
    });

    it('rejects a learner claim without its correction', () => {
        const result = ReadingAnalysisSchema.safeParse({
            ...makeAnalysis(),
            corrections: [
                { learnerClaim: 'Success is immediate.' },
            ],
        });

        expect(result.success).toBe(false);
    });

    it('rejects a string in place of the captured boolean', () => {
        const result = ReadingAnalysisSchema.safeParse({
            ...makeAnalysis(),
            mainIdea: {
                captured: 'true',
                feedback: 'You identified the main idea.',
            },
        });

        expect(result.success).toBe(false);
    });

    it('rejects whitespace-only feedback', () => {
        const result = ReadingAnalysisSchema.safeParse({
            ...makeAnalysis(),
            mainIdea: {
                captured: true,
                feedback: '   ',
            },
        });

        expect(result.success).toBe(false);
    });

    it('rejects a whitespace-only summary', () => {
        const result = ReadingAnalysisSchema.safeParse({
            ...makeAnalysis(),
            suggestedSummary: '   ',
        });

        expect(result.success).toBe(false);
    });

    it.each([
        { count: 3, expectedSuccess: true },
        { count: 4, expectedSuccess: false },
    ])(
        'validates $count missed key points',
        ({ count, expectedSuccess }) => {
            const result = ReadingAnalysisSchema.safeParse({
                ...makeAnalysis(),
                missedKeyPoints: Array.from(
                    { length: count },
                    (_, index) => `Important point ${index + 1}.`
                ),
            });

            expect(result.success).toBe(expectedSuccess);
        }
    );

    it.each([
        { count: 3, expectedSuccess: true },
        { count: 4, expectedSuccess: false },
    ])(
        'validates $count corrections',
        ({ count, expectedSuccess }) => {
            const result = ReadingAnalysisSchema.safeParse({
                ...makeAnalysis(),
                corrections: Array.from(
                    { length: count },
                    (_, index) => ({
                        learnerClaim: `Incorrect claim ${index + 1}.`,
                        correction: `Correction ${index + 1}.`,
                    })
                ),
            });

            expect(result.success).toBe(expectedSuccess);
        }
    );

    it.each([
        { length: 2_000, expectedSuccess: true },
        { length: 2_001, expectedSuccess: false },
    ])(
        'validates a summary with $length characters',
        ({ length, expectedSuccess }) => {
            const result = ReadingAnalysisSchema.safeParse({
                ...makeAnalysis(),
                suggestedSummary: 'a'.repeat(length),
            });

            expect(result.success).toBe(expectedSuccess);
        }
    );

    it('rejects an unexpected top-level field', () => {
        const result = ReadingAnalysisSchema.safeParse({
            ...makeAnalysis(),
            understandingScore: 90,
        });

        expect(result.success).toBe(false);
    });

    it('rejects an unexpected field inside a correction', () => {
        const result = ReadingAnalysisSchema.safeParse({
            ...makeAnalysis(),
            corrections: [
                {
                    learnerClaim: 'Success is immediate.',
                    correction: 'Improvement happens gradually.',
                    confidence: 0.9,
                },
            ],
        });

        expect(result.success).toBe(false);
    });
});