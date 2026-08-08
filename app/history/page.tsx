'use client';

import { useEffect, useState } from 'react';

// import type { ReflectionAnalysis } from '@/lib/reflection-analysis';
import type {
    RecentPatterns,
    ReflectionAnalysis,
} from '@/lib/reflection-analysis';

type HistoryItem = {
    id: string;
    content: string;
    createdAt: string;
    analysis: {
        id: string;
        model: string | null;
        createdAt: string;
        result: ReflectionAnalysis | null;
    } | null;
};

export default function HistoryPage() {
    const [reflections, setReflections] = useState<HistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const [recentPatterns, setRecentPatterns] =
        useState<RecentPatterns | null>(null);

    const [recentPatternsMeta, setRecentPatternsMeta] = useState<{
        reflectionCount: number;
        model: string;
    } | null>(null);

    const [isAnalyzingRecent, setIsAnalyzingRecent] =
        useState(false);

    const [recentPatternsError, setRecentPatternsError] =
        useState('');

    useEffect(() => {
        const controller = new AbortController();

        async function loadHistory() {
            try {
                const response = await fetch('/api/reflections', {
                    signal: controller.signal,
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || '读取历史记录失败');
                }

                setReflections(data.reflections);
            } catch (error) {
                if (error instanceof Error && error.name === 'AbortError') {
                    return;
                }

                setError(
                    error instanceof Error
                        ? error.message
                        : '读取历史记录失败'
                );
            } finally {
                setIsLoading(false);
            }
        }

        loadHistory();

        return () => {
            controller.abort();
        };
    }, []);

    async function handleAnalyzeRecent() {
        setIsAnalyzingRecent(true);
        setRecentPatternsError('');
        setRecentPatterns(null);
        setRecentPatternsMeta(null);

        try {
            const response = await fetch(
                '/api/reflections/analyze-recent',
                {
                    method: 'POST',
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || '分析最近的 Reflection 失败'
                );
            }

            setRecentPatterns(data.result);

            setRecentPatternsMeta({
                reflectionCount: data.reflectionCount,
                model: data.model,
            });
        } catch (error) {
            setRecentPatternsError(
                error instanceof Error
                    ? error.message
                    : '分析最近的 Reflection 失败'
            );
        } finally {
            setIsAnalyzingRecent(false);
        }
    }

    if (isLoading) {
        return (
            <main style={{ padding: '40px' }}>
                <p>正在读取 History...</p>
            </main>
        );
    }

    return (
        <main
            style={{
                maxWidth: '820px',
                margin: '40px auto',
                padding: '0 20px 60px',
            }}
        >
            <h1>Reflection History</h1>

            <p style={{ color: '#6b7280', marginTop: '8px' }}>
                回顾以前记录的 Reflection 和 AI 分析。
            </p>

            <section
                style={{
                    marginTop: '28px',
                    padding: '24px',
                    border: '1px solid #ddd6fe',
                    borderRadius: '12px',
                    backgroundColor: '#faf5ff',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        flexWrap: 'wrap',
                    }}
                >
                    <div>
                        <h2 style={{ margin: 0 }}>Recent Patterns</h2>

                        <p
                            style={{
                                margin: '8px 0 0',
                                color: '#6b7280',
                            }}
                        >
                            从最近最多 5 条 Reflection 中寻找重复模式。
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleAnalyzeRecent}
                        disabled={
                            isAnalyzingRecent || reflections.length < 2
                        }
                        style={{
                            padding: '12px 18px',
                            border: 'none',
                            borderRadius: '8px',
                            backgroundColor:
                                isAnalyzingRecent || reflections.length < 2
                                    ? '#9ca3af'
                                    : '#7c3aed',
                            color: 'white',
                            cursor:
                                isAnalyzingRecent || reflections.length < 2
                                    ? 'not-allowed'
                                    : 'pointer',
                        }}
                    >
                        {isAnalyzingRecent
                            ? 'Analyzing...'
                            : 'Analyze Recent Reflections'}
                    </button>
                </div>

                {reflections.length < 2 && (
                    <p style={{ marginTop: '16px', color: '#92400e' }}>
                        至少需要两条 Reflection 才能分析趋势。
                    </p>
                )}

                {recentPatternsError && (
                    <p
                        style={{
                            marginTop: '16px',
                            color: '#991b1b',
                        }}
                    >
                        {recentPatternsError}
                    </p>
                )}

                {recentPatterns && recentPatternsMeta && (
                    <RecentPatternsResult
                        patterns={recentPatterns}
                        reflectionCount={
                            recentPatternsMeta.reflectionCount
                        }
                        model={recentPatternsMeta.model}
                    />
                )}
            </section>

            {error && (
                <p
                    style={{
                        marginTop: '24px',
                        padding: '16px',
                        color: '#991b1b',
                        backgroundColor: '#fee2e2',
                        borderRadius: '8px',
                    }}
                >
                    {error}
                </p>
            )}

            {!error && reflections.length === 0 && (
                <div
                    style={{
                        marginTop: '32px',
                        padding: '24px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '12px',
                    }}
                >
                    <p>还没有 Reflection。</p>
                </div>
            )}

            <div
                style={{
                    display: 'grid',
                    gap: '20px',
                    marginTop: '32px',
                }}
            >
                {reflections.map((reflection) => (
                    <article
                        key={reflection.id}
                        style={{
                            padding: '24px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            backgroundColor: 'white',
                        }}
                    >
                        <time
                            dateTime={reflection.createdAt}
                            style={{
                                color: '#6b7280',
                                fontSize: '14px',
                            }}
                        >
                            {new Date(reflection.createdAt).toLocaleString(
                                'zh-CN'
                            )}
                        </time>

                        <p
                            style={{
                                marginTop: '16px',
                                lineHeight: '1.7',
                                whiteSpace: 'pre-wrap',
                            }}
                        >
                            {reflection.content}
                        </p>

                        {!reflection.analysis && (
                            <p
                                style={{
                                    marginTop: '20px',
                                    color: '#92400e',
                                }}
                            >
                                这条 Reflection 尚未进行 AI 分析。
                            </p>
                        )}

                        {reflection.analysis &&
                            !reflection.analysis.result && (
                                <p
                                    style={{
                                        marginTop: '20px',
                                        color: '#991b1b',
                                    }}
                                >
                                    这条分析结果无法读取。
                                </p>
                            )}

                        {reflection.analysis?.result && (
                            <details
                                style={{
                                    marginTop: '20px',
                                    padding: '16px',
                                    backgroundColor: '#f5f3ff',
                                    borderRadius: '8px',
                                }}
                            >
                                <summary
                                    style={{
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        color: '#6d28d9',
                                    }}
                                >
                                    查看 AI 分析
                                </summary>

                                <AnalysisResult
                                    analysis={reflection.analysis.result}
                                    model={reflection.analysis.model}
                                />
                            </details>
                        )}
                    </article>
                ))}
            </div>
        </main>
    );
}

function AnalysisResult({
    analysis,
    model,
}: {
    analysis: ReflectionAnalysis;
    model: string | null;
}) {
    return (
        <div style={{ marginTop: '20px' }}>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>
                模型：{model || '未知'}
            </p>

            <h3>摘要</h3>
            <p>{analysis.summary}</p>

            <h3>情绪</h3>
            {analysis.emotions.length === 0 ? (
                <p>没有识别到明确情绪。</p>
            ) : (
                <ul>
                    {analysis.emotions.map((emotion, index) => (
                        <li key={`${emotion.name}-${index}`}>
                            <strong>{emotion.name}</strong>
                            {' · '}
                            {emotion.intensity}/10
                            {' — '}
                            {emotion.evidence}
                        </li>
                    ))}
                </ul>
            )}

            <h3>做得好的地方</h3>
            <ul>
                {analysis.wins.map((item, index) => (
                    <li key={index}>{item}</li>
                ))}
            </ul>

            <h3>遇到的挑战</h3>
            <ul>
                {analysis.challenges.map((item, index) => (
                    <li key={index}>{item}</li>
                ))}
            </ul>

            <h3>洞察</h3>
            <ul>
                {analysis.insights.map((item, index) => (
                    <li key={index}>{item}</li>
                ))}
            </ul>

            <h3>下一步行动</h3>
            <ul>
                {analysis.nextActions.map((item, index) => (
                    <li key={index}>
                        <strong>{item.action}</strong>
                        {' — '}
                        {item.reason}
                    </li>
                ))}
            </ul>

            <h3>继续思考</h3>
            <p>{analysis.reflectionQuestion}</p>
        </div>
    );
}

function RecentPatternsResult({
    patterns,
    reflectionCount,
    model,
}: {
    patterns: RecentPatterns;
    reflectionCount: number;
    model: string;
}) {
    return (
        <div
            style={{
                marginTop: '24px',
                paddingTop: '20px',
                borderTop: '1px solid #ddd6fe',
            }}
        >
            <p
                style={{
                    color: '#6b7280',
                    fontSize: '14px',
                }}
            >
                基于最近 {reflectionCount} 条 Reflection
                {' · '}
                模型：{model}
            </p>

            <h3>Recurring Themes</h3>

            <ul>
                {patterns.recurringThemes.map(
                    (theme, index) => (
                        <li key={index}>{theme}</li>
                    )
                )}
            </ul>

            <h3>Positive Pattern</h3>

            <p>{patterns.positivePattern}</p>

            <h3>Challenge</h3>

            <p>{patterns.challenge}</p>

            <h3>Recommendations</h3>

            <ul>
                {patterns.recommendations.map(
                    (recommendation, index) => (
                        <li key={index}>{recommendation}</li>
                    )
                )}
            </ul>
        </div>
    );
}