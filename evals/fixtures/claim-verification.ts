import type {
  SupportResult,
  VerifyClaimInput,
} from '@/lib/claim-verification';

type EvidenceText = {
  reflectionId: string;
  excerpt: string;
};

export type LabeledClaimFixture = {
  name: string;
  expectedStatus: SupportResult['status'];
  input: VerifyClaimInput;
};


// supported：LifeOS、继续开发和 UI 都同时出现在 Current 与 Historical。
// 第一个 partial：共同开发 LifeOS/UI 的核心成立，但“都在星巴克”不成立。
// unsupported：Claim 的核心是双方都在星巴克专注三小时；Current 完全不支持这个核心关系。
// 第二个 partial：开发连续性存在，但一个 Historical source 不能证明历史中“多次”发生。
// createSupportsInput 只减少重复结构，不进行语义判断。
// expectedStatus 是人工标签；未来 verifier 不能修改它。
// Fixture 使用虚构但固定的 ID，避免依赖当前数据库状态。
function createSupportsInput({
  claimId,
  claim,
  current,
  historical,
}: {
  claimId: string;
  claim: string;
  current: EvidenceText;
  historical: EvidenceText[];
}): VerifyClaimInput {
  const evidence: VerifyClaimInput['evidence'] = [
    {
      source: 'current',
      ...current,
    },
    ...historical.map((item) => ({
      source: 'historical' as const,
      ...item,
    })),
  ];

  return {
    claim: {
      claimId,
      insightIndex: 0,
      kind: 'pattern',
      claim,
      relationship: 'supports',
      evidenceRefs: evidence.map(
        ({ source, reflectionId }) => ({
          source,
          reflectionId,
        })
      ),
    },
    evidence,
  };
}

export const claimVerificationFixtures:
  LabeledClaimFixture[] = [
    {
      name: 'supported shared LifeOS work',
      expectedStatus: 'supported',
      input: createSupportsInput({
        claimId: 'supported-shared-work',
        claim:
          '当前与历史都描述了继续开发 LifeOS 并完成 Evidence-backed Reflection UI。',
        current: {
          reflectionId: 'current-supported',
          excerpt:
            '今天继续开发 LifeOS，并完成了 Evidence-backed Reflection 的 UI。',
        },
        historical: [
          {
            reflectionId: 'historical-supported',
            excerpt:
              '昨天继续开发 LifeOS，并完成了 Evidence-backed Reflection 的 UI。',
          },
        ],
      }),
    },
    {
      name: 'partial historical-only location',
      expectedStatus: 'partial',
      input: createSupportsInput({
        claimId: 'partial-location',
        claim:
          '当前与历史都在星巴克继续开发 LifeOS 并完成 UI。',
        current: {
          reflectionId: 'current-partial',
          excerpt:
            '今天继续开发 LifeOS，并完成了 UI。',
        },
        historical: [
          {
            reflectionId: 'historical-partial',
            excerpt:
              '昨天在星巴克继续开发 LifeOS，并完成了 UI。',
          },
        ],
      }),
    },
    {
      name: 'unsupported Case 5 attribution',
      expectedStatus: 'unsupported',
      input: createSupportsInput({
        claimId: 'unsupported-case-5',
        claim:
          '当前与历史都在星巴克专注工作了三个小时。',
        current: {
          reflectionId: 'current-case-5',
          excerpt:
            '今天继续开发 LifeOS，主要是在修复证据验证和 UI。',
        },
        historical: [
          {
            reflectionId: 'historical-case-5',
            excerpt:
              '今天又去星巴克做 LifeOS。我在那里专注了三个小时。',
          },
        ],
      }),
    },
    {
      name: 'partial repeated claim with one source',
      expectedStatus: 'partial',
      input: createSupportsInput({
        claimId: 'partial-repeated',
        claim:
          '历史中曾多次开发 LifeOS，当前再次延续这一模式。',
        current: {
          reflectionId: 'current-repeated',
          excerpt:
            '今天继续开发 LifeOS。',
        },
        historical: [
          {
            reflectionId: 'historical-repeated',
            excerpt:
              '昨天开发了 LifeOS。',
          },
        ],
      }),
    },
  ];