'use client';

import { useEffect, useState, type FormEvent } from 'react';

import {
  ListeningPracticeSnapshotSchema,
  type ListeningPracticeSnapshot,
} from '@/lib/listening-contracts';
import type {
  MaterialProgress,
  MaterialWithUnits,
} from '@/lib/learning-materials';

export type ActiveLearningUnit = {
  id: string;
  materialTitle: string;
  order: number;
  totalUnits: number;
};

type MaterialLibraryProps = {
  progressVersion: number;
  onStart: (
    snapshot: ListeningPracticeSnapshot,
    unit: ActiveLearningUnit
  ) => void;
};

export default function MaterialLibrary({
  progressVersion,
  onStart,
}: MaterialLibraryProps) {
  const [materials, setMaterials] = useState<MaterialProgress[]>([]);
  const [type, setType] = useState<MaterialWithUnits['type']>('podcast');
  const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [difficulty, setDifficulty] = useState('B1-B2');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [startingUnitId, setStartingUnitId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadMaterials() {
      try {
        const response = await fetch('/api/materials', {
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || '读取 Materials 失败');
        }

        setMaterials(data.materials);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        setError(error instanceof Error ? error.message : '读取 Materials 失败');
      }
    }

    loadMaterials();
    return () => controller.abort();
  }, [progressVersion]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      const response = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title,
          sourceUrl,
          content,
          ...(type !== 'article' ? { difficulty } : {}),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '保存 Material 失败');
      }

      setMaterials((current) => [data.material, ...current]);
      setTitle('');
      setSourceUrl('');
      setContent('');
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存 Material 失败');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStart(
    material: MaterialProgress,
    unit: MaterialWithUnits['units'][number]
  ) {
    if (material.type === 'article') {
      return;
    }

    setStartingUnitId(unit.id);
    setError('');

    try {
      const response = await fetch('/api/listening-practices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${material.title} — Unit ${unit.order}`,
          sourceType: material.type,
          sourceUrl: material.sourceUrl ?? '',
          transcript: unit.content,
          difficulty: material.difficulty ?? 'B1-B2',
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '生成 Listening Practice 失败');
      }

      const snapshot = ListeningPracticeSnapshotSchema.parse({
        source: data.source,
        exercise: data.exercise,
      });

      onStart(snapshot, {
        id: unit.id,
        materialTitle: material.title,
        order: unit.order,
        totalUnits: material.totalUnits,
      });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : '生成 Listening Practice 失败'
      );
    } finally {
      setStartingUnitId('');
    }
  }

  return (
    <section
      style={{
        marginTop: '28px',
        padding: '24px',
        border: '1px solid #bfdbfe',
        borderRadius: '12px',
        backgroundColor: '#eff6ff',
      }}
    >
      <h2 style={{ marginTop: 0 }}>Material Library</h2>
      <p style={{ color: '#4b5563', lineHeight: 1.6 }}>
        Save a podcast transcript as resumable units, or save pasted article text
        as the foundation for a future Reading Coach. Video materials use the
        same resumable Listening Coach flow.
      </p>

      <form onSubmit={handleCreate} style={{ display: 'grid', gap: '14px' }}>
        <label>
          Material type
          <select
            value={type}
            onChange={(event) =>
              setType(event.target.value as MaterialWithUnits['type'])
            }
            style={{ display: 'block', width: '100%', marginTop: '6px' }}
          >
            <option value="video">Video / YouTube</option>
            <option value="podcast">Podcast</option>
            <option value="article">Article / magazine</option>
          </select>
        </label>

        <label>
          Title
          <input
            required
            maxLength={120}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            style={{ display: 'block', width: '100%', marginTop: '6px' }}
          />
        </label>

        <label>
          Source URL (optional)
          <input
            type="url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://..."
            style={{ display: 'block', width: '100%', marginTop: '6px' }}
          />
        </label>

        {type !== 'article' && (
          <label>
            Difficulty
            <select
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
              style={{ display: 'block', width: '100%', marginTop: '6px' }}
            >
              <option value="B1">B1</option>
              <option value="B1-B2">B1-B2</option>
              <option value="B2">B2</option>
            </select>
          </label>
        )}

        <label>
          {type === 'article' ? 'Article text' : 'Transcript'}
          <textarea
            required
            minLength={type === 'article' ? 200 : 400}
            maxLength={50_000}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={
              type === 'article'
                ? 'Paste public or public-safe article text...'
                : 'Paste a public or public-safe transcript...'
            }
            style={{
              display: 'block',
              width: '100%',
              minHeight: '180px',
              marginTop: '6px',
              resize: 'vertical',
            }}
          />
        </label>

        <button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : `Save ${type}`}
        </button>
      </form>

      {error && <p style={{ color: '#991b1b' }}>{error}</p>}

      <div style={{ display: 'grid', gap: '14px', marginTop: '24px' }}>
        {materials.map((material) => (
          <article
            key={material.id}
            style={{ padding: '16px', borderRadius: '10px', background: 'white' }}
          >
            <strong>{material.title}</strong>
            <p style={{ margin: '6px 0', color: '#4b5563' }}>
              {material.type === 'video'
                ? 'Video'
                : material.type === 'podcast'
                  ? 'Podcast'
                  : 'Article'}{' '}
              ·{' '}
              {material.coveredUnits} / {material.totalUnits} units covered
            </p>

            {material.type !== 'article' && material.nextUnit && (
              <button
                type="button"
                disabled={Boolean(startingUnitId)}
                onClick={() => handleStart(material, material.nextUnit!)}
              >
                {startingUnitId === material.nextUnit.id
                  ? 'Generating...'
                  : `Continue Unit ${material.nextUnit.order}`}
              </button>
            )}

            {material.type !== 'article' && !material.nextUnit && (
              <span style={{ color: '#166534' }}>All units covered</span>
            )}

            {material.type === 'article' && (
              <span style={{ color: '#6b7280' }}>
                Text units saved; Reading Coach is not included in this V1.
              </span>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
