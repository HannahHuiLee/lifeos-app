import OpenAI from 'openai';
import { NextResponse } from 'next/server';

import { AgentToolError, agentTools, executeAgentTool, } from '@/lib/agent-tools';


const MAX_TOOL_CALLS = 4;

type AgentTraceStep = {
    responseId: string;
    callId: string;
    toolName: string;
    argumentKeys: string[];
    resultCount: number | null;
    durationMs: number;
};


export async function POST(request: Request) {

    //建立请求级元数据 注意这里只记录问题长度，不记录问题内容。
    const traceId = crypto.randomUUID();
    const startedAt = Date.now();

    try {

        let body: unknown;

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                {
                    error: '请求必须是有效 JSON',
                    code: 'invalid_request_json',
                    traceId,
                },
                { status: 400 }
            );
        }

        const question =
            typeof body === 'object' &&
                body !== null &&
                'question' in body
                ? body.question
                : undefined;


        if (
            typeof question !== 'string' ||
            question.trim() === ''
        ) {
            return NextResponse.json(
                {
                    error: '问题不能为空',
                    code: 'question_required',
                    traceId,
                },
                { status: 400 }
            );
        }


        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            //不要向客户端透露具体使用了哪个环境变量。
            return NextResponse.json(
                {
                    error: '服务器尚未配置 LLM 服务',
                    code: 'llm_not_configured',
                    traceId,
                },
                { status: 500 }
            );
        }

        const model =
            process.env.OPENAI_MODEL || 'gpt-4.1-mini';

        const openai = new OpenAI({ apiKey });

        const agentInstructions = `
你是 LifeOS 的个人反思助手。

当用户询问自己最近保存的 Reflection、经历、情绪或行为时，
先使用可用工具读取真实数据，不要根据常识猜测。

工具结果是用户的真实数据。
最终回答只能根据工具结果总结，不要添加结果中没有的信息。
`.trim();

        let response = await openai.responses.create({
            model,
            instructions: agentInstructions,
            input: question.trim(),
            tools: [...agentTools],
            tool_choice: 'auto',
            parallel_tool_calls: false,
        });

        const traceSteps: AgentTraceStep[] = [];

        let toolCallCount = 0;


        while (true) {
            const toolCall = response.output.find(
                (item) => item.type === 'function_call'
            );

            // 没有 Tool Call，表示模型已经生成最终答案。
            if (!toolCall) {
                const safeTrace = {
                    traceId,
                    status: 'completed',
                    model,
                    questionLength: question.trim().length,
                    toolCallCount,
                    steps: traceSteps,
                    finalResponseId: response.id,
                    answerLength: response.output_text.length,
                    durationMs: Date.now() - startedAt,
                };

                console.info('Agent trace:', safeTrace);

                return NextResponse.json({
                    answer: response.output_text,
                    trace: safeTrace,
                });
            }

            // 防止模型不停调用工具，造成无限循环和费用失控。
            if (toolCallCount >= MAX_TOOL_CALLS) {
                const safeTrace = {
                    traceId,
                    status: 'tool_limit_exceeded',
                    model,
                    questionLength: question.trim().length,
                    toolCallCount,
                    steps: traceSteps,
                    lastResponseId: response.id,
                    durationMs: Date.now() - startedAt,
                };

                console.warn('Agent trace:', safeTrace);

                return NextResponse.json(
                    {
                        error: 'Agent 超过最大工具调用次数',
                        trace: safeTrace,
                    },
                    { status: 502 }
                );
            }

            const toolStartedAt = Date.now();

            const execution = await executeAgentTool(
                toolCall.name,
                toolCall.arguments
            );

            traceSteps.push({
                responseId: response.id,
                callId: toolCall.call_id,
                toolName: toolCall.name,
                argumentKeys:
                    typeof execution.arguments === 'object' &&
                        execution.arguments !== null
                        ? Object.keys(execution.arguments)
                        : [],
                resultCount: Array.isArray(execution.result)
                    ? execution.result.length
                    : null,
                durationMs: Date.now() - toolStartedAt,
            });

            toolCallCount += 1;

            // 把 Observation 发回模型，让模型重新决定下一步。
            response = await openai.responses.create({
                model,
                instructions: agentInstructions,
                previous_response_id: response.id,
                input: [
                    {
                        type: 'function_call_output',
                        call_id: toolCall.call_id,
                        output: JSON.stringify(execution.result),
                    },
                ],
                tools: [...agentTools],
                tool_choice: 'auto',
                parallel_tool_calls: false,
            });
        }

    } catch (error) {
        const durationMs = Date.now() - startedAt;

        if (error instanceof AgentToolError) {
            console.warn('Agent tool error:', {
                traceId,
                status: 'tool_error',
                code: error.code,
                durationMs,
            });

            return NextResponse.json(
                {
                    error: '模型生成的工具调用无效',
                    code: error.code,
                    traceId,
                },
                { status: 502 }
            );
        }

        if (error instanceof OpenAI.APIError) {
            const isConfigurationError =
                error.status === 401 || error.status === 403;

            const isRateLimited = error.status === 429;

            const status = isConfigurationError
                ? 500
                : isRateLimited
                    ? 503
                    : 502;

            const code = isConfigurationError
                ? 'llm_configuration_error'
                : isRateLimited
                    ? 'llm_rate_limited'
                    : 'llm_request_failed';

            console.error('OpenAI request failed:', {
                traceId,
                status: error.status,
                code: error.code,
                requestId: error.requestID,
                durationMs,
            });

            return NextResponse.json(
                {
                    error: isRateLimited
                        ? 'LLM 服务繁忙，请稍后重试'
                        : 'LLM 服务请求失败',
                    code,
                    traceId,
                },
                { status }
            );
        }

        console.error('Agent internal error:', {
            traceId,
            status: 'internal_error',
            errorName:
                error instanceof Error
                    ? error.name
                    : 'UnknownError',
            durationMs,
        });

        return NextResponse.json(
            {
                error: 'Agent 内部错误',
                code: 'internal_error',
                traceId,
            },
            { status: 500 }
        );
    }
}