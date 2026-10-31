import { describe, expect, it } from 'vitest';
import { validateAnalysisEvidence } from '@/lib/evidence-validation';
import { buildClaimVerificationInputs, VerifyClaimInputSchema } from '@/lib/claim-verification';
import { EvidenceBackedReflectionAnalysisSchema } from '@/lib/reflection-analysis';
import {
    currentReflection,
    generatedAnalysis,
    overgeneralizationFixture,
    retrievedReflections,
} from './fixtures/citation-vs-support.synthetic';

describe('synthetic citation validity versus semantic support', () => {
    it('retains the overgeneralized claim with valid IDs and exact excerpts', () => {
        const analysis = EvidenceBackedReflectionAnalysisSchema.parse(generatedAnalysis);
        const result = validateAnalysisEvidence(analysis, currentReflection, retrievedReflections);
        expect(result.removedEvidenceCount).toBe(0);
        expect(result.analysis.status).toBe('insights_found');
        expect(result.analysis.insights).toHaveLength(1);
        expect(result.analysis.insights[0].pattern).toBe(overgeneralizationFixture.input.claim.claim);
        expect(result.analysis.insights[0].confidence).toBe('low');
    });

    it.each(['unknown-id', 'invented-excerpt'] as const)(
        'rejects historical citation corruption: %s', (corruption) => {
            const analysis = structuredClone(generatedAnalysis);
            const evidence = analysis.insights[0].evidence[0];
            if (corruption === 'unknown-id') evidence.reflectionId = 'syn-demo-missing';
            else evidence.excerpt = 'An invented excerpt absent from the source.';
            const result = validateAnalysisEvidence(analysis, currentReflection, retrievedReflections);
            expect(result.removedEvidenceCount).toBe(1);
            expect(result.analysis.status).toBe('insufficient_evidence');
            expect(result.analysis.insights).toEqual([]);
        }
    );

    it('preserves the existing claim contract and expected human label only', () => {
        const result = validateAnalysisEvidence(generatedAnalysis, currentReflection, retrievedReflections);
        const input = buildClaimVerificationInputs(result.analysis.insights[0], 0)[0];
        expect(VerifyClaimInputSchema.parse(input)).toEqual(overgeneralizationFixture.input);
        // This assertion checks fixture metadata, not semantic inference or model accuracy.
        expect(overgeneralizationFixture.expectedStatus).toBe('unsupported');
    });
});
