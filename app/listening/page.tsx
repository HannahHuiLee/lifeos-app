'use client';

import Link from 'next/link';

import { useState } from 'react';

import { listeningPractices } from '@/lib/listening-practices';
import type { ListeningAnalysis } from '@/lib/listening-analysis';


export default function ListeningPage() {
    const practice = listeningPractices[0];

    // const [isPlaying, setIsPlaying] = useState(false);
    const [showTranscript, setShowTranscript] = useState(false);
    // const [message, setMessage] = useState('');

    // Write Answer → Save → Mock AI Analyze
    const [answer, setAnswer] = useState('');
    const [analysis, setAnalysis] =
        useState<ListeningAnalysis | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitMessage, setSubmitMessage] = useState('');

    function handleAnswerChange(
        event: React.ChangeEvent<HTMLTextAreaElement>
    ) {
        setAnswer(event.target.value);
        setAnalysis(null);
        setSubmitMessage('');
    }

    async function handleSubmit() {
        if (!answer.trim()) {
            setSubmitMessage('请先写下你的英文总结。');
            return;
        }

        setIsSubmitting(true);
        setAnalysis(null);
        setSubmitMessage('');

        try {
            const saveResponse = await fetch(
                '/api/listening-sessions',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        practiceId: practice.id,
                        answer,
                    }),
                }
            );

            const saveData = await saveResponse.json();

            if (!saveResponse.ok) {
                throw new Error(saveData.error || '保存答案失败');
            }

            const analyzeResponse = await fetch(
                `/api/listening-sessions/${saveData.session.id}/analyze`,
                {
                    method: 'POST',
                }
            );

            const analyzeData = await analyzeResponse.json();

            if (!analyzeResponse.ok) {
                throw new Error(analyzeData.error || 'AI 分析失败');
            }

            setAnalysis(analyzeData.session.analysis);
            setSubmitMessage('练习已分析并保存。');
        } catch (error) {
            setSubmitMessage(
                error instanceof Error
                    ? error.message
                    : '提交失败，请稍后重试'
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main
            style={{
                maxWidth: '760px',
                margin: '40px auto',
                padding: '0 20px 60px',
            }}
        >
            <h1>Listening Coach</h1>

            <p style={{ color: '#6b7280', lineHeight: 1.6 }}>
                Listen first. Try to understand the situation without
                translating every word.
            </p>

            <section
                style={{
                    marginTop: '28px',
                    padding: '24px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    backgroundColor: '#f9fafb',
                }}
            >
                <p style={{ margin: 0, color: '#6b7280' }}>
                    {practice.level}
                </p>

                <h2 style={{ marginTop: '8px' }}>{practice.title}</h2>

                <audio
                    controls
                    preload="metadata"
                    style={{
                        width: '100%',
                        marginTop: '20px',
                    }}
                >
                    <source src={practice.audioSrc} type="audio/mpeg" />

                    Your browser does not support audio playback.
                </audio>

                <p
                    style={{
                        margin: '8px 0 0',
                        color: '#6b7280',
                        fontSize: '13px',
                    }}
                >
                    This lesson uses an AI-generated voice.
                </p>

                <button
                    type="button"
                    onClick={() => setShowTranscript((value) => !value)}
                    style={{
                        marginTop: '18px',
                    }}
                >
                    {showTranscript ? 'Hide transcript' : 'Show transcript'}
                </button>

                {showTranscript && (
                    <div
                        style={{
                            marginTop: '24px',
                            paddingTop: '20px',
                            borderTop: '1px solid #e5e7eb',
                        }}
                    >
                        <h3>Transcript</h3>

                        {practice.turns.map((turn, index) => (
                            <p key={index} style={{ lineHeight: 1.6 }}>
                                <strong>{turn.speaker}:</strong> {turn.text}
                            </p>
                        ))}
                    </div>
                )}
            </section>

            <section
                style={{
                    marginTop: '28px',
                    padding: '24px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                }}
            >
                <h2>What are they talking about?</h2>

                <p style={{ color: '#6b7280', lineHeight: 1.6 }}>
                    Use simple English. Think about: Who? What happened?
                    Why? What&apos;s next?
                </p>

                <textarea
                    value={answer}
                    onChange={handleAnswerChange}
                    disabled={isSubmitting}
                    placeholder="They are talking about..."
                    style={{
                        width: '100%',
                        minHeight: '160px',
                        marginTop: '12px',
                        padding: '14px',
                        boxSizing: 'border-box',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '16px',
                        lineHeight: 1.6,
                        resize: 'vertical',
                    }}
                />

                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting || !answer.trim()}
                    style={{
                        marginTop: '16px',
                        padding: '12px 20px',
                        border: 'none',
                        borderRadius: '8px',
                        backgroundColor:
                            isSubmitting || !answer.trim() ? '#9ca3af' : '#2563eb',
                        color: 'white',
                        cursor:
                            isSubmitting || !answer.trim()
                                ? 'not-allowed'
                                : 'pointer',
                    }}
                >
                    {isSubmitting ? 'Analyzing...' : 'Get AI Feedback'}
                </button>

                {submitMessage && (
                    <p style={{ marginTop: '16px' }}>{submitMessage}</p>
                )}

                {analysis && (
                    <section
                        style={{
                            marginTop: '28px',
                            padding: '24px',
                            border: '1px solid #bfdbfe',
                            borderRadius: '12px',
                            backgroundColor: '#eff6ff',
                        }}
                    >
                        <h2 style={{ marginTop: 0 }}>Your Listening Feedback</h2>

                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                flexWrap: 'wrap',
                            }}
                        >
                            <div
                                style={{
                                    width: '84px',
                                    height: '84px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '50%',
                                    backgroundColor: '#2563eb',
                                    color: 'white',
                                    fontSize: '24px',
                                    fontWeight: 'bold',
                                }}
                            >
                                {analysis.understandingScore}%
                            </div>

                            <div>
                                <h3 style={{ margin: 0 }}>Main idea</h3>

                                <p style={{ margin: '6px 0 0' }}>
                                    {analysis.mainIdea.captured
                                        ? '✅ You captured the main idea.'
                                        : '🔄 The main idea needs another listen.'}
                                </p>
                            </div>
                        </div>

                        <p style={{ marginTop: '20px', lineHeight: 1.6 }}>
                            {analysis.mainIdea.feedback}
                        </p>

                        <h3>Key information</h3>

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns:
                                    'repeat(auto-fit, minmax(140px, 1fr))',
                                gap: '10px',
                            }}
                        >
                            {[
                                {
                                    label: 'Who?',
                                    captured: analysis.keyInformation.who,
                                },
                                {
                                    label: 'What happened?',
                                    captured: analysis.keyInformation.whatHappened,
                                },
                                {
                                    label: 'Why?',
                                    captured: analysis.keyInformation.why,
                                },
                                {
                                    label: "What's next?",
                                    captured: analysis.keyInformation.whatsNext,
                                },
                            ].map((item) => (
                                <div
                                    key={item.label}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '8px',
                                        backgroundColor: item.captured
                                            ? '#dcfce7'
                                            : '#fef3c7',
                                    }}
                                >
                                    <strong>
                                        {item.captured ? '✓' : '○'} {item.label}
                                    </strong>
                                </div>
                            ))}
                        </div>

                        <h3>Important information you missed</h3>

                        {analysis.missedKeyInformation.length === 0 ? (
                            <p>没有遗漏重要信息，很好！</p>
                        ) : (
                            <ul style={{ lineHeight: 1.7 }}>
                                {analysis.missedKeyInformation.map((item, index) => (
                                    <li key={index}>{item}</li>
                                ))}
                            </ul>
                        )}

                        <h3>A simple, natural summary</h3>

                        <p
                            style={{
                                padding: '16px',
                                borderLeft: '4px solid #2563eb',
                                backgroundColor: 'white',
                                lineHeight: 1.7,
                            }}
                        >
                            {analysis.suggestedSummary}
                        </p>

                        <h3>Focus on these next time</h3>

                        <ol style={{ lineHeight: 1.7 }}>
                            {analysis.improvements.map((item, index) => (
                                <li key={index}>{item}</li>
                            ))}
                        </ol>
                    </section>
                )}
            </section>

            <Link href="/listening/history">
                View listening history →
            </Link>

        </main>
    );
}