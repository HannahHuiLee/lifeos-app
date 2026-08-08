'use client';

import { useState } from 'react';

import type { ReflectionAnalysis } from '@/lib/reflection-analysis';

export default function ReflectionPage() {
  const [content, setContent] = useState('');
  const [reflectionId, setReflectionId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ReflectionAnalysis | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [message, setMessage] = useState('');

  function handleContentChange(
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) {
    setContent(event.target.value);

    // 内容变化后，当前保存记录和分析已经不是最新版本。
    setReflectionId(null);
    setAnalysis(null);
    setMessage('');
  }

  async function handleSave() {
    if (!content.trim()) {
      setMessage('请输入 Reflection 内容');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setAnalysis(null);

    try {
      const response = await fetch('/api/reflections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '保存失败');
      }

      setReflectionId(data.reflection.id);
      setMessage('Reflection 已保存，现在可以进行 AI 分析。');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '保存失败，请稍后重试'
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAnalyze() {
    if (!reflectionId) {
      setMessage('请先保存 Reflection');
      return;
    }

    setIsAnalyzing(true);
    setMessage('');
    setAnalysis(null);

    try {
      const response = await fetch(
        `/api/reflections/${reflectionId}/analyze`,
        {
          method: 'POST',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '分析失败');
      }

      setAnalysis(data.analysis.result);
      setMessage(`分析完成，模型：${data.analysis.model}`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '分析失败，请稍后重试'
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  const isBusy = isSaving || isAnalyzing;

  return (
    <div
      style={{
        maxWidth: '760px',
        margin: '40px auto',
        padding: '0 20px 60px',
      }}
    >
      <h1>今日 Reflection</h1>

      <p style={{ color: '#666', marginTop: '8px' }}>
        写下今天发生了什么、你的感受，以及你从中学到了什么。
      </p>

      <textarea
        value={content}
        onChange={handleContentChange}
        placeholder="今天发生了什么？你有什么感受？"
        disabled={isBusy}
        style={{
          width: '100%',
          minHeight: '240px',
          marginTop: '24px',
          padding: '16px',
          fontSize: '16px',
          lineHeight: '1.6',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />

      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginTop: '16px',
        }}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={isBusy || !content.trim()}
          style={{
            padding: '12px 20px',
            border: 'none',
            borderRadius: '8px',
            backgroundColor: isSaving ? '#9ca3af' : '#2563eb',
            color: 'white',
            cursor: isBusy ? 'not-allowed' : 'pointer',
          }}
        >
          {isSaving ? '保存中...' : '保存 Reflection'}
        </button>

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={isBusy || !reflectionId}
          style={{
            padding: '12px 20px',
            border: 'none',
            borderRadius: '8px',
            backgroundColor:
              isBusy || !reflectionId ? '#9ca3af' : '#7c3aed',
            color: 'white',
            cursor:
              isBusy || !reflectionId ? 'not-allowed' : 'pointer',
          }}
        >
          {isAnalyzing ? '分析中...' : 'AI 分析'}
        </button>
      </div>

      {message && (
        <p style={{ marginTop: '16px', color: '#374151' }}>
          {message}
        </p>
      )}

      {analysis && (
        <section
          style={{
            marginTop: '32px',
            padding: '24px',
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
          }}
        >
          <h2>AI 分析结果</h2>

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
                  强度 {emotion.intensity}/10
                  {' — '}
                  {emotion.evidence}
                </li>
              ))}
            </ul>
          )}

          <h3>做得好的地方</h3>
          <ul>
            {analysis.wins.map((win, index) => (
              <li key={index}>{win}</li>
            ))}
          </ul>

          <h3>遇到的挑战</h3>
          <ul>
            {analysis.challenges.map((challenge, index) => (
              <li key={index}>{challenge}</li>
            ))}
          </ul>

          <h3>洞察</h3>
          <ul>
            {analysis.insights.map((insight, index) => (
              <li key={index}>{insight}</li>
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
        </section>
      )}
    </div>
  );
}