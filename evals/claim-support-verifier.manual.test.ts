import {
    describe,
    expect,
    it,
} from 'vitest';

import {
    buildSyntheticVerifyClaimInput,
    syntheticCases,
} from '@/evals/fixtures/reflection-timeline.synthetic';

import {
    verifyClaimSupport,
} from '@/lib/claim-support-verifier';


// 默认使用 describe.skip，不会意外调用收费 API。
// 只有 RUN_REAL_CLAIM_VERIFIER=true 时才执行。
// 只选择一个 Case 5 fixture，不批量调用。
// expectedStatus 来自人工冻结标签。
// actualStatus 来自 Verifier。
// 当前测试只确定性断言 claimId，不把概率性的语义结果写成稳定单元测试。
// durationMs 是第一次真实延迟观测。
// 如果实际状态不是 unsupported，测试仍可能通过，但我们必须把它记录为 Verifier 语义错误。

const runRealVerifier =
    process.env.RUN_REAL_CLAIM_VERIFIER ===
    'true';

const describeRealVerifier =
    runRealVerifier ? describe : describe.skip;

describeRealVerifier(
    'real claim support verifier',
    () => {
        it(
            'checks the canonical synthetic historical-only attribution',
            async () => {
                const fixture =
                    syntheticCases.find(
                        ({ id }) =>
                            id ===
                            'historical-only-attribution'
                    );

                if (
                    !fixture ||
                    !('claim' in fixture)
                ) {
                    throw new Error(
                        'Synthetic historical-only attribution case was not found'
                    );
                }

                const input =
                    buildSyntheticVerifyClaimInput(
                        fixture
                    );

                const startedAt = Date.now();

                const result =
                    await verifyClaimSupport(
                        input
                    );

                const durationMs =
                    Date.now() - startedAt;

                console.info(
                    'Claim verifier manual result:',
                    {
                        fixture: fixture.id,
                        expectedStatus:
                            fixture.claim
                                .expectedStatus,
                        actualStatus:
                            result.status,
                        reason: result.reason,
                        sourceAssessments:
                            result.sourceAssessments,
                        durationMs,
                    }
                );

                expect(result.claimId).toBe(
                    input.claim.claimId
                );

                const expectedSourceKeys =
                    input.evidence
                        .map(
                            ({
                                source,
                                reflectionId,
                            }) =>
                                `${source}:${reflectionId}`
                        )
                        .sort();

                const actualSourceKeys =
                    result.sourceAssessments
                        .map(
                            ({
                                source,
                                reflectionId,
                            }) =>
                                `${source}:${reflectionId}`
                        )
                        .sort();

                expect(actualSourceKeys).toEqual(
                    expectedSourceKeys
                );
            },
            30_000
        );
    }
);