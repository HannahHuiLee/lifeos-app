'use client';

import { useRef, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import {
    ReadingAnalysisSchema,
    type ReadingAnalysis,
} from '@/lib/reading-analysis';

// 每个阶段只携带该阶段需要的数据。
type PracticeState =
    | { phase: 'editing'; error?: string }
    | { phase: 'saving' }
    | { phase: 'analyzing'; sessionId: string }
    | { phase: 'analysisError'; sessionId: string; error: string }
    | { phase: 'complete'; analysis: ReadingAnalysis; model: string };

export default function ReadingPractice({
    learningUnitId,
}: {
    learningUnitId: string;
}) {
    const router = useRouter();
    const [answer, setAnswer] = useState('');
    const [state, setState] = useState<PracticeState>({
        phase: 'editing',
    });
    const [isRefreshing, startRefresh] = useTransition();

    // 同步阻止连续点击，避免等待 React 更新期间重复提交。
    const requestInFlight = useRef(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (
            requestInFlight.current ||
            (state.phase !== 'editing' && state.phase !== 'analysisError')
        ) {
            return;
        }

        if (!answer.trim()) {
            setState({
                phase: 'editing',
                error: '请先写下你的英文总结。',
            });
            return;
        }

        requestInFlight.current = true;

        // 已保存但分析失败时，继续使用同一个会话。
        let sessionId =
            state.phase === 'analysisError' ? state.sessionId : null;

        try {
            if (!sessionId) {
                setState({ phase: 'saving' });

                const response = await fetch('/api/reading-sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        learningUnitId,
                        answer,
                    }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || '保存答案失败');
                }

                if (
                    typeof data.session?.id !== 'string' ||
                    !data.session.id
                ) {
                    throw new Error('保存接口未返回有效会话 ID');
                }

                sessionId = data.session.id;
            }

            if (typeof sessionId !== 'string' || sessionId.length === 0) {
                throw new Error('无法开始分析：缺少有效会话 ID');
            }

            setState({ phase: 'analyzing', sessionId });

            const response = await fetch(
                `/api/reading-sessions/${encodeURIComponent(sessionId)}/analyze`,
                { method: 'POST' }
            );
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '分析失败');
            }

            const analysis = ReadingAnalysisSchema.parse(
                data.session?.analysis
            );

            if (typeof data.session?.model !== 'string') {
                throw new Error('分析接口未返回有效模型信息');
            }

            setState({
                phase: 'complete',
                analysis,
                model: data.session.model,
            });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : '请求失败';

            if (sessionId) {
                setState({
                    phase: 'analysisError',
                    sessionId,
                    error: message,
                });
            } else {
                setState({
                    phase: 'editing',
                    error: message,
                });
            }
        } finally {
            requestInFlight.current = false;
        }
    }

    const error =
        state.phase === 'editing' || state.phase === 'analysisError'
            ? state.error
            : undefined;

    const busy =
        state.phase === 'saving' || state.phase === 'analyzing';

    return (
        <section
            aria-labelledby="reading-answer-heading"
            style={{ marginTop: '24px' }}
        >
            <h3 id="reading-answer-heading">Your summary</h3>

            <form onSubmit={handleSubmit}>
                <label htmlFor="reading-answer">
                    用英文概括这一单元的主旨和重要细节。
                </label>

                <textarea
                    id="reading-answer"
                    required
                    maxLength={5_000}
                    value={answer}
                    readOnly={state.phase !== 'editing'}
                    onChange={(event) => {
                        setAnswer(event.target.value);
                        setState({ phase: 'editing' });
                    }}
                    style={{
                        display: 'block',
                        width: '100%',
                        boxSizing: 'border-box',
                        minHeight: '150px',
                        margin: '12px 0',
                        padding: '12px',
                        lineHeight: 1.6,
                    }}
                />

                {state.phase !== 'complete' && (
                    <button type="submit" disabled={busy}>
                        {state.phase === 'saving'
                            ? '正在保存…'
                            : state.phase === 'analyzing'
                                ? '正在分析…'
                                : state.phase === 'analysisError'
                                    ? '重试分析'
                                    : '提交并分析'}
                    </button>
                )}
            </form>

            {error && <p role="alert">{error}</p>}

            {state.phase === 'analysisError' && (
                <p>答案已保存。重试将分析同一份答案，不会重新创建会话。</p>
            )}

            <div aria-live="polite">
                {state.phase === 'analyzing' && (
                    <p>答案已保存，正在生成反馈。</p>
                )}

                {state.phase === 'complete' && (
                    <section style={{ marginTop: '24px' }}>
                        <h3>Reading feedback</h3>

                        {state.model === 'mock-reading-v1' ? (
                            <p>
                                当前为模拟模式：本单元已完成流程验证，
                                尚未进行真实阅读评估。
                            </p>
                        ) : (
                            <>
                                <h4>
                                    {state.analysis.mainIdea.captured
                                        ? '已抓住主旨'
                                        : '主旨仍需完善'}
                                </h4>
                                <p>{state.analysis.mainIdea.feedback}</p>

                                <h4>重要遗漏</h4>
                                {state.analysis.missedKeyPoints.length ? (
                                    <ul>
                                        {state.analysis.missedKeyPoints.map(
                                            (point, index) => (
                                                <li key={index}>{point}</li>
                                            )
                                        )}
                                    </ul>
                                ) : (
                                    <p>未发现重要遗漏。</p>
                                )}

                                <h4>理解纠正</h4>
                                {state.analysis.corrections.length ? (
                                    <ul>
                                        {state.analysis.corrections.map(
                                            (item, index) => (
                                                <li key={index}>
                                                    <blockquote>
                                                        {item.learnerClaim}
                                                    </blockquote>
                                                    <p>{item.correction}</p>
                                                </li>
                                            )
                                        )}
                                    </ul>
                                ) : (
                                    <p>未发现需要纠正的理解错误。</p>
                                )}

                                <h4>参考总结</h4>
                                <p>{state.analysis.suggestedSummary}</p>
                            </>
                        )}

                        <p>本单元已完成。点击继续，更新进度并查看下一单元。</p>

                        <button
                            type="button"
                            disabled={isRefreshing}
                            onClick={() => {
                                startRefresh(() => router.refresh());
                            }}
                        >
                            {isRefreshing ? '正在加载…' : '继续'}
                        </button>
                    </section>
                )}
            </div>
        </section>
    );
}