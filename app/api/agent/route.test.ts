//Agent Route 输入边界测试: 这一小步只测试 HTTP 输入，不进入 LLM 或数据库。

import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import OpenAI from 'openai';

import { POST } from '@/app/api/agent/route';
import {
    AgentToolError,
} from '@/lib/agent-tools';


const {
    createResponseMock,
    executeAgentToolMock,
} = vi.hoisted(() => ({
    createResponseMock: vi.fn(),
    executeAgentToolMock: vi.fn(),
}));

//替换整个 OpenAI Client。即使代码意外走到模型调用，也只会调用 createResponseMock。
vi.mock('openai', () => {
    class MockAPIError extends Error {
        readonly status: number;
        readonly code = 'mock_openai_error';
        readonly requestID = 'mock-request-id';

        constructor(status: number) {
            super('Mock OpenAI error');
            this.name = 'APIError';
            this.status = status;
        }
    }

    class MockOpenAI {
        static APIError = MockAPIError;

        responses = {
            create: createResponseMock,
        };
    }

    return {
        default: MockOpenAI,
    };
});

//替换工具和 Dispatcher，因此不会加载真实 Prisma Client，也不会读取 SQLite。
vi.mock('@/lib/agent-tools', () => {
    class MockAgentToolError extends Error {
        constructor(
            public readonly code: string,
            message: string
        ) {
            super(message);
            this.name = 'AgentToolError';
        }
    }

    return {
        AgentToolError: MockAgentToolError,
        agentTools: [],
        executeAgentTool: executeAgentToolMock,
    };
});

describe('POST /api/agent', () => {

    beforeEach(() => {
        createResponseMock.mockReset();
        executeAgentToolMock.mockReset();
        vi.unstubAllEnvs();
    });


    it('returns 400 for malformed JSON', async () => {
        const request = new Request(
            'http://localhost/api/agent',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: '{"question":',
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toMatchObject({
            code: 'invalid_request_json',
        });
        expect(body.traceId).toEqual(
            expect.any(String)
        );
        //这不仅检查返回码，还证明错误请求在到达 LLM 前就被拒绝，没有 API 费用。
        expect(createResponseMock).not.toHaveBeenCalled();
    });

    it('returns 400 when question is missing', async () => {
        const request = new Request(
            'http://localhost/api/agent',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: '{}',
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toMatchObject({
            code: 'question_required',
        });
        expect(createResponseMock).not.toHaveBeenCalled();
    });

    it('returns 500 when the LLM is not configured', async () => {
        vi.stubEnv('OPENAI_API_KEY', '');

        const request = new Request(
            'http://localhost/api/agent',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: '什么是 Reflection？',
                }),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toMatchObject({
            code: 'llm_not_configured',
        });
        expect(createResponseMock).not.toHaveBeenCalled();
    });

    it('executes a tool and sends its observation back to the model', async () => {
        vi.stubEnv('OPENAI_API_KEY', 'test-api-key');
        vi.stubEnv('OPENAI_MODEL', 'test-model');

        const toolResult = [
            {
                id: 'reflection-1',
                content: '私人 Reflection 内容',
                createdAt: '2026-08-23T12:00:00.000Z',
            },
        ];

        createResponseMock
            .mockResolvedValueOnce({
                id: 'response-tool-call',
                output_text: '',
                output: [
                    {
                        type: 'function_call',
                        call_id: 'call-1',//证明工具结果与原 Tool Call 正确关联。
                        name: 'get_recent_reflections',
                        arguments: '{"limit":1}',
                    },
                ],
            })
            .mockResolvedValueOnce({
                id: 'response-final',
                output_text:
                    '你最近记录了自己在推进 LifeOS。',
                output: [],
            });

        executeAgentToolMock.mockResolvedValue({
            arguments: {
                limit: 1,
            },
            result: toolResult,
        });

        const request = new Request(
            'http://localhost/api/agent',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question:
                        '请根据最近一条 Reflection 总结我在做什么。',
                }),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.answer).toBe(
            '你最近记录了自己在推进 LifeOS。'
        );

        //证明 Route 使用了模型返回的工具名和参数。
        expect(executeAgentToolMock).toHaveBeenCalledWith(
            'get_recent_reflections',
            '{"limit":1}'
        );

        expect(createResponseMock).toHaveBeenCalledTimes(2);

        //第一次请求产生 Tool Call，第二次请求接收 Observation 并产生最终答案。
        expect(createResponseMock).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                model: 'test-model',
                previous_response_id:
                    'response-tool-call',
                input: [
                    {
                        type: 'function_call_output',
                        call_id: 'call-1',
                        output: JSON.stringify(toolResult),
                    },
                ],
            })
        );

        expect(body.trace).toMatchObject({
            status: 'completed',
            model: 'test-model',
            toolCallCount: 1,
            finalResponseId: 'response-final',
            steps: [
                {
                    responseId: 'response-tool-call',
                    callId: 'call-1',
                    toolName: 'get_recent_reflections',
                    argumentKeys: ['limit'],
                    resultCount: 1,
                },
            ],
        });

        expect(
            JSON.stringify(body.trace)
        ).not.toContain('私人 Reflection 内容');
    });

    it('returns a direct answer without executing a tool', async () => {
        vi.stubEnv('OPENAI_API_KEY', 'test-api-key');

        createResponseMock.mockResolvedValueOnce({
            id: 'response-direct',
            output_text:
                'Reflection 是对经历进行回顾和思考。',
            output: [],
        });

        const request = new Request(
            'http://localhost/api/agent',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: '什么是 Reflection？',
                }),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.answer).toBe(
            'Reflection 是对经历进行回顾和思考。'
        );
        expect(body.trace.toolCallCount).toBe(0);
        expect(body.trace.steps).toEqual([]);

        expect(
            executeAgentToolMock
        ).not.toHaveBeenCalled();

        expect(createResponseMock).toHaveBeenCalledTimes(1);
    });

    it('returns 502 when the model produces an invalid tool call', async () => {
        vi.stubEnv('OPENAI_API_KEY', 'test-api-key');

        createResponseMock.mockResolvedValueOnce({
            id: 'response-invalid-tool',
            output_text: '',
            output: [
                {
                    type: 'function_call',
                    call_id: 'call-invalid',
                    name: 'get_recent_reflections',
                    arguments: '{"limit":0}',
                },
            ],
        });

        executeAgentToolMock.mockRejectedValueOnce(
            new AgentToolError(
                'invalid_arguments',
                '工具参数未通过验证'
            )
        );

        const request = new Request(
            'http://localhost/api/agent',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: '读取最近的 Reflection。',
                }),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(502);
        expect(body).toMatchObject({
            error: '模型生成的工具调用无效',
            code: 'invalid_arguments',
        });
        expect(body.traceId).toEqual(
            expect.any(String)
        );

        expect(createResponseMock).toHaveBeenCalledTimes(1);
        expect(executeAgentToolMock).toHaveBeenCalledTimes(1);
    });

    it('returns 503 when OpenAI is rate limited', async () => {
        vi.stubEnv('OPENAI_API_KEY', 'test-api-key');

        createResponseMock.mockRejectedValueOnce(
            new OpenAI.APIError(
                429,
                {},
                'Rate limited',
                new Headers()
            )
        );

        const request = new Request(
            'http://localhost/api/agent',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: '什么是 Reflection？',
                }),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body).toMatchObject({
            code: 'llm_rate_limited',
        });

        expect(createResponseMock).toHaveBeenCalledTimes(1);
        expect(
            executeAgentToolMock
        ).not.toHaveBeenCalled();
    });

    it('stops after reaching the tool call limit', async () => {
        vi.stubEnv('OPENAI_API_KEY', 'test-api-key');

        createResponseMock.mockResolvedValue({
            id: 'response-loop',
            output_text: '',
            output: [
                {
                    type: 'function_call',
                    call_id: 'call-loop',
                    name: 'get_recent_reflections',
                    arguments: '{"limit":1}',
                },
            ],
        });

        executeAgentToolMock.mockResolvedValue({
            arguments: {
                limit: 1,
            },
            result: [],
        });

        const request = new Request(
            'http://localhost/api/agent',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: '读取 Reflection。',
                }),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(502);
        expect(body.error).toBe(
            'Agent 超过最大工具调用次数'
        );

        expect(body.trace).toMatchObject({
            status: 'tool_limit_exceeded',
            toolCallCount: 4,
        });
        expect(body.trace.steps).toHaveLength(4);

        // 初始模型请求 + 四次 Observation 后的模型请求
        expect(createResponseMock).toHaveBeenCalledTimes(5);

        // 第五次 Tool Call 在执行前被预算边界阻止
        expect(executeAgentToolMock).toHaveBeenCalledTimes(4);
    });


});