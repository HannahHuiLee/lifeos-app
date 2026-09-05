import type {
    ClaimEvidence,
    SupportResult,
} from '@/lib/claim-verification';

export type V3Case5FailureType =
    | 'quantity/cardinality'
    | 'historical-only attribution'
    | 'unsupported environment'
    | 'unsupported mental state'
    | 'not-all-cited-sources-support';

// - kind：将标签绑定到 pattern 或 interpretation。
// - expectedStatus：人工判断的正确分类，复用真实 Verifier contract，避免状态字符串发生漂移。
// - failureTypes：记录确定的失败类别。使用数组是因为一个 claim 可能同时包含多个问题，例如 Run 08 同时涉及 mental state 和 cardinality。
// - note：保存人工判断依据。它必须来自冻结 claim 和 cited evidence，不能来自 Verifier 的 reason。
export type V3Case5ClaimLabel = {
    kind: ClaimEvidence['kind'];
    expectedStatus: SupportResult['status'];
    failureTypes: V3Case5FailureType[];
    note: string;
};

export type V3Case5RunLabel = {
    run: string;
    responseFile: string;
    humanLabel:
    | 'supported'
    | 'needs_detection';
    claimLabels: readonly [
        V3Case5ClaimLabel,
        V3Case5ClaimLabel,
    ];
    note: string;
};


// responseFile 指向已保存的真实模型响应，不重新运行 generator。
// humanLabel 是评测标准，不由 Verifier 决定。
// needs_detection 合并人工审查中的 partial 和 unsupported，因为现有报告只有 run-level PASS/FAIL，没有逐 claim 标签。
// note 保存人工失败理由，便于之后对照 Verifier 的 reason。
// Run 05/10 是 negative cases：Verifier 不应该误报。
// 其他八次是 positive cases：Verifier 至少应发现一个问题。

const RUN_DIRECTORY =
    'evals/runs/grounding-reliability-v3/' +
    'case-5/measured-20260829T202623Z';

export const v3Case5RunLabels:
    V3Case5RunLabel[] = [
        {
            run: '01',
            responseFile:
                `${RUN_DIRECTORY}/run-01-response.pretty.json`,
            humanLabel: 'needs_detection',
            claimLabels: [
                {
                    kind: 'pattern',
                    expectedStatus: 'partial',
                    failureTypes: [
                        'quantity/cardinality',
                    ],
                    note:
                        'Only one independent Historical source is cited, so “多次” is unsupported.',
                },
                {
                    kind: 'interpretation',
                    expectedStatus: 'supported',
                    failureTypes: [],
                    note:
                        'Current supports the present LifeOS work; Historical supports the earlier Starbucks and focus details without attributing that location to Current.',
                },
            ],
            note:
                'Claims repeated development and extends historical Starbucks/focus details.',
        },
        {
            run: '02',
            responseFile:
                `${RUN_DIRECTORY}/run-02-response.pretty.json`,
            humanLabel: 'needs_detection',
            claimLabels: [
                {
                    kind: 'pattern',
                    expectedStatus: 'supported',
                    failureTypes: [],
                    note:
                        'Current and Historical both support continued LifeOS, Evidence-backed Reflection, and UI work.',
                },
                {
                    kind: 'interpretation',
                    expectedStatus: 'partial',
                    failureTypes: [
                        'quantity/cardinality',
                    ],
                    note:
                        'The core project continuity is supported, but one Historical source cannot support “多次提及”.',
                },
            ],
            note:
                'Claims repeated historical behavior from one cited source.',
        },
        {
            run: '03',
            responseFile:
                `${RUN_DIRECTORY}/run-03-response.pretty.json`,
            humanLabel: 'needs_detection',
            claimLabels: [
                {
                    kind: 'pattern',
                    expectedStatus: 'supported',
                    failureTypes: [],
                    note:
                        'Current and Historical both support LifeOS and Evidence-backed Reflection UI development.',
                },
                {
                    kind: 'interpretation',
                    expectedStatus: 'partial',
                    failureTypes: [
                        'quantity/cardinality',
                    ],
                    note:
                        'The shared project work is supported, but “历史中多次提到” is based on one Historical source.',
                },
            ],
            note:
                'Claims history mentioned the work multiple times from one source.',
        },
        {
            run: '04',
            responseFile:
                `${RUN_DIRECTORY}/run-04-response.pretty.json`,
            humanLabel: 'needs_detection',
            claimLabels: [
                {
                    kind: 'pattern',
                    expectedStatus: 'supported',
                    failureTypes: [],
                    note:
                        'Current and at least one cited Historical source support the LifeOS and Evidence-backed Reflection UI pattern.',
                },
                {
                    kind: 'interpretation',
                    expectedStatus: 'partial',
                    failureTypes: [
                        'not-all-cited-sources-support',
                    ],
                    note:
                        'The claim says multiple Historical reflections support Evidence-backed Reflection work, but the second source mentions only continuing the LifeOS project.',
                },
            ],
            note:
                'Claims both historical sources support Evidence-backed Reflection/UI.',
        },
        {
            run: '05',
            responseFile:
                `${RUN_DIRECTORY}/run-05-response.pretty.json`,
            humanLabel: 'supported',
            claimLabels: [
                {
                    kind: 'pattern',
                    expectedStatus: 'supported',
                    failureTypes: [],
                    note:
                        'Both sources support continued LifeOS and Evidence-backed Reflection development.',
                },
                {
                    kind: 'interpretation',
                    expectedStatus: 'supported',
                    failureTypes: [],
                    note:
                        'Both sources support LifeOS work involving Evidence-backed Reflection and UI.',
                },
            ],
            note:
                'Shared claims stay within LifeOS, Evidence-backed Reflection, development, and UI.',
        },
        {
            run: '06',
            responseFile:
                `${RUN_DIRECTORY}/run-06-response.pretty.json`,
            humanLabel: 'needs_detection',
            claimLabels: [
                {
                    kind: 'pattern',
                    expectedStatus: 'supported',
                    failureTypes: [],
                    note:
                        'Current and Historical both support continued Evidence-backed Reflection and UI work.',
                },
                {
                    kind: 'interpretation',
                    expectedStatus: 'partial',
                    failureTypes: [
                        'quantity/cardinality',
                    ],
                    note:
                        'The core continuity is supported, but “历史多条记录” is based on one Historical source.',
                },
            ],
            note:
                'Claims multiple historical records while citing one source.',
        },
        {
            run: '07',
            responseFile:
                `${RUN_DIRECTORY}/run-07-response.pretty.json`,
            humanLabel: 'needs_detection',
            claimLabels: [
                {
                    kind: 'pattern',
                    expectedStatus: 'partial',
                    failureTypes: [
                        'historical-only attribution',
                        'unsupported environment',
                    ],
                    note:
                        'The shared LifeOS work is supported, but only Historical evidence provides an environment or location.',
                },
                {
                    kind: 'interpretation',
                    expectedStatus: 'supported',
                    failureTypes: [],
                    note:
                        'The claim distinguishes the earlier Starbucks event from the current work and keeps the core conclusion within continued LifeOS development.',
                },
            ],
            note:
                'Introduces a shared environment without Current location evidence.',
        },
        {
            run: '08',
            responseFile:
                `${RUN_DIRECTORY}/run-08-response.pretty.json`,
            humanLabel: 'needs_detection',
            claimLabels: [
                {
                    kind: 'pattern',
                    expectedStatus: 'partial',
                    failureTypes: [
                        'historical-only attribution',
                        'unsupported mental state',
                    ],
                    note:
                        'Both sources support the project work, but only Historical evidence explicitly supports the focused mental state.',
                },
                {
                    kind: 'interpretation',
                    expectedStatus: 'partial',
                    failureTypes: [
                        'quantity/cardinality',
                    ],
                    note:
                        'The project continuity is supported, but one Historical source cannot establish repeated historical focus.',
                },
            ],
            note:
                'Treats focus as shared and claims repeated history from one source.',
        },
        {
            run: '09',
            responseFile:
                `${RUN_DIRECTORY}/run-09-response.pretty.json`,
            humanLabel: 'needs_detection',
            claimLabels: [
                {
                    kind: 'pattern',
                    expectedStatus: 'partial',
                    failureTypes: [
                        'historical-only attribution',
                        'unsupported mental state',
                    ],
                    note:
                        'The shared LifeOS activity is supported, but explicit focus appears only in Historical evidence.',
                },
                {
                    kind: 'interpretation',
                    expectedStatus: 'partial',
                    failureTypes: [
                        'unsupported environment',
                    ],
                    note:
                        'The cited Historical excerpt says “我在那里” but does not identify Starbucks, so the location detail is unsupported.',
                },
            ],
            note:
                'Treats historical focus as a shared Current/Historical attribute.',
        },
        {
            run: '10',
            responseFile:
                `${RUN_DIRECTORY}/run-10-response.pretty.json`,
            humanLabel: 'supported',
            claimLabels: [
                {
                    kind: 'pattern',
                    expectedStatus: 'supported',
                    failureTypes: [],
                    note:
                        'Both sources support LifeOS, Evidence-backed Reflection, and UI development.',
                },
                {
                    kind: 'interpretation',
                    expectedStatus: 'supported',
                    failureTypes: [],
                    note:
                        'The claim correctly attributes Starbucks and focused work to the earlier Historical experience rather than to Current evidence.',
                },
            ],
            note:
                'Shared Pattern is limited to supported LifeOS and UI development.',
        },
    ];