import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  buildClaimVerificationInputs,
  VerifyClaimInputSchema,
} from '@/lib/claim-verification';

import {
  claimVerificationFixtures,
} from '@/evals/fixtures/claim-verification';

import type {
  EvidenceBackedInsight,
} from '@/lib/reflection-analysis';

const insight: EvidenceBackedInsight = {
  pattern:
    '当前与历史都在持续开发 LifeOS。',
  interpretation:
    '这些记录显示项目开发仍在继续。',
  currentEvidence: {
    reflectionId: 'current-1',
    excerpt: '今天继续开发 LifeOS。',
  },
  evidence: [
    {
      reflectionId: 'historical-1',
      excerpt: '昨天开发了 LifeOS。',
    },
    {
      reflectionId: 'historical-2',
      excerpt: '上周继续开发 LifeOS。',
    },
  ],
  relationship: 'supports',
  confidence: 'medium',
};

describe('buildClaimVerificationInputs', () => {
  it('creates the pattern claim', () => {
    const result =
      buildClaimVerificationInputs(insight, 2);

    expect(result[0]?.claim).toMatchObject({
      claimId: 'insight-2-pattern',
      insightIndex: 2,
      kind: 'pattern',
      claim: insight.pattern,
      relationship: 'supports',
    });
  });

  it('creates the interpretation claim', () => {
    const result =
      buildClaimVerificationInputs(insight, 2);

    expect(result[1]?.claim).toMatchObject({
      claimId: 'insight-2-interpretation',
      insightIndex: 2,
      kind: 'interpretation',
      claim: insight.interpretation,
      relationship: 'supports',
    });
  });

  it('preserves current and historical source labels', () => {
    const result =
      buildClaimVerificationInputs(insight, 2);

    for (const input of result) {
      expect(
        input.evidence.map(
          (item) => item.source
        )
      ).toEqual([
        'current',
        'historical',
        'historical',
      ]);

      expect(
        input.claim.evidenceRefs.map(
          (item) => item.source
        )
      ).toEqual([
        'current',
        'historical',
        'historical',
      ]);
    }
  });

  it('includes exactly the evidence attached to the Insight', () => {
    const result =
      buildClaimVerificationInputs(insight, 2);

    for (const input of result) {
      expect(
        input.evidence.map(
          (item) => item.reflectionId
        )
      ).toEqual([
        'current-1',
        'historical-1',
        'historical-2',
      ]);
    }
  });
});

// 参数化测试会针对四个 fixture 分别确认：
// - 输入能通过 VerifyClaimInputSchema；
// - evidenceRefs 与实际 Evidence 的 source/ID 完全一致；
// - 恰好有一个 Current source；
// - 至少有一个 Historical source。
// 第二个测试冻结人工标签。如果以后有人意外把 Case 5 从 unsupported 改成 supported，测试会立刻失败。
describe('claimVerificationFixtures', () => {
  it.each(claimVerificationFixtures)(
    'keeps $name structurally valid',
    ({ input }) => {
      expect(() =>
        VerifyClaimInputSchema.parse(input)
      ).not.toThrow();

      const actualRefs = input.evidence.map(
        ({ source, reflectionId }) => ({
          source,
          reflectionId,
        })
      );

      expect(input.claim.evidenceRefs).toEqual(
        actualRefs
      );

      expect(
        input.evidence.filter(
          (item) => item.source === 'current'
        )
      ).toHaveLength(1);

      expect(
        input.evidence.filter(
          (item) => item.source === 'historical'
        ).length
      ).toBeGreaterThanOrEqual(1);
    }
  );

  it('keeps the manual semantic labels frozen', () => {
    expect(
      claimVerificationFixtures.map(
        ({ name, expectedStatus }) => ({
          name,
          expectedStatus,
        })
      )
    ).toEqual([
      {
        name: 'supported shared LifeOS work',
        expectedStatus: 'supported',
      },
      {
        name:
          'partial historical-only location',
        expectedStatus: 'partial',
      },
      {
        name:
          'unsupported Case 5 attribution',
        expectedStatus: 'unsupported',
      },
      {
        name:
          'partial repeated claim with one source',
        expectedStatus: 'partial',
      },
    ]);
  });
});