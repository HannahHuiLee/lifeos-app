'use client';

import Link from 'next/link';
import { useState } from 'react';

import {
    ListeningAnalysisSchema,
    type ListeningAnalysis,
} from '@/lib/listening-analysis';
import type { ListeningPracticeSnapshot } from '@/lib/listening-contracts';

import MaterialLibrary, {
    type ActiveLearningUnit,
} from './MaterialLibrary';

type ActivePractice = {
    snapshot: ListeningPracticeSnapshot;
    unit: ActiveLearningUnit;
};

export default function ListeningPage() {
    const [activePractice, setActivePractice] =
        useState<ActivePractice | null>(null);
    const [progressVersion, setProgressVersion] = useState(0);

    const [answer, setAnswer] = useState('');
    const [analysis, setAnalysis] = useState<ListeningAnalysis | null>(null);
    const [analysisModel, setAnalysisModel] = useState('');
    const [showTranscript, setShowTranscript] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    function resetPracticeState() {
        setAnswer('');
        setAnalysis(null);
        setAnalysisModel('');
        setShowTranscript(false);
        setMessage('');
    }

    async function handleSubmit() {
        if (
            !activePractice ||
            !answer.trim() ||
            isSubmitting ||
            analysis
        ) {
            return;
        }

        setIsSubmitting(true);
        setMessage('');

        try {
            const saveResponse = await fetch('/api/listening-sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    practiceSnapshot: activePractice.snapshot,
                    learningUnitId: activePractice.unit.id,
                    answer,
                }),
            });

            const saveData = await saveResponse.json();

            if (!saveResponse.ok) {
                throw new Error(saveData.error || '保存答案失败');
            }

            if (
                typeof saveData.session?.id !== 'string' ||
                !saveData.session.id
            ) {
                throw new Error('保存接口未返回有效会话 ID');
            }

            const analyzeResponse = await fetch(
                `/api/listening-sessions/${encodeURIComponent(
                    saveData.session.id
                )}/analyze`,
                { method: 'POST' }
            );

            const analyzeData = await analyzeResponse.json();

            if (!analyzeResponse.ok) {
                throw new Error(analyzeData.error || '分析失败');
            }

            const validatedAnalysis = ListeningAnalysisSchema.parse(
                analyzeData.session?.analysis
            );

            if (typeof analyzeData.session?.model !== 'string') {
                throw new Error('分析接口未返回有效模型信息');
            }

            setAnalysis(validatedAnalysis);
            setAnalysisModel(analyzeData.session.model);
            setMessage('本单元已完成。阅读反馈后，可以返回材料库继续。');
            setProgressVersion((value) => value + 1);
        } catch (error) {
            setMessage(
                error instanceof Error ? error.message : '提交失败'
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    const snapshot = activePractice?.snapshot;
    const isMock = analysisModel.startsWith('mock');

    return (
        <main
            style={{
                maxWidth: '760px',
                margin: '40px auto',
                padding: '0 20px 60px',
            }}
        >
            <h1>English Learning</h1>
            <p style={{ color: '#6b7280', lineHeight: 1.6 }}>
                Practice Reading and Listening through resumable learning units with AI feedback and review.
            </p>

            {/* 保持组件挂载，让它接收进度刷新；练习时隐藏材料入口。 */}
            <div hidden={activePractice !== null}>
                <MaterialLibrary
                    progressVersion={progressVersion}
                    onStart={(nextSnapshot, unit) => {
                        resetPracticeState();
                        setActivePractice({
                            snapshot: nextSnapshot,
                            unit,
                        });
                    }}
                />
            </div>

            {activePractice && snapshot && (
                <section style={{ marginTop: '24px' }}>
                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => {
                            setActivePractice(null);
                            resetPracticeState();
                        }}
                    >
                        ← 返回材料库
                    </button>

                    <h2>Listening Practice</h2>
                    <p>
                        {activePractice.unit.materialTitle} · Unit{' '}
                        {activePractice.unit.order} /{' '}
                        {activePractice.unit.totalUnits}
                    </p>
                    <p>
                        {snapshot.source.difficulty} ·{' '}
                        {snapshot.exercise.topic}
                    </p>

                    {snapshot.source.sourceUrl ? (
                        <p>
                            <a
                                href={snapshot.source.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Open original source ↗
                            </a>
                        </p>
                    ) : (
                        <p>请在原播放器中收听这份材料。</p>
                    )}

                    <p>
                        Listen before revealing the transcript.
                        当前文本单元尚未与音频时间戳对齐，
                        请在原播放器中定位对应内容。
                    </p>

                    <button
                        type="button"
                        onClick={() => setShowTranscript((value) => !value)}
                    >
                        {showTranscript ? 'Hide transcript' : 'Show transcript'}
                    </button>

                    {showTranscript && (
                        <p
                            style={{
                                whiteSpace: 'pre-wrap',
                                overflowWrap: 'anywhere',
                                lineHeight: 1.8,
                            }}
                        >
                            {snapshot.source.transcript}
                        </p>
                    )}

                    <details style={{ marginTop: '20px' }}>
                        <summary>Useful phrases and vocabulary</summary>

                        <h3>Useful phrases</h3>
                        <ul>
                            {snapshot.exercise.usefulPhrases.map(
                                (phrase, index) => (
                                    <li key={index}>{phrase}</li>
                                )
                            )}
                        </ul>

                        <h3>Vocabulary</h3>
                        <dl>
                            {snapshot.exercise.vocabulary.map(
                                (item, index) => (
                                    <div key={index}>
                                        <dt><strong>{item.term}</strong></dt>
                                        <dd>{item.meaning}</dd>
                                    </div>
                                )
                            )}
                        </dl>
                    </details>

                    <h3>{snapshot.exercise.mainIdeaQuestion}</h3>
                    <p>{snapshot.exercise.summaryPrompt}</p>

                    <ul>
                        {snapshot.exercise.detailQuestions.map(
                            (question, index) => (
                                <li key={index}>{question}</li>
                            )
                        )}
                    </ul>

                    <label htmlFor="listening-answer">
                        Your English summary
                    </label>
                    <textarea
                        id="listening-answer"
                        value={answer}
                        maxLength={5_000}
                        disabled={isSubmitting || analysis !== null}
                        onChange={(event) => {
                            setAnswer(event.target.value);
                            setMessage('');
                        }}
                        style={{
                            display: 'block',
                            width: '100%',
                            boxSizing: 'border-box',
                            minHeight: '160px',
                            padding: '12px',
                            marginTop: '8px',
                            lineHeight: 1.6,
                        }}
                    />

                    {!analysis && (
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting || !answer.trim()}
                            style={{ marginTop: '12px' }}
                        >
                            {isSubmitting ? '正在提交并分析…' : 'Get AI Feedback'}
                        </button>
                    )}

                    <p role="status">{message}</p>

                    {analysis && (
                        <section>
                            <h3>Listening feedback</h3>

                            {isMock ? (
                                <p>
                                    当前为模拟模式：本单元已完成流程验证，
                                    尚未进行真实听力评估。
                                </p>
                            ) : (
                                <>
                                    <p>
                                        Understanding score:{' '}
                                        {analysis.understandingScore} / 100
                                    </p>
                                    <p>{analysis.mainIdea.feedback}</p>

                                    <h4>Important information you missed</h4>
                                    {analysis.missedKeyInformation.length ? (
                                        <ul>
                                            {analysis.missedKeyInformation.map(
                                                (item, index) => (
                                                    <li key={index}>{item}</li>
                                                )
                                            )}
                                        </ul>
                                    ) : (
                                        <p>未发现重要遗漏。</p>
                                    )}

                                    <h4>Suggested summary</h4>
                                    <p>{analysis.suggestedSummary}</p>

                                    <h4>Next improvements</h4>
                                    <ol>
                                        {analysis.improvements.map(
                                            (item, index) => (
                                                <li key={index}>{item}</li>
                                            )
                                        )}
                                    </ol>
                                </>
                            )}
                        </section>
                    )}
                </section>
            )}

            <p style={{ marginTop: '24px' }}>
                <Link href="/listening/history">
                    View listening history →
                </Link>
            </p>
        </main>
    );
}