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
  findHistoricalCardinalityViolation,
  VerifyClaimInputSchema,
} from '@/lib/claim-verification';

import {
  verifyClaimSupport,
} from '@/lib/claim-support-verifier';

import type {
  SupportResult,
} from '@/lib/claim-verification';

import {
  buildAtomicClaimVerificationInput,
  v3Case5AtomicClaimFixtures,
} from '@/evals/fixtures/v3-case-5-atomic-claims';

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

  const labeledClaims =
    claims.map((input, claimIndex) => {
      const groundTruth =
        label.claimLabels[claimIndex];

      if (
        !groundTruth ||
        input.claim.kind !== groundTruth.kind
      ) {
        throw new Error(
          `Claim label mismatch in run ${label.run} ` +
          `at index ${claimIndex}`
        );
      }

      return {
        input,
        groundTruth,
      };
    });

  return {
    ...label,
    claims,
    labeledClaims,
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

    // 它防止：
    // - 某个 run 漏掉 Pattern 或 Interpretation；
    // - 同一个 kind 被重复标注；
    // - 标签顺序和 buildClaimVerificationInputs 输出顺序不一致；
    // - 我们误以为已经完成 20 条标注，实际数量不足。
    it('loads claim-level ground truth for all twenty claims', () => {
      const allClaimLabels =
        v3Case5RunLabels.flatMap((run) => {
          const claimLabels =
            'claimLabels' in run &&
              Array.isArray(run.claimLabels)
              ? run.claimLabels
              : [];

          expect(claimLabels).toHaveLength(2);

          expect(
            claimLabels.map(({ kind }) => kind)
          ).toEqual([
            'pattern',
            'interpretation',
          ]);

          return claimLabels;
        });

      expect(allClaimLabels).toHaveLength(20);
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

    it('pairs every claim with matching ground truth', () => {
      const loadedRuns =
        v3Case5RunLabels.map(loadSavedRun);

      expect(
        loadedRuns.flatMap(
          ({ labeledClaims }) =>
            labeledClaims
        )
      ).toHaveLength(20);

      for (const run of loadedRuns) {
        for (
          const {
            input,
            groundTruth,
          } of run.labeledClaims
        ) {
          expect(input.claim.kind).toBe(
            groundTruth.kind
          );
        }

        const derivedHumanLabel =
          run.labeledClaims.some(
            ({ groundTruth }) =>
              groundTruth.expectedStatus !==
              'supported'
          )
            ? 'needs_detection'
            : 'supported';

        expect(derivedHumanLabel).toBe(
          run.humanLabel
        );
      }
    });

    it('detects the five frozen historical cardinality failures', () => {
      const checks =
        v3Case5RunLabels.flatMap(
          (label) => {
            const run = loadSavedRun(label);

            return run.labeledClaims.map(
              ({ input, groundTruth }) => ({
                key:
                  `${run.run}-${input.claim.kind}`,
                expectedViolation:
                  groundTruth.failureTypes.includes(
                    'quantity/cardinality'
                  ),
                actualViolation:
                  findHistoricalCardinalityViolation(
                    input
                  ),
              })
            );
          }
        );

      const expectedKeys =
        checks
          .filter(
            ({ expectedViolation }) =>
              expectedViolation
          )
          .map(({ key }) => key);

      const detectedKeys =
        checks
          .filter(
            ({ actualViolation }) =>
              actualViolation !== null
          )
          .map(({ key }) => key);

      expect(expectedKeys).toEqual([
        '01-pattern',
        '02-interpretation',
        '03-interpretation',
        '06-interpretation',
        '08-interpretation',
      ]);

      expect(detectedKeys).toEqual(
        expectedKeys
      );

      for (const check of checks) {
        expect(
          check.actualViolation !== null
        ).toBe(check.expectedViolation);
      }
    });

    it('builds ten atomic inputs with only their target evidence', () => {
      expect(
        v3Case5AtomicClaimFixtures
      ).toHaveLength(10);

      expect(
        v3Case5AtomicClaimFixtures.filter(
          ({ expectedStatus }) =>
            expectedStatus === 'unsupported'
        )
      ).toHaveLength(5);

      expect(
        v3Case5AtomicClaimFixtures.filter(
          ({ expectedStatus }) =>
            expectedStatus === 'supported'
        )
      ).toHaveLength(5);

      for (
        const fixture of
        v3Case5AtomicClaimFixtures
      ) {
        const runLabel =
          v3Case5RunLabels.find(
            ({ run }) =>
              run === fixture.run
          );

        if (!runLabel) {
          throw new Error(
            `Run ${fixture.run} was not found`
          );
        }

        const loadedRun =
          loadSavedRun(runLabel);

        const parent =
          loadedRun.labeledClaims.find(
            ({ input }) =>
              input.claim.kind ===
              fixture.parentKind
          );

        if (!parent) {
          throw new Error(
            `Parent claim for ${fixture.atomicClaimId} was not found`
          );
        }

        const atomicInput =
          buildAtomicClaimVerificationInput(
            fixture,
            parent.input
          );

        expect(() =>
          VerifyClaimInputSchema.parse(
            atomicInput
          )
        ).not.toThrow();

        expect(atomicInput.claim).toMatchObject({
          claimId:
            fixture.atomicClaimId,
          kind: fixture.parentKind,
          scope: fixture.scope,
          claim: fixture.claim,
        });

        const expectedKeys =
          fixture.targetEvidenceRefs
            .map(
              ({ source, reflectionId }) =>
                `${source}:${reflectionId}`
            )
            .sort();

        const actualReferenceKeys =
          atomicInput.claim.evidenceRefs
            .map(
              ({ source, reflectionId }) =>
                `${source}:${reflectionId}`
            )
            .sort();

        const actualEvidenceKeys =
          atomicInput.evidence
            .map(
              ({ source, reflectionId }) =>
                `${source}:${reflectionId}`
            )
            .sort();

        expect(actualReferenceKeys).toEqual(
          expectedKeys
        );

        expect(actualEvidenceKeys).toEqual(
          expectedKeys
        );

        expect(atomicInput.evidence).toHaveLength(
          fixture.targetEvidenceRefs.length
        );

        for (
          const evidence of
          atomicInput.evidence
        ) {
          const parentEvidence =
            parent.input.evidence.find(
              ({ source, reflectionId }) =>
                source === evidence.source &&
                reflectionId ===
                evidence.reflectionId
            );

          expect(evidence.excerpt).toBe(
            parentEvidence?.excerpt
          );
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
  kind: 'pattern' | 'interpretation';
  expectedStatus:
  SupportResult['status'];
  failureTypes: readonly string[];
  humanNote: string;
  deterministicViolation:
  ReturnType<
    typeof findHistoricalCardinalityViolation
  >;
  status:
  | SupportResult['status']
  | 'error';
  reason: string;
  sourceAssessments:
  | SupportResult['sourceAssessments']
  | null;
  durationMs: number;
  failureKind:
  | 'structured_output'
  | 'other'
  | null;
};


// (human expectedStatus) vs (verifier actual status)
type ClaimClassification = Pick<
  ClaimEvaluation,
  'expectedStatus' | 'status'
>;

type ClaimSignalClassification = {
  expectedStatus:
  SupportResult['status'];
  semanticStatus:
  | SupportResult['status']
  | 'error';
  deterministicDetected: boolean;
};

function calculateClaimDetectionMetrics(
  results: ClaimClassification[]
) {
  const needsDetection = (
    status: SupportResult['status']
  ) => status !== 'supported';

  const wasDetected = (
    status: ClaimEvaluation['status']
  ) =>
    status === 'partial' ||
    status === 'unsupported';

  return {
    totalClaims: results.length,

    claimsNeedingDetection:
      results.filter(
        ({ expectedStatus }) =>
          needsDetection(expectedStatus)
      ).length,

    supportedClaims:
      results.filter(
        ({ expectedStatus }) =>
          expectedStatus === 'supported'
      ).length,

    unsupportedOrPartialCorrectlyDetected:
      results.filter(
        ({ expectedStatus, status }) =>
          needsDetection(expectedStatus) &&
          wasDetected(status)
      ).length,

    supportedCorrectlyClassified:
      results.filter(
        ({ expectedStatus, status }) =>
          expectedStatus === 'supported' &&
          status === 'supported'
      ).length,

    falsePositives:
      results.filter(
        ({ expectedStatus, status }) =>
          expectedStatus === 'supported' &&
          wasDetected(status)
      ).length,

    falseNegatives:
      results.filter(
        ({ expectedStatus, status }) =>
          needsDetection(expectedStatus) &&
          status === 'supported'
      ).length,

    unclassifiedClaims:
      results.filter(
        ({ status }) =>
          status === 'error'
      ).length,
  };
}

function calculateClaimSignalMetrics(
  results: ClaimSignalClassification[]
) {
  type DetectionSignal = {
    detected: boolean;
    unclassified: boolean;
  };

  const summarize = (
    getSignal: (
      result: ClaimSignalClassification
    ) => DetectionSignal
  ) => ({
    correctlyDetected:
      results.filter((result) => {
        const signal = getSignal(result);

        return (
          result.expectedStatus !==
          'supported' &&
          signal.detected
        );
      }).length,

    correctlyNotDetected:
      results.filter((result) => {
        const signal = getSignal(result);

        return (
          result.expectedStatus ===
          'supported' &&
          !signal.detected &&
          !signal.unclassified
        );
      }).length,

    falsePositives:
      results.filter((result) => {
        const signal = getSignal(result);

        return (
          result.expectedStatus ===
          'supported' &&
          signal.detected
        );
      }).length,

    falseNegatives:
      results.filter((result) => {
        const signal = getSignal(result);

        return (
          result.expectedStatus !==
          'supported' &&
          !signal.detected &&
          !signal.unclassified
        );
      }).length,

    unclassified:
      results.filter(
        (result) =>
          getSignal(result).unclassified
      ).length,
  });

  const semanticSignal = (
    result: ClaimSignalClassification
  ): DetectionSignal => ({
    detected:
      result.semanticStatus ===
      'partial' ||
      result.semanticStatus ===
      'unsupported',
    unclassified:
      result.semanticStatus === 'error',
  });

  return {
    totalClaims: results.length,

    claimsNeedingDetection:
      results.filter(
        ({ expectedStatus }) =>
          expectedStatus !== 'supported'
      ).length,

    supportedClaims:
      results.filter(
        ({ expectedStatus }) =>
          expectedStatus === 'supported'
      ).length,

    deterministic: summarize(
      ({ deterministicDetected }) => ({
        detected:
          deterministicDetected,
        unclassified: false,
      })
    ),

    semantic: summarize(
      semanticSignal
    ),

    combined: summarize((result) => {
      const semantic =
        semanticSignal(result);

      return {
        detected:
          result.deterministicDetected ||
          semantic.detected,
        unclassified:
          semantic.unclassified &&
          !result.deterministicDetected,
      };
    }),
  };
}

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
    error.message.includes('claimId') ||
    error.message.includes(
      'source assessments'
    )
  );
}

type AtomicClaimEvaluation = {
  run: string;
  atomicClaimId: string;
  parentKind:
  'pattern' | 'interpretation';
  scope:
  'shared' | 'source-specific';
  failureType: string | null;
  expectedStatus:
  SupportResult['status'];
  status:
  | SupportResult['status']
  | 'error';
  reason: string;
  sourceAssessments:
  | SupportResult['sourceAssessments']
  | null;
  durationMs: number;
  failureKind:
  | 'structured_output'
  | 'other'
  | null;
};

const runRealAtomicEvaluation =
  process.env
    .RUN_REAL_ATOMIC_VERIFIER_EVAL ===
  'true';

const describeRealAtomicEvaluation =
  runRealAtomicEvaluation
    ? describe
    : describe.skip;

describeRealAtomicEvaluation(
  'real atomic claim verifier evaluation',
  () => {
    it(
      'evaluates five failures and five supported controls',
      async () => {
        const evaluations:
          AtomicClaimEvaluation[] = [];

        for (
          const fixture of
          v3Case5AtomicClaimFixtures
        ) {
          const runLabel =
            v3Case5RunLabels.find(
              ({ run }) =>
                run === fixture.run
            );

          if (!runLabel) {
            throw new Error(
              `Run ${fixture.run} was not found`
            );
          }

          const loadedRun =
            loadSavedRun(runLabel);

          const parent =
            loadedRun.labeledClaims.find(
              ({ input }) =>
                input.claim.kind ===
                fixture.parentKind
            );

          if (!parent) {
            throw new Error(
              `Parent claim for ` +
              fixture.atomicClaimId +
              ` was not found`
            );
          }

          const input =
            buildAtomicClaimVerificationInput(
              fixture,
              parent.input
            );

          const startedAt = Date.now();

          try {
            const result =
              await verifyClaimSupport(
                input
              );

            evaluations.push({
              run: fixture.run,
              atomicClaimId:
                fixture.atomicClaimId,
              parentKind:
                fixture.parentKind,
              scope: fixture.scope,
              failureType:
                fixture.failureType,
              expectedStatus:
                fixture.expectedStatus,
              status: result.status,
              reason: result.reason,
              sourceAssessments:
                result.sourceAssessments,
              durationMs:
                Date.now() - startedAt,
              failureKind: null,
            });
          } catch (error) {
            evaluations.push({
              run: fixture.run,
              atomicClaimId:
                fixture.atomicClaimId,
              parentKind:
                fixture.parentKind,
              scope: fixture.scope,
              failureType:
                fixture.failureType,
              expectedStatus:
                fixture.expectedStatus,
              status: 'error',
              reason:
                error instanceof Error
                  ? error.message
                  : 'Unknown verifier error',
              sourceAssessments: null,
              durationMs:
                Date.now() - startedAt,
              failureKind:
                isStructuredOutputFailure(
                  error
                )
                  ? 'structured_output'
                  : 'other',
            });
          }
        }

        const detectionMetrics =
          calculateClaimDetectionMetrics(
            evaluations
          );

        const metrics = {
          ...detectionMetrics,

          exactStatusMatches:
            evaluations.filter(
              ({
                expectedStatus,
                status,
              }) =>
                status === expectedStatus
            ).length,

          structuredOutputFailures:
            evaluations.filter(
              ({ failureKind }) =>
                failureKind ===
                'structured_output'
            ).length,

          otherCallFailures:
            evaluations.filter(
              ({ failureKind }) =>
                failureKind === 'other'
            ).length,

          averageClaimDurationMs:
            Math.round(
              evaluations.reduce(
                (total, result) =>
                  total +
                  result.durationMs,
                0
              ) /
              evaluations.length
            ),
        };

        console.info(
          'Atomic verifier evaluations:\n' +
          JSON.stringify(
            evaluations,
            null,
            2
          )
        );

        console.info(
          'Atomic verifier metrics:\n' +
          JSON.stringify(
            metrics,
            null,
            2
          )
        );

        expect(
          metrics.totalClaims
        ).toBe(10);

        expect(
          metrics.claimsNeedingDetection
        ).toBe(5);

        expect(
          metrics.supportedClaims
        ).toBe(5);

        expect(
          metrics.structuredOutputFailures
        ).toBe(0);

        expect(
          metrics.otherCallFailures
        ).toBe(0);
      },
      120_000
    );
  }
);

const runRealV3Evaluation =
  process.env.RUN_REAL_V3_VERIFIER_EVAL ===
  'true';

describe(
  'claim-level detection metrics',
  () => {
    it('classifies TP, TN, FP, FN, and errors', () => {
      const results:
        ClaimClassification[] = [
          {
            expectedStatus: 'partial',
            status: 'partial',
          },
          {
            expectedStatus: 'unsupported',
            status: 'partial',
          },
          {
            expectedStatus: 'supported',
            status: 'supported',
          },
          {
            expectedStatus: 'supported',
            status: 'partial',
          },
          {
            expectedStatus: 'partial',
            status: 'supported',
          },
          {
            expectedStatus: 'partial',
            status: 'error',
          },
        ];

      expect(
        calculateClaimDetectionMetrics(
          results
        )
      ).toEqual({
        totalClaims: 6,
        claimsNeedingDetection: 4,
        supportedClaims: 2,
        unsupportedOrPartialCorrectlyDetected: 2,
        supportedCorrectlyClassified: 1,
        falsePositives: 1,
        falseNegatives: 1,
        unclassifiedClaims: 1,
      });
    });
  }
);

describe(
  'claim detection signals',
  () => {
    it('keeps deterministic, semantic, and combined metrics separate', () => {
      const results:
        ClaimSignalClassification[] = [
          {
            expectedStatus: 'partial',
            semanticStatus: 'supported',
            deterministicDetected: true,
          },
          {
            expectedStatus: 'partial',
            semanticStatus: 'partial',
            deterministicDetected: false,
          },
          {
            expectedStatus: 'supported',
            semanticStatus: 'partial',
            deterministicDetected: false,
          },
          {
            expectedStatus: 'supported',
            semanticStatus: 'supported',
            deterministicDetected: false,
          },
          {
            expectedStatus: 'partial',
            semanticStatus: 'error',
            deterministicDetected: true,
          },
          {
            expectedStatus: 'supported',
            semanticStatus: 'error',
            deterministicDetected: false,
          },
        ];

      expect(
        calculateClaimSignalMetrics(
          results
        )
      ).toEqual({
        totalClaims: 6,
        claimsNeedingDetection: 3,
        supportedClaims: 3,
        deterministic: {
          correctlyDetected: 2,
          correctlyNotDetected: 3,
          falsePositives: 0,
          falseNegatives: 1,
          unclassified: 0,
        },
        semantic: {
          correctlyDetected: 1,
          correctlyNotDetected: 1,
          falsePositives: 1,
          falseNegatives: 1,
          unclassified: 2,
        },
        combined: {
          correctlyDetected: 3,
          correctlyNotDetected: 1,
          falsePositives: 1,
          falseNegatives: 0,
          unclassified: 1,
        },
      });
    });
  }
);

const describeRealV3Evaluation =
  runRealV3Evaluation
    ? describe
    : describe.skip;

describeRealV3Evaluation(
  'real V3 Case 5 verifier evaluation',
  () => {
    it(
      'calculates run-level and claim-level detection metrics',
      async () => {
        const loadedRuns =
          v3Case5RunLabels.map(loadSavedRun);

        const evaluations = [];

        for (const run of loadedRuns) {
          const claimResults:
            ClaimEvaluation[] = [];

          for (
            const {
              input,
              groundTruth,
            } of run.labeledClaims
          ) {
            const deterministicViolation =
              findHistoricalCardinalityViolation(
                input
              );
            const startedAt = Date.now();

            try {
              const result =
                await verifyClaimSupport(input);
              claimResults.push({
                claimId: result.claimId,
                kind: input.claim.kind,
                expectedStatus:
                  groundTruth.expectedStatus,
                failureTypes:
                  groundTruth.failureTypes,
                humanNote: groundTruth.note,
                deterministicViolation,
                status: result.status,
                reason: result.reason,
                sourceAssessments:
                  result.sourceAssessments,
                durationMs:
                  Date.now() - startedAt,
                failureKind: null,
              });
            } catch (error) {
              claimResults.push({
                claimId:
                  input.claim.claimId,
                kind: input.claim.kind,
                expectedStatus:
                  groundTruth.expectedStatus,
                failureTypes:
                  groundTruth.failureTypes,
                humanNote: groundTruth.note,
                deterministicViolation,
                status: 'error',
                reason:
                  error instanceof Error
                    ? error.message
                    : 'Unknown verifier error',
                sourceAssessments: null,
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

        const claimMetrics =
          calculateClaimDetectionMetrics(
            allClaimResults
          );

        const signalMetrics =
          calculateClaimSignalMetrics(
            allClaimResults.map(
              ({
                expectedStatus,
                status,
                deterministicViolation,
              }) => ({
                expectedStatus,
                semanticStatus: status,
                deterministicDetected:
                  deterministicViolation !== null,
              })
            )
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

        console.info(
          'V3 verifier claim metrics:\n' +
          JSON.stringify(
            claimMetrics,
            null,
            2
          )
        );

        //这里的 V3 指冻结的 Grounding Reliability V3 Case 5 inputs。Verifier 本身已经是加入 per-source assessments 后的新迭代。
        console.info(
          'V3 verifier signal metrics:\n' +
          JSON.stringify(
            signalMetrics,
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

        expect(
          claimMetrics.totalClaims
        ).toBe(20);

        expect(
          claimMetrics.claimsNeedingDetection
        ).toBe(10);

        expect(
          claimMetrics.supportedClaims
        ).toBe(10);

        //冻结 Deterministic Baseline
        expect(
          signalMetrics.totalClaims
        ).toBe(20);

        expect(
          signalMetrics.claimsNeedingDetection
        ).toBe(10);

        expect(
          signalMetrics.supportedClaims
        ).toBe(10);

        expect(
          signalMetrics.deterministic
        ).toEqual({
          correctlyDetected: 5,
          correctlyNotDetected: 10,
          falsePositives: 0,
          falseNegatives: 5,
          unclassified: 0,
        });

      },
      180_000
    );
  }
);