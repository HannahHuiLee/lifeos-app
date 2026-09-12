import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { analyzeReading } from './reading-analyzer';
import { ReadingAnalysisSchema } from './reading-analysis';

// 替换网络调用，保留真实的结构化输出格式转换。
const { parseResponseMock, constructorMock } = vi.hoisted(() => ({
    parseResponseMock: vi.fn(),
    constructorMock: vi.fn(),
}));

vi.mock('openai', () => {
    class MockOpenAI {
        constructor(options: unknown) {
            constructorMock(options);
        }

        responses = {
            parse: parseResponseMock,
        };
    }

    return { default: MockOpenAI };
});

const input = {
    materialTitle: 'Practice and improvement',
    contentSnapshot:
        'Regular practice helps people improve gradually.',
    answer: 'Practice helps people improve over time.',
};

function makeAnalysis() {
    return {
        mainIdea: {
            captured: true,
            feedback: '你抓住了持续练习有助于逐步进步的主旨。',
        },
        reusablePatterns: [], grammarNotes: [],
        comparison: { usefulUpgrade: null },
        missedKeyPoints: [],
        corrections: [],
        suggestedSummary:
            'Regular practice helps people improve gradually.',
    };
}

describe('analyzeReading', () => {
    beforeEach(() => {
        vi.resetAllMocks();

        // 控制测试环境，避免依赖本机配置。
        vi.stubEnv('MOCK_LLM', 'false');
        vi.stubEnv('OPENAI_API_KEY', 'test-key-not-real');
        vi.stubEnv('OPENAI_MODEL', 'test-model');

        parseResponseMock.mockResolvedValue({
            output_parsed: makeAnalysis(),
        });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('returns clearly labeled mock feedback without creating a client', async () => {
        vi.stubEnv('MOCK_LLM', 'true');
        vi.stubEnv('OPENAI_API_KEY', '');

        const result = await analyzeReading(input);

        expect(result.model).toBe('mock-reading-v1');
        expect(result.analysis.mainIdea.feedback).toContain('模拟模式');
        expect(
            ReadingAnalysisSchema.safeParse(result.analysis).success
        ).toBe(true);

        expect(constructorMock).not.toHaveBeenCalled();
        expect(parseResponseMock).not.toHaveBeenCalled();
    });

    it('rejects missing API configuration before creating a client', async () => {
        vi.stubEnv('OPENAI_API_KEY', '');

        await expect(analyzeReading(input)).rejects.toThrow(
            '服务器尚未配置 OPENAI_API_KEY'
        );

        expect(constructorMock).not.toHaveBeenCalled();
        expect(parseResponseMock).not.toHaveBeenCalled();
    });

    it('sends the saved snapshot and answer with structured output enabled', async () => {
        const result = await analyzeReading(input);

        expect(constructorMock).toHaveBeenCalledWith({
            apiKey: 'test-key-not-real',
            timeout: 30_000,
            maxRetries: 0,
        });

        expect(parseResponseMock).toHaveBeenCalledTimes(1);

        const request = parseResponseMock.mock.calls[0][0];

        expect(request.model).toBe('test-model');
        expect(request.input).toHaveLength(2);
        expect(request.input[0].role).toBe('system');
        expect(request.input[0].content).toContain('仅表达生硬时放入 usefulUpgrade，不放入 missedKeyPoints 或 corrections');
        expect(request.input[0].content).toContain('只使用 contentSnapshot 作为事实依据');
        expect(request.input[0].content).toContain('保留原文含义和限定条件');
        expect(request.text.format.schema.required).toContain('comparison');
        expect(request.text.format.schema.required).toContain('reusablePatterns');
        expect(request.text.format.schema.required).toContain('grammarNotes');
        expect(request.text.format.schema.properties.comparison.properties).not.toHaveProperty('doneWell');
        expect(request.input[0].content).toContain('Assign each issue to only one category');
        expect(request.input[0].content).toContain('Content feedback must not discuss grammar or phrasing');
        expect(request.input[0].content).toContain('不得与语言升级重复');
        expect(request.input[0].content).toContain('仅针对语言提供 1–3 条');
        expect(request.input[0].content).toContain('不是任意词汇或文章专属短语');
        expect(request.input[1].role).toBe('user');
        expect(JSON.parse(request.input[1].content)).toEqual(input);

        expect(request.text.format).toMatchObject({
            type: 'json_schema',
            name: 'reading_analysis',
            strict: true,
        });

        expect(result).toEqual({
            analysis: makeAnalysis(),
            model: 'test-model',
        });
    });

    it.each([false, true])('keeps language upgrades separate from content errors (content error: %s)', async (hasError) => {
        const answer = 'Practice make better.';
        const analysis = {
            ...makeAnalysis(),
            corrections: hasError ? [{ learnerClaim: 'Practice make better.', correction: 'The source only reports a possibility.' }] : [],
            comparison: {
                usefulUpgrade: {
                    items: [{ original: 'Practice make better', improved: 'Practice helps us improve', reason: 'More natural phrasing.' }],
                    upgradedAnswer: 'Practice helps us improve.',
                },
            },
        };
        parseResponseMock.mockResolvedValue({ output_parsed: analysis });
        const result = await analyzeReading({ ...input, answer });
        expect(result.analysis.comparison?.usefulUpgrade).toEqual(analysis.comparison.usefulUpgrade);
        expect(result.analysis.missedKeyPoints).toEqual([]);
        expect(result.analysis.corrections).toHaveLength(hasError ? 1 : 0);
        const prompt = parseResponseMock.mock.calls[0][0].input[0].content;
        expect(prompt).toContain('若存在明显生硬、错误或不地道的英语，必须给出 usefulUpgrade');
        expect(prompt).toContain('理解正确但语言生硬时内容反馈可为空');
        expect(prompt).toContain('若措辞已自然，usefulUpgrade 返回 null');
        expect(prompt).toContain('不因个人风格偏好过度修改');
    });

    it('allows already natural English without manufactured upgrades', async () => {
        const result = await analyzeReading(input);
        expect(result.analysis.comparison?.usefulUpgrade).toBeNull();
        expect(result.analysis.corrections).toEqual([]);
    });

    it('rejects more than three combined content points in new feedback', async () => {
        parseResponseMock.mockResolvedValue({ output_parsed: {
            ...makeAnalysis(), missedKeyPoints: ['First omission', 'Second omission'],
            corrections: [
                { learnerClaim: 'First claim', correction: 'First correction' },
                { learnerClaim: 'Second claim', correction: 'Second correction' },
            ],
        } });
        await expect(analyzeReading(input)).rejects.toThrow('内容反馈合计不能超过 2 条');
    });

    it('rejects fabricated original wording before persistence', async () => {
        parseResponseMock.mockResolvedValue({ output_parsed: {
            ...makeAnalysis(),
            comparison: { usefulUpgrade: {
                items: [{ original: 'Not in the answer', improved: 'An improvement', reason: null }],
                upgradedAnswer: null,
            } },
        } });
        await expect(analyzeReading(input)).rejects.toThrow('语言升级引用不在学习者答案中');
    });

    it('uses the project fallback model when OPENAI_MODEL is empty', async () => {
        vi.stubEnv('OPENAI_MODEL', '');

        const result = await analyzeReading(input);

        expect(result.model).toBe('gpt-4.1-mini');
        expect(parseResponseMock).toHaveBeenCalledWith(
            expect.objectContaining({
                model: 'gpt-4.1-mini',
            })
        );
    });

    it('normalizes parsed feedback before returning it', async () => {
        parseResponseMock.mockResolvedValue({
            output_parsed: {
                ...makeAnalysis(),
                suggestedSummary: '  Practice supports improvement.  ',
            },
        });

        const result = await analyzeReading(input);

        expect(result.analysis.suggestedSummary).toBe(
            'Practice supports improvement.'
        );
    });

    it('rejects a response without parsed analysis', async () => {
        parseResponseMock.mockResolvedValue({
            output_parsed: null,
        });

        await expect(analyzeReading(input)).rejects.toThrow(
            'LLM 没有返回有效的 Reading 分析'
        );
    });

    it('rejects parsed content that violates the analysis contract', async () => {
        parseResponseMock.mockResolvedValue({
            output_parsed: {
                ...makeAnalysis(),
                suggestedSummary: '   ',
            },
        });

        await expect(analyzeReading(input)).rejects.toThrow();
    });

    it('propagates a provider failure instead of returning mock feedback', async () => {
        const providerError = new Error('Simulated provider failure');
        parseResponseMock.mockRejectedValue(providerError);

        await expect(analyzeReading(input)).rejects.toBe(providerError);

        expect(parseResponseMock).toHaveBeenCalledTimes(1);
    });
});