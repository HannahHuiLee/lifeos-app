import { buildClaimVerificationInputs } from '@/lib/claim-verification';
import type { EvidenceBackedReflectionAnalysis } from '@/lib/reflection-analysis';
import type { RetrievedReflection } from '@/lib/reflection-retrieval';
import type { LabeledClaimFixture } from './claim-verification';

// Entirely invented records and generated claims; no database or saved-run input.
export const currentReflection = {
    id: 'syn-demo-current',
    content: 'In this fictional session, I completed one paper model at the quiet desk.',
};

export const retrievedReflections: RetrievedReflection[] = [{
    id: 'syn-demo-history',
    createdAt: new Date('2026-01-01T09:00:00.000Z'),
    content: 'In an earlier fictional session, I completed one paper model at the quiet desk.',
}];

export const generatedAnalysis: EvidenceBackedReflectionAnalysis = {
    status: 'insights_found',
    insights: [{
        pattern: 'I complete every paper model I attempt at the quiet desk, without exception.',
        interpretation: 'These two entries describe completed paper models at the quiet desk.',
        currentEvidence: {
            reflectionId: currentReflection.id,
            excerpt: currentReflection.content,
        },
        evidence: [{
            reflectionId: retrievedReflections[0].id,
            excerpt: retrievedReflections[0].content,
        }],
        relationship: 'supports',
        confidence: 'high',
    }],
    insufficientEvidenceReason: null,
};

// Expected human annotation, NOT output from an executed semantic verifier.
export const overgeneralizationFixture: LabeledClaimFixture = {
    name: 'valid citations with an unsupported universal claim',
    expectedStatus: 'unsupported',
    input: buildClaimVerificationInputs(generatedAnalysis.insights[0], 0)[0],
};
