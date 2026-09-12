import { describe, expect, it } from 'vitest';

import {
  CreateMaterialInputSchema,
  getLearningUnitType,
  splitIntoLearningUnits,
  withMaterialProgress,
} from '@/lib/learning-materials';

const publicTranscript = Array.from(
  { length: 30 },
  (_, index) =>
    `The host explains public example ${index + 1} and gives a practical reason for the next step.`
).join(' ');

describe('learning material contracts', () => {
  it('validates video, podcast, and article inputs', () => {
    expect(
      CreateMaterialInputSchema.safeParse({
        type: 'video',
        title: 'Public educational video',
        sourceUrl: 'https://example.com/video',
        difficulty: 'B1-B2',
        content: publicTranscript,
      }).success
    ).toBe(true);

    expect(
      CreateMaterialInputSchema.safeParse({
        type: 'podcast',
        title: 'Public technology podcast',
        sourceUrl: 'https://example.com/podcast',
        difficulty: 'B1-B2',
        content: publicTranscript,
      }).success
    ).toBe(true);

    expect(
      CreateMaterialInputSchema.safeParse({
        type: 'article',
        title: 'Public magazine article',
        content: publicTranscript,
      }).success
    ).toBe(true);
  });

  it('rejects private-file URLs and undersized podcast content', () => {
    expect(
      CreateMaterialInputSchema.safeParse({
        type: 'podcast',
        title: 'Invalid podcast',
        sourceUrl: 'file:///private/transcript.txt',
        difficulty: 'B1',
        content: 'Too short',
      }).success
    ).toBe(false);
  });
});

describe('splitIntoLearningUnits', () => {
  it('deterministically creates multiple practiceable podcast units', () => {
    const first = splitIntoLearningUnits(publicTranscript, 'podcast');
    const second = splitIntoLearningUnits(publicTranscript, 'podcast');

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(1);
    expect(first.every((unit) => unit.length >= 200)).toBe(true);
    expect(first.join(' ')).toBe(publicTranscript);
  });

  it('creates ordered text sections for an article', () => {
    const units = splitIntoLearningUnits(publicTranscript, 'article');

    expect(units.length).toBeGreaterThan(1);
    expect(units.every((unit) => unit.length >= 120)).toBe(true);
  });

  it('groups complete article paragraphs in order and preserves single line breaks', () => {
    const paragraphs = ['A', 'B', 'C', 'D'].map(
      (label, index) => `${label.repeat(index === 2 ? 349 : 199)}\n${label.repeat(index === 2 ? 350 : 200)}`
    );
    const content = paragraphs.join('\r\n \r\n');
    const expected = [
      paragraphs.slice(0, 2).join('\n\n'),
      paragraphs.slice(2).join('\n\n'),
    ];

    expect(splitIntoLearningUnits(content, 'article')).toEqual(expected);
    expect(splitIntoLearningUnits(content, 'article')).toEqual(expected);
  });

  it('splits an oversized article paragraph safely between intact neighbors', () => {
    const before = 'Before '.repeat(30).trim();
    const long = 'A sentence with a safe boundary. '.repeat(100).trim();
    const after = 'After '.repeat(30).trim();
    const units = splitIntoLearningUnits(`${before}\n\n${long}\n\n${after}`, 'article');

    expect(units.length).toBeGreaterThan(3);
    expect(units[0]).toBe(before);
    expect(units[units.length - 1]).toContain(after);
    expect(units.every((unit) => unit.length >= 120 && unit.length <= 1_250)).toBe(true);
    expect(units.join(' ').replace(/\s+/g, ' ')).toBe(`${before} ${long} ${after}`);
    expect(splitIntoLearningUnits('x'.repeat(2_500), 'article'))
      .toEqual(['x'.repeat(1_000), 'x'.repeat(1_000), 'x'.repeat(500)]);
  });

  it.each(['video', 'podcast'] as const)('preserves existing %s boundaries', (type) => {
    const paragraphs = ['A', 'B', 'C', 'D'].map((letter) => letter.repeat(500));
    expect(splitIntoLearningUnits(paragraphs.join('\n\n'), type)).toEqual([
      paragraphs.slice(0, 2).join('\n\n'),
      paragraphs.slice(2).join('\n\n'),
    ]);
    expect(splitIntoLearningUnits('x'.repeat(600), type))
      .toEqual(['x'.repeat(300), 'x'.repeat(300)]);
  });

  it('uses listening units for video and podcast materials', () => {
    expect(getLearningUnitType('video')).toBe('audio_segment');
    expect(getLearningUnitType('podcast')).toBe('audio_segment');
    expect(getLearningUnitType('article')).toBe('text_section');

    expect(splitIntoLearningUnits(publicTranscript, 'video').length).toBeGreaterThan(
      1
    );
  });
});

describe('withMaterialProgress', () => {
  it('counts coverage and selects the first unfinished unit by order', () => {
    const progress = withMaterialProgress({
      id: 'material-1',
      type: 'podcast',
      title: 'Synthetic public podcast',
      sourceUrl: null,
      difficulty: 'B1-B2',
      status: 'active',
      createdAt: '2026-09-10T12:00:00.000Z',
      units: [
        {
          id: 'unit-2',
          order: 2,
          type: 'audio_segment',
          content: 'Second public-safe segment.',
          status: 'pending',
        },
        {
          id: 'unit-1',
          order: 1,
          type: 'audio_segment',
          content: 'First public-safe segment.',
          status: 'covered',
        },
      ],
    });

    expect(progress.coveredUnits).toBe(1);
    expect(progress.totalUnits).toBe(2);
    expect(progress.nextUnit?.id).toBe('unit-2');
  });

  it('returns no next unit when every unit is covered', () => {
    const progress = withMaterialProgress({
      id: 'material-complete',
      type: 'video',
      title: 'Completed synthetic video',
      sourceUrl: 'https://example.com/video',
      difficulty: 'B1',
      status: 'active',
      createdAt: '2026-09-10T12:00:00.000Z',
      units: [
        {
          id: 'unit-1',
          order: 1,
          type: 'audio_segment',
          content: 'First public-safe segment.',
          status: 'covered',
        },
        {
          id: 'unit-2',
          order: 2,
          type: 'audio_segment',
          content: 'Second public-safe segment.',
          status: 'covered',
        },
      ],
    });

    expect(progress.coveredUnits).toBe(2);
    expect(progress.totalUnits).toBe(2);
    expect(progress.nextUnit).toBeNull();
  });
});
