import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

import {
  describe,
  expect,
  it,
} from 'vitest';

import { z } from 'zod';

import {
  v3Case5RunLabels,
  type V3Case5RunLabel,
} from '@/evals/fixtures/v3-case-5-run-labels';

import {
  EvidenceBackedReflectionAnalysisSchema,
} from '@/lib/reflection-analysis';

import {
  buildClaimVerificationInputs,
  VerifyClaimInputSchema,
} from '@/lib/claim-verification';

import {
  verifyClaimSupport,
} from '@/lib/claim-support-verifier';

import type {
  SupportResult,
} from '@/lib/claim-verification';

const SavedRunResponseSchema = z.object({
  analysis: z.object({
    result:
      EvidenceBackedReflectionAnalysisSchema,
  }),
});

// readFileSync 只读取已经保存的原始响应。
// resolve(process.cwd(), ...) 要求从项目根目录运行。
// SavedRunResponseSchema 只提取评测需要的 analysis.result，忽略 HTTP metadata。
// 每个保存 run 当前有一个 Insight。
// 每个 Insight 生成两个 claims，因此总数应为：

function loadSavedRun(
  label: V3Case5RunLabel
) {
  const rawResponse = readFileSync(
    resolve(process.cwd(), label.responseFile),
    'utf8'
  );

  const response =
    SavedRunResponseSchema.parse(
      JSON.parse(rawResponse)
    );

  const claims =
    response.analysis.result.insights.flatMap(
      (insight, insightIndex) =>
        buildClaimVerificationInputs(
          insight,
          insightIndex
        )
    );

  return {
    ...label,
    claims,
  };
}

describe(
  'V3 Case 5 verifier evaluation inputs',
  () => {
    it('loads the ten frozen run labels', () => {
      expect(v3Case5RunLabels).toHaveLength(10);

      expect(
        v3Case5RunLabels.filter(
          ({ humanLabel }) =>
            humanLabel === 'needs_detection'
        )
      ).toHaveLength(8);

      expect(
        v3Case5RunLabels.filter(
          ({ humanLabel }) =>
            humanLabel === 'supported'
        )
      ).toHaveLength(2);
    });

    it('extracts twenty valid claim inputs', () => {
      const loadedRuns =
        v3Case5RunLabels.map(loadSavedRun);

      expect(
        loadedRuns.flatMap(
          ({ claims }) => claims
        )
      ).toHaveLength(20);

      for (const run of loadedRuns) {
        expect(run.claims).toHaveLength(2);

        for (const claim of run.claims) {
          expect(() =>
            VerifyClaimInputSchema.parse(claim)
          ).not.toThrow();
        }
      }
    });
  }
);


// unsupportedOrPartialCorrectlyDetected：True Positives，最多 8。
// supportedCorrectlyClassified：True Negatives，最多 2。
// falsePositives：Run 05/10 被错误报警。
// falseNegatives：八个失败 run 被错误放行，风险最高。
// unclassifiedRuns：至少一个 verifier 调用失败。
// structuredOutputFailures：Zod、无结构结果或 claim ID 错误。
// otherCallFailures：配置、网络、限流等失败。

type ClaimEvaluation = {
  claimId: string;
  status:
  | SupportResult['status']
  | 'error';
  reason: string;
  durationMs: number;
  failureKind:
  | 'structured_output'
  | 'other'
  | null;
};

type VerifierRunLabel =
  | 'supported'
  | 'needs_detection'
  | 'unclassified';

function isStructuredOutputFailure(
  error: unknown
): boolean {
  if (error instanceof z.ZodError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('结构化') ||
    error.message.includes('claimId')
  );
}

const runRealV3Evaluation =
  process.env.RUN_REAL_V3_VERIFIER_EVAL ===
  'true';

const describeRealV3Evaluation =
  runRealV3Evaluation
    ? describe
    : describe.skip;

describeRealV3Evaluation(
  'real V3 Case 5 verifier evaluation',
  () => {
    it(
      'calculates run-level detection metrics',
      async () => {
        const loadedRuns =
          v3Case5RunLabels.map(loadSavedRun);

        const evaluations = [];

        for (const run of loadedRuns) {
          const claimResults:
            ClaimEvaluation[] = [];

          for (const input of run.claims) {
            const startedAt = Date.now();

            try {
              const result =
                await verifyClaimSupport(input);

              claimResults.push({
                claimId: result.claimId,
                status: result.status,
                reason: result.reason,
                durationMs:
                  Date.now() - startedAt,
                failureKind: null,
              });
            } catch (error) {
              claimResults.push({
                claimId:
                  input.claim.claimId,
                status: 'error',
                reason:
                  error instanceof Error
                    ? error.message
                    : 'Unknown verifier error',
                durationMs:
                  Date.now() - startedAt,
                failureKind:
                  isStructuredOutputFailure(error)
                    ? 'structured_output'
                    : 'other',
              });
            }
          }

          const hasCallFailure =
            claimResults.some(
              ({ status }) =>
                status === 'error'
            );

          const verifierLabel:
            VerifierRunLabel =
            hasCallFailure
              ? 'unclassified'
              : claimResults.some(
                ({ status }) =>
                  status === 'partial' ||
                  status === 'unsupported'
              )
                ? 'needs_detection'
                : 'supported';

          evaluations.push({
            run: run.run,
            humanLabel: run.humanLabel,
            verifierLabel,
            note: run.note,
            claimResults,
          });
        }

        const allClaimResults =
          evaluations.flatMap(
            ({ claimResults }) =>
              claimResults
          );

        const metrics = {
          totalRuns: evaluations.length,
          totalClaimCalls:
            allClaimResults.length,

          unsupportedOrPartialCorrectlyDetected:
            evaluations.filter(
              ({ humanLabel, verifierLabel }) =>
                humanLabel ===
                'needs_detection' &&
                verifierLabel ===
                'needs_detection'
            ).length,

          supportedCorrectlyClassified:
            evaluations.filter(
              ({ humanLabel, verifierLabel }) =>
                humanLabel ===
                'supported' &&
                verifierLabel ===
                'supported'
            ).length,

          falsePositives:
            evaluations.filter(
              ({ humanLabel, verifierLabel }) =>
                humanLabel ===
                'supported' &&
                verifierLabel ===
                'needs_detection'
            ).length,

          falseNegatives:
            evaluations.filter(
              ({ humanLabel, verifierLabel }) =>
                humanLabel ===
                'needs_detection' &&
                verifierLabel ===
                'supported'
            ).length,

          unclassifiedRuns:
            evaluations.filter(
              ({ verifierLabel }) =>
                verifierLabel ===
                'unclassified'
            ).length,

          structuredOutputFailures:
            allClaimResults.filter(
              ({ failureKind }) =>
                failureKind ===
                'structured_output'
            ).length,

          otherCallFailures:
            allClaimResults.filter(
              ({ failureKind }) =>
                failureKind === 'other'
            ).length,

          averageClaimDurationMs:
            Math.round(
              allClaimResults.reduce(
                (total, result) =>
                  total +
                  result.durationMs,
                0
              ) /
              allClaimResults.length
            ),
        };

        console.info(
          'V3 verifier run evaluations:\n' +
          JSON.stringify(
            evaluations,
            null,
            2
          )
        );

        console.info(
          'V3 verifier metrics:\n' +
          JSON.stringify(
            metrics,
            null,
            2
          )
        );

        expect(metrics.totalClaimCalls).toBe(
          20
        );

        expect(
          metrics.structuredOutputFailures
        ).toBe(0);

        expect(
          metrics.otherCallFailures
        ).toBe(0);
      },
      180_000
    );
  }
);