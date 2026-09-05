export type V3Case5RunLabel = {
  run: string;
  responseFile: string;
  humanLabel:
    | 'supported'
    | 'needs_detection';
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
      note:
        'Claims repeated development and extends historical Starbucks/focus details.',
    },
    {
      run: '02',
      responseFile:
        `${RUN_DIRECTORY}/run-02-response.pretty.json`,
      humanLabel: 'needs_detection',
      note:
        'Claims repeated historical behavior from one cited source.',
    },
    {
      run: '03',
      responseFile:
        `${RUN_DIRECTORY}/run-03-response.pretty.json`,
      humanLabel: 'needs_detection',
      note:
        'Claims history mentioned the work multiple times from one source.',
    },
    {
      run: '04',
      responseFile:
        `${RUN_DIRECTORY}/run-04-response.pretty.json`,
      humanLabel: 'needs_detection',
      note:
        'Claims both historical sources support Evidence-backed Reflection/UI.',
    },
    {
      run: '05',
      responseFile:
        `${RUN_DIRECTORY}/run-05-response.pretty.json`,
      humanLabel: 'supported',
      note:
        'Shared claims stay within LifeOS, Evidence-backed Reflection, development, and UI.',
    },
    {
      run: '06',
      responseFile:
        `${RUN_DIRECTORY}/run-06-response.pretty.json`,
      humanLabel: 'needs_detection',
      note:
        'Claims multiple historical records while citing one source.',
    },
    {
      run: '07',
      responseFile:
        `${RUN_DIRECTORY}/run-07-response.pretty.json`,
      humanLabel: 'needs_detection',
      note:
        'Introduces a shared environment without Current location evidence.',
    },
    {
      run: '08',
      responseFile:
        `${RUN_DIRECTORY}/run-08-response.pretty.json`,
      humanLabel: 'needs_detection',
      note:
        'Treats focus as shared and claims repeated history from one source.',
    },
    {
      run: '09',
      responseFile:
        `${RUN_DIRECTORY}/run-09-response.pretty.json`,
      humanLabel: 'needs_detection',
      note:
        'Treats historical focus as a shared Current/Historical attribute.',
    },
    {
      run: '10',
      responseFile:
        `${RUN_DIRECTORY}/run-10-response.pretty.json`,
      humanLabel: 'supported',
      note:
        'Shared Pattern is limited to supported LifeOS and UI development.',
    },
  ];