import type {
  SupportResult,
  VerifyClaimInput,
} from '@/lib/claim-verification';

import {
  buildSyntheticVerifyClaimInput,
  syntheticCases,
} from '@/evals/fixtures/reflection-timeline.synthetic';

export type LabeledClaimFixture = {
  name: string;
  expectedStatus: SupportResult['status'];
  input: VerifyClaimInput;
};

function getSyntheticClaimInput(
  caseId: string
): VerifyClaimInput {
  const fixture =
    syntheticCases.find(
      ({ id }) => id === caseId
    );

  if (
    !fixture ||
    !('claim' in fixture)
  ) {
    throw new Error(
      `Synthetic claim case was not found: ${caseId}`
    );
  }

  return buildSyntheticVerifyClaimInput(
    fixture
  );
}

function replaceClaimText(
  input: VerifyClaimInput,
  claimId: string,
  claim: string
): VerifyClaimInput {
  return {
    ...input,
    claim: {
      ...input.claim,
      claimId,
      claim,
    },
  };
}

const historicalOnlyInput =
  getSyntheticClaimInput(
    'historical-only-attribution'
  );

const cardinalityInput =
  getSyntheticClaimInput(
    'quantity-cardinality'
  );

export const claimVerificationFixtures:
  LabeledClaimFixture[] = [
    {
      name:
        'supported shared synthetic project work',
      expectedStatus: 'supported',
      input: replaceClaimText(
        historicalOnlyInput,
        'supported-shared-project-work',
        '当前与历史记录都描述了继续开发 Orchid Notes 并处理 dashboard UI。'
      ),
    },
    {
      name:
        'partial historical-only synthetic location',
      expectedStatus: 'partial',
      input: replaceClaimText(
        historicalOnlyInput,
        'partial-historical-only-location',
        '当前与历史记录都描述了继续开发 Orchid Notes 和 dashboard UI，并且都在 Northstar Study Room 工作。'
      ),
    },
    {
      name:
        'unsupported synthetic historical-only attribution',
      expectedStatus: 'unsupported',
      input: historicalOnlyInput,
    },
    {
      name:
        'partial synthetic repeated claim with one source',
      expectedStatus: 'partial',
      input: cardinalityInput,
    },
  ];