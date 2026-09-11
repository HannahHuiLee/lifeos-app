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