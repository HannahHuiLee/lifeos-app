'use client';

import { FormEvent, useState } from 'react';

type AgentApiResponse = {
    answer?: string;
    error?: string;
    code?: string;
    trace?: {
        traceId: string;
        status: string;
        toolCallCount: number;
        durationMs: number;
        steps: Array<{
            toolName: string;
            resultCount: number | null;
        }>;
    };
};

export default function AgentPage() {
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [errorMessage, setErrorMessage] =
        useState('');
    const [isLoading, setIsLoading] =
        useState(false);
    //NonNullable 表示这个 state 保存的是“确定存在的 Trace”，或者 null。
    const [trace, setTrace] = useState<
        NonNullable<AgentApiResponse['trace']> | null
    >(null);

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        const trimmedQuestion = question.trim();

        if (!trimmedQuestion) {
            setErrorMessage('请输入问题');
            return;
        }

        setIsLoading(true);
        setAnswer('');
        setErrorMessage('');
        setTrace(null); //否则新请求进行时，页面可能继续显示上一次回答的数据来源。

        try {
            const response = await fetch('/api/agent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: trimmedQuestion,
                }),
            });

            const data =
                (await response.json()) as AgentApiResponse;

            if (!response.ok) {
                throw new Error(
                    data.error || 'Agent 请求失败'
                );
            }

            if (!data.answer) {
                throw new Error('Agent 没有返回答案');
            }

            setAnswer(data.answer);
            setTrace(data.trace ?? null);
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Agent 请求失败，请稍后重试'
            );
        } finally {
            setIsLoading(false);
        }
    }

    const retrievedReflectionCount =
        trace?.steps.reduce(
            (total, step) =>
                total + (step.resultCount ?? 0),
            0
        ) ?? 0;


    return (
        <main
            style={{
                maxWidth: '760px',
                margin: '40px auto',
                padding: '0 20px 60px',
            }}
        >
            <h1>LifeOS Agent</h1>

            <p
                style={{
                    color: '#666',
                    marginTop: '8px',
                    lineHeight: '1.6',
                }}
            >
                询问你最近的 Reflection。Agent
                会在需要时读取真实记录，然后基于证据回答。
            </p>

            <form
                onSubmit={handleSubmit}
                style={{
                    marginTop: '24px',
                }}
            >
                <label
                    htmlFor="agent-question"
                    style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontWeight: 600,
                    }}
                >
                    你的问题
                </label>

                <textarea
                    id="agent-question"
                    value={question}
                    onChange={(event) =>
                        setQuestion(event.target.value)
                    }
                    placeholder="例如：请总结我最近两条 Reflection 主要记录了什么。"
                    disabled={isLoading}
                    style={{
                        width: '100%',
                        minHeight: '140px',
                        padding: '16px',
                        fontSize: '16px',
                        lineHeight: '1.6',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        resize: 'vertical',
                        boxSizing: 'border-box',
                    }}
                />

                <button
                    type="submit"
                    disabled={
                        isLoading || question.trim() === ''
                    }
                    style={{
                        marginTop: '16px',
                        padding: '12px 20px',
                        border: 'none',
                        borderRadius: '8px',
                        backgroundColor: isLoading
                            ? '#9ca3af'
                            : '#2563eb',
                        color: 'white',
                        fontSize: '16px',
                        fontWeight: 600,
                        cursor: isLoading
                            ? 'not-allowed'
                            : 'pointer',
                    }}
                >
                    {isLoading
                        ? 'Agent 思考中...'
                        : '发送问题'}
                </button>
            </form>

            {errorMessage && (
                <section
                    role="alert"
                    style={{
                        marginTop: '24px',
                        padding: '16px',
                        borderRadius: '8px',
                        backgroundColor: '#fee2e2',
                        color: '#991b1b',
                    }}
                >
                    {errorMessage}
                </section>
            )}

            {answer && (
                <section
                    aria-live="polite"
                    style={{
                        marginTop: '24px',
                        padding: '20px',
                        border: '1px solid #bfdbfe',
                        borderRadius: '8px',
                        backgroundColor: '#eff6ff',
                    }}
                >
                    <h2
                        style={{
                            marginTop: 0,
                            fontSize: '18px',
                        }}
                    >
                        Agent 回答
                    </h2>

                    {trace && (
                        <div
                            style={{
                                marginBottom: '16px',
                                padding: '10px 12px',
                                borderRadius: '6px',
                                backgroundColor:
                                    trace.toolCallCount > 0
                                        ? '#dcfce7'
                                        : '#f3f4f6',
                                color:
                                    trace.toolCallCount > 0
                                        ? '#166534'
                                        : '#4b5563',
                                fontSize: '14px',
                                lineHeight: '1.5',
                            }}
                        >
                            {trace.toolCallCount > 0 ? (
                                <>
                                    已读取 {retrievedReflectionCount} 条
                                    Reflection 作为回答依据
                                </>
                            ) : (
                                <>
                                    未读取个人 Reflection；这是通用回答
                                </>
                            )}

                            <span style={{ marginLeft: '8px' }}>
                                · {(trace.durationMs / 1000).toFixed(1)} 秒
                            </span>
                        </div>
                    )}

                    <p
                        style={{
                            marginBottom: 0,
                            lineHeight: '1.8',
                            whiteSpace: 'pre-wrap',
                        }}
                    >
                        {answer}
                    </p>
                </section>
            )}
        </main>
    );
}