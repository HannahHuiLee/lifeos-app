'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { ListeningAnalysis } from '@/lib/listening-analysis';


type HistorySession = {
  id: string;
  practiceId: string;
  practice: {
    title: string;
    level: string;
  } | null;
  answer: string;
  analysis: ListeningAnalysis | null;
  model: string | null;
  createdAt: string;
};

export default function ListeningHistoryPage() {
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadHistory() {
      try {
        const response = await fetch(
          '/api/listening-sessions',
          {
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || '读取 Listening History 失败'
          );
        }

        setSessions(data.sessions);
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === 'AbortError'
        ) {
          return;
        }

        setError(
          error instanceof Error
            ? error.message
            : '读取 Listening History 失败'
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

  return (
    <main
      style={{
        maxWidth: '820px',
        margin: '40px auto',
        padding: '0 20px 60px',
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
          <h1 style={{ marginBottom: '8px' }}>
            Listening History
          </h1>

          <p style={{ margin: 0, color: '#6b7280' }}>
            Review your previous answers and listening feedback.
          </p>
        </div>

        <Link
          href="/listening"
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            backgroundColor: '#2563eb',
            color: 'white',
            textDecoration: 'none',
          }}
        >
          New practice
        </Link>
      </div>

      {isLoading && (
        <p style={{ marginTop: '32px' }}>
          Loading listening history...
        </p>
      )}

      {error && (
        <p
          style={{
            marginTop: '32px',
            padding: '16px',
            borderRadius: '8px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
          }}
        >
          {error}
        </p>
      )}

      {!isLoading && !error && sessions.length === 0 && (
        <section
          style={{
            marginTop: '32px',
            padding: '32px',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            textAlign: 'center',
          }}
        >
          <h2>No listening sessions yet</h2>

          <p style={{ color: '#6b7280' }}>
            Complete your first practice to see it here.
          </p>

          <Link href="/listening">Start listening practice</Link>
        </section>
      )}

      <div
        style={{
          display: 'grid',
          gap: '20px',
          marginTop: '32px',
        }}
      >
        {sessions.map((session) => (
          <article
            key={session.id}
            style={{
              padding: '24px',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              backgroundColor: 'white',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    color: '#6b7280',
                    fontSize: '14px',
                  }}
                >
                  {new Date(session.createdAt).toLocaleString()}
                </p>

                <h2 style={{ margin: '8px 0 0' }}>
                  {session.practice?.title ??
                    'Unknown listening practice'}
                </h2>

                <p
                  style={{
                    margin: '6px 0 0',
                    color: '#6b7280',
                  }}
                >
                  {session.practice?.level ?? session.practiceId}
                </p>
              </div>

              {session.analysis && (
                <div
                  style={{
                    minWidth: '72px',
                    padding: '12px',
                    borderRadius: '12px',
                    backgroundColor: '#dbeafe',
                    color: '#1d4ed8',
                    textAlign: 'center',
                    fontSize: '20px',
                    fontWeight: 'bold',
                  }}
                >
                  {session.analysis.understandingScore}%
                </div>
              )}
            </div>

            <h3>Your answer</h3>

            <p
              style={{
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: '#f9fafb',
                lineHeight: 1.7,
              }}
            >
              {session.answer}
            </p>

            {!session.analysis && (
              <p style={{ color: '#92400e' }}>
                This session has not been analyzed yet.
              </p>
            )}

            {session.analysis && (
              <>
                <h3>Main idea</h3>

                <p style={{ lineHeight: 1.6 }}>
                  {session.analysis.mainIdea.captured
                    ? '✅ Captured — '
                    : '🔄 Needs another listen — '}
                  {session.analysis.mainIdea.feedback}
                </p>

                {session.analysis.missedKeyInformation.length >
                  0 && (
                  <>
                    <h3>Important information missed</h3>

                    <ul style={{ lineHeight: 1.7 }}>
                      {session.analysis.missedKeyInformation.map(
                        (item, index) => (
                          <li key={index}>{item}</li>
                        )
                      )}
                    </ul>
                  </>
                )}

                <h3>Suggested summary</h3>

                <p
                  style={{
                    padding: '16px',
                    borderLeft: '4px solid #2563eb',
                    backgroundColor: '#eff6ff',
                    lineHeight: 1.7,
                  }}
                >
                  {session.analysis.suggestedSummary}
                </p>

                <h3>Next focus</h3>

                <ol style={{ lineHeight: 1.7 }}>
                  {session.analysis.improvements.map(
                    (item, index) => (
                      <li key={index}>{item}</li>
                    )
                  )}
                </ol>
              </>
            )}

            {session.model && (
              <p
                style={{
                  marginBottom: 0,
                  color: '#9ca3af',
                  fontSize: '13px',
                }}
              >
                Analyzed by {session.model}
              </p>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}