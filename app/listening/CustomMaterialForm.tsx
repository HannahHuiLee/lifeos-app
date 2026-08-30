'use client';

import {
  useState,
  type FormEvent,
} from 'react';

import {
  ListeningPracticeSnapshotSchema,
  type ListeningPracticeSnapshot,
  type ListeningSourceInput,
} from '@/lib/listening-contracts';

type CustomMaterialFormProps = {
  onGenerated: (
    snapshot: ListeningPracticeSnapshot
  ) => void;
};

export default function CustomMaterialForm({
  onGenerated,
}: CustomMaterialFormProps) {
  const [title, setTitle] = useState('');

  const [sourceType, setSourceType] =
    useState<
      ListeningSourceInput['sourceType']
    >('video');

  const [sourceUrl, setSourceUrl] =
    useState('');

  const [transcript, setTranscript] =
    useState('');

  const [difficulty, setDifficulty] =
    useState<
      ListeningSourceInput['difficulty']
    >('B1-B2');

  const [isGenerating, setIsGenerating] =
    useState(false);

  const [error, setError] = useState('');

  async function handleGenerate(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setIsGenerating(true);
    setError('');

    try {
      const response = await fetch(
        '/api/listening-practices/generate',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            title,
            sourceType,
            sourceUrl,
            transcript,
            difficulty,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            '生成 Listening Practice 失败'
        );
      }

      const snapshot =
        ListeningPracticeSnapshotSchema.parse({
          source: data.source,
          exercise: data.exercise,
        });

      onGenerated(snapshot);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '生成 Listening Practice 失败'
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section
      style={{
        marginTop: '28px',
        padding: '24px',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
      }}
    >
      <h2 style={{ marginTop: 0 }}>
        Add Listening Material
      </h2>

      <form
        onSubmit={handleGenerate}
        style={{
          display: 'grid',
          gap: '16px',
        }}
      >
        <label>
          Title
          <input
            required
            maxLength={120}
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            style={{
              display: 'block',
              width: '100%',
              marginTop: '6px',
            }}
          />
        </label>

        <label>
          Source type
          <select
            value={sourceType}
            onChange={(event) =>
              setSourceType(
                event.target.value as
                  ListeningSourceInput['sourceType']
              )
            }
            style={{
              display: 'block',
              width: '100%',
              marginTop: '6px',
            }}
          >
            <option value="video">Video</option>
            <option value="podcast">
              Podcast
            </option>
            <option value="audio">Audio</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label>
          Source URL (optional)
          <input
            type="url"
            value={sourceUrl}
            onChange={(event) =>
              setSourceUrl(event.target.value)
            }
            placeholder="https://..."
            style={{
              display: 'block',
              width: '100%',
              marginTop: '6px',
            }}
          />
        </label>

        <label>
          Difficulty
          <select
            value={difficulty}
            onChange={(event) =>
              setDifficulty(
                event.target.value as
                  ListeningSourceInput['difficulty']
              )
            }
            style={{
              display: 'block',
              width: '100%',
              marginTop: '6px',
            }}
          >
            <option value="B1">B1</option>
            <option value="B1-B2">
              B1-B2
            </option>
            <option value="B2">B2</option>
          </select>
        </label>

        <label>
          Transcript
          <textarea
            required
            minLength={200}
            maxLength={20_000}
            value={transcript}
            onChange={(event) =>
              setTranscript(
                event.target.value
              )
            }
            placeholder="Paste the transcript here..."
            style={{
              display: 'block',
              width: '100%',
              minHeight: '220px',
              marginTop: '6px',
              resize: 'vertical',
            }}
          />
        </label>

        <button
          type="submit"
          disabled={isGenerating}
        >
          {isGenerating
            ? 'Generating...'
            : 'Generate Practice'}
        </button>
      </form>

      {error && (
        <p
          style={{
            color: '#991b1b',
            marginBottom: 0,
          }}
        >
          {error}
        </p>
      )}
    </section>
  );
}