'use client';

import { useState } from 'react';
import Link from 'next/link';

import type {
  EvidenceBackedReflectionAnalysis,
  ReflectionAnalysis,
} from '@/lib/reflection-analysis';


// 添加 API 响应类型 ： 这里定义的是“前端预计从 API 收到什么”，而 EvidenceBackedReflectionAnalysis 是其中的领域数据。
type EvidenceAnalysisResponse = {
  currentReflectionId: string;

  retrieval: {
    reflectionCount: number;
    reflectionIds: string[];

    sources: Array<{
      reflectionId: string;
      date: string;
    }>;
  };

  analysis: {
    model: string;
    result: EvidenceBackedReflectionAnalysis;
  };

  validation: {
    removedEvidenceCount: number;
  };
};


export default function ReflectionPage() {
  const [content, setContent] = useState('');
  const [reflectionId, setReflectionId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ReflectionAnalysis | null>(null);

  const [
    evidenceAnalysisResponse,
    setEvidenceAnalysisResponse,
  ] = useState<EvidenceAnalysisResponse | null>(
    null
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [
    isAnalyzingWithEvidence,
    setIsAnalyzingWithEvidence,
  ] = useState(false);

  const [message, setMessage] = useState('');



  function handleContentChange(
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) {
    setContent(event.target.value);

    // 内容变化后，当前保存记录和分析已经不是最新版本。
    setReflectionId(null);
    setAnalysis(null);
    setEvidenceAnalysisResponse(null);//原因是用户修改文字后，旧结果对应的是旧 Reflection，不能继续显示。
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
    setEvidenceAnalysisResponse(null); //这样普通分析和 evidence-backed 分析不会同时显示相互混淆的旧结果。

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

  async function handleAnalyzeWithEvidence() {
    if (!reflectionId) {
      setMessage('请先保存 Reflection');
      return;
    }

    setIsAnalyzingWithEvidence(true);
    setMessage('');
    setAnalysis(null);
    setEvidenceAnalysisResponse(null);

    try {
      const response = await fetch(
        `/api/reflections/${reflectionId}/analyze-with-evidence`,
        {
          method: 'POST',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          'Evidence-backed 分析失败'
        );
      }

      setEvidenceAnalysisResponse(data);

      setMessage(
        `Evidence-backed 分析完成，模型：${data.analysis.model}`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Evidence-backed 分析失败，请稍后重试'
      );
    } finally {
      setIsAnalyzingWithEvidence(false);
    }
  }

  const isBusy = isSaving || isAnalyzing || isAnalyzingWithEvidence; //一个分析进行时禁用其他按钮，可以避免重复请求和响应覆盖。

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
        Capture a reflection, analyze it with structured AI feedback, and review patterns over time.
      </p>

      <Link href="/history">Reflection History →</Link>

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
          flexWrap: 'wrap',
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

        <button
          type="button"
          onClick={handleAnalyzeWithEvidence}
          disabled={isBusy || !reflectionId}
          style={{
            padding: '12px 20px',
            border: 'none',
            borderRadius: '8px',
            backgroundColor:
              isBusy || !reflectionId
                ? '#9ca3af'
                : '#059669',
            color: 'white',
            cursor:
              isBusy || !reflectionId
                ? 'not-allowed'
                : 'pointer',
          }}
        >
          {isAnalyzingWithEvidence
            ? '检索并分析中...'
            : 'Evidence-backed 分析'}
        </button>

      </div>

      {message && (
        <p style={{ marginTop: '16px', color: '#374151' }}>
          {message}
        </p>
      )}

      {/* {evidenceAnalysisResponse && (
        <section
          style={{
            marginTop: '32px',
            padding: '24px',
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: '12px',
          }}
        >
          <h2>Evidence-backed 分析（调试视图）</h2>

          <p>
            检索了{' '}
            {
              evidenceAnalysisResponse.retrieval
                .reflectionCount
            }{' '}
            条历史 Reflection
            {' · '}
            模型：
            {evidenceAnalysisResponse.analysis.model}
            {' · '}
            移除无效证据：
            {
              evidenceAnalysisResponse.validation
                .removedEvidenceCount
            }
          </p>

          <pre
            style={{
              marginTop: '16px',
              padding: '16px',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              fontSize: '14px',
            }}
          >
            {JSON.stringify(
              evidenceAnalysisResponse.analysis.result,
              null,
              2
            )}
          </pre>
        </section>
      )} */}


      {evidenceAnalysisResponse && (
        <EvidenceBackedResult
          response={evidenceAnalysisResponse}
        />
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



//决定整个分析结果如何展示。
function EvidenceBackedResult({
  response,
}: {
  response: EvidenceAnalysisResponse;
}) {
  const { result } = response.analysis;

  return (
    <section
      style={{
        marginTop: '32px',
        padding: '24px',
        backgroundColor: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: '12px',
      }}
    >
      <h2 style={{ marginTop: 0 }}>
        Evidence-backed Insights
      </h2>

      <p
        style={{
          color: '#4b5563',
          fontSize: '14px',
        }}
      >
        基于{' '}
        {response.retrieval.reflectionCount}{' '}
        条历史 Reflection
        {' · '}
        模型：{response.analysis.model}
      </p>

      {response.validation.removedEvidenceCount >
        0 && (
          <p
            style={{
              padding: '12px',
              color: '#92400e',
              backgroundColor: '#fef3c7',
              borderRadius: '8px',
            }}
          >
            系统已移除{' '}
            {
              response.validation
                .removedEvidenceCount
            }{' '}
            条未通过验证的证据。
          </p>
        )}

      {result.status ===
        'insufficient_evidence' ? (
        <div
          style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: 'white',
            borderRadius: '8px',
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            暂时没有足够证据
          </h3>

          <p>
            {result.insufficientEvidenceReason}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: '20px',
            marginTop: '24px',
          }}
        >
          {result.insights.map(
            (insight, insightIndex) => (
              <article
                key={`${insight.pattern}-${insightIndex}`}
                style={{
                  padding: '20px',
                  backgroundColor: 'white',
                  border: '1px solid #d1fae5',
                  borderRadius: '10px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent:
                      'space-between',
                    alignItems: 'flex-start',
                    gap: '16px',
                  }}
                >
                  <h3 style={{ margin: 0 }}>
                    {insight.pattern}
                  </h3>

                  <ConfidenceBadge
                    confidence={
                      insight.confidence
                    }
                  />
                </div>

                <p
                  style={{
                    marginTop: '16px',
                    lineHeight: '1.7',
                    color: '#374151',
                  }}
                >
                  {insight.interpretation}
                </p>

                <p
                  style={{
                    display: 'inline-block',
                    marginTop: '4px',
                    marginBottom: 0,
                    padding: '6px 10px',
                    color:
                      insight.relationship === 'supports'
                        ? '#166534'
                        : '#92400e',
                    backgroundColor:
                      insight.relationship === 'supports'
                        ? '#dcfce7'
                        : '#fef3c7',
                    borderRadius: '999px',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  {insight.relationship === 'supports'
                    ? '当前记录支持历史模式'
                    : '当前记录反驳历史模式'}
                </p>

                <details
                  style={{
                    marginTop: '16px',
                    padding: '12px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                  }}
                >
                  <summary
                    style={{
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    查看 Grounding（当前 1 · 历史{' '}
                    {insight.evidence.length}）
                  </summary>

                  <div
                    style={{
                      display: 'grid',
                      gap: '12px',
                      marginTop: '16px',
                    }}
                  >
                    <div>
                      <p
                        style={{
                          marginTop: 0,
                          marginBottom: '8px',
                          color: '#1d4ed8',
                          fontSize: '13px',
                          fontWeight: 600,
                        }}
                      >
                        当前 Reflection
                      </p>

                      <blockquote
                        style={{
                          margin: 0,
                          padding: '12px',
                          borderLeft: '4px solid #3b82f6',
                          backgroundColor: 'white',
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            lineHeight: '1.6',
                          }}
                        >
                          “{insight.currentEvidence.excerpt}”
                        </p>

                        <footer
                          style={{
                            marginTop: '8px',
                            color: '#6b7280',
                            fontSize: '13px',
                          }}
                        >
                          当前记录 · ID：
                          {insight.currentEvidence.reflectionId}
                        </footer>
                      </blockquote>
                    </div>

                    <p
                      style={{
                        margin: 0,
                        color: '#047857',
                        fontSize: '13px',
                        fontWeight: 600,
                      }}
                    >
                      历史 Evidence
                    </p>
                    {insight.evidence.map(
                      (
                        evidence,
                        evidenceIndex
                      ) => {
                        const source =
                          response.retrieval.sources.find(
                            (item) =>
                              item.reflectionId ===
                              evidence.reflectionId
                          );

                        return (
                          <blockquote
                            key={`${evidence.reflectionId}-${evidenceIndex}`}
                            style={{
                              margin: 0,
                              padding: '12px',
                              borderLeft:
                                '4px solid #10b981',
                              backgroundColor:
                                'white',
                            }}
                          >
                            <p
                              style={{
                                margin: 0,
                                lineHeight: '1.6',
                              }}
                            >
                              “{evidence.excerpt}”
                            </p>

                            <footer
                              style={{
                                marginTop:
                                  '8px',
                                color:
                                  '#6b7280',
                                fontSize:
                                  '13px',
                              }}
                            >
                              {source
                                ? new Date(
                                  source.date
                                ).toLocaleDateString(
                                  'zh-CN'
                                )
                                : '日期不可用'}
                              {' · '}
                              ID：
                              {
                                evidence.reflectionId
                              }
                            </footer>
                          </blockquote>
                        );
                      }
                    )}
                  </div>
                </details>
              </article>
            )
          )}
        </div>
      )}
    </section>
  );
}

//只负责置信度标签。
function ConfidenceBadge({
  confidence,
}: {
  confidence: 'low' | 'medium' | 'high';
}) {
  const labels = {
    low: '低置信度',
    medium: '中置信度',
    high: '高置信度',
  };

  const colors = {
    low: '#6b7280',
    medium: '#d97706',
    high: '#047857',
  };

  return (
    <span
      style={{
        flexShrink: 0,
        padding: '4px 8px',
        color: colors[confidence],
        backgroundColor: '#f3f4f6',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 600,
      }}
    >
      {labels[confidence]}
    </span>
  );
}