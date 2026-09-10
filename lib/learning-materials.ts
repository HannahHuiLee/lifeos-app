import { z } from 'zod';

const OptionalHttpUrlSchema = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === ''
      ? undefined
      : value,
  z
    .string()
    .trim()
    .url()
    .refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === 'http:' || protocol === 'https:';
    }, 'sourceUrl must use http or https')
    .optional()
);

const BaseMaterialInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  sourceUrl: OptionalHttpUrlSchema,
});

const ListeningMaterialFields = {
  difficulty: z.enum(['B1', 'B1-B2', 'B2']),
  content: z.string().trim().min(400).max(50_000),
};

export const CreateMaterialInputSchema = z.discriminatedUnion(
  'type',
  [
    BaseMaterialInputSchema.extend({
      type: z.literal('video'),
      ...ListeningMaterialFields,
    }),
    BaseMaterialInputSchema.extend({
      type: z.literal('podcast'),
      ...ListeningMaterialFields,
    }),
    BaseMaterialInputSchema.extend({
      type: z.literal('article'),
      content: z.string().trim().min(200).max(50_000),
    }),
  ]
);

export const MaterialTypeSchema = z.enum([
  'video',
  'podcast',
  'article',
]);
export const ListeningMaterialTypeSchema = z.enum(['video', 'podcast']);
export const LearningUnitTypeSchema = z.enum([
  'audio_segment',
  'text_section',
]);
export const LearningUnitStatusSchema = z.enum(['pending', 'covered']);

export type CreateMaterialInput = z.infer<
  typeof CreateMaterialInputSchema
>;

export type MaterialWithUnits = {
  id: string;
  type: z.infer<typeof MaterialTypeSchema>;
  title: string;
  sourceUrl: string | null;
  difficulty: string | null;
  status: string;
  createdAt: Date | string;
  units: Array<{
    id: string;
    order: number;
    type: z.infer<typeof LearningUnitTypeSchema>;
    content: string;
    status: 'pending' | 'covered';
  }>;
};

export type MaterialProgress = MaterialWithUnits & {
  totalUnits: number;
  coveredUnits: number;
  nextUnit: MaterialWithUnits['units'][number] | null;
};

export function splitIntoLearningUnits(
  content: string,
  type: CreateMaterialInput['type']
): string[] {
  const normalized = content.trim().replace(/\r\n/g, '\n');
  const isListeningMaterial = isListeningMaterialType(type);
  const minimumSize = isListeningMaterial ? 200 : 120;
  const targetSize = isListeningMaterial ? 1_200 : 1_000;
  const segments: string[] = [];
  let remaining = normalized;

  while (remaining.length > targetSize + minimumSize) {
    const boundary = findBoundary(remaining, targetSize, minimumSize);
    segments.push(remaining.slice(0, boundary).trim());
    remaining = remaining.slice(boundary).trim();
  }

  if (remaining) {
    segments.push(remaining);
  }

  // A podcast material must prove the multi-unit lifecycle. For shorter valid
  // transcripts, split near the midpoint when both halves remain practiceable.
  if (
    isListeningMaterial &&
    segments.length === 1 &&
    normalized.length >= minimumSize * 2
  ) {
    const boundary = findBoundary(
      normalized,
      Math.floor(normalized.length / 2),
      minimumSize
    );
    const first = normalized.slice(0, boundary).trim();
    const second = normalized.slice(boundary).trim();

    if (first.length >= minimumSize && second.length >= minimumSize) {
      return [first, second];
    }
  }

  return segments;
}

export function isListeningMaterialType(
  type: z.infer<typeof MaterialTypeSchema>
): type is z.infer<typeof ListeningMaterialTypeSchema> {
  return ListeningMaterialTypeSchema.safeParse(type).success;
}

export function getLearningUnitType(
  materialType: z.infer<typeof MaterialTypeSchema>
): z.infer<typeof LearningUnitTypeSchema> {
  return isListeningMaterialType(materialType)
    ? 'audio_segment'
    : 'text_section';
}

function findBoundary(
  text: string,
  target: number,
  minimum: number
): number {
  const lower = Math.max(minimum, target - 250);
  const upper = Math.min(text.length - minimum, target + 250);
  const window = text.slice(lower, upper);
  const candidates = [
    window.lastIndexOf('\n\n'),
    window.lastIndexOf('. '),
    window.lastIndexOf('? '),
    window.lastIndexOf('! '),
    window.lastIndexOf(' '),
  ].filter((index) => index >= 0);

  if (candidates.length === 0) {
    return target;
  }

  const relative = Math.max(...candidates);
  const boundary = lower + relative;
  const punctuation = text.slice(boundary, boundary + 2);

  return punctuation === '\n\n' ? boundary + 2 : boundary + 1;
}

export function withMaterialProgress(
  material: MaterialWithUnits
): MaterialProgress {
  const orderedUnits = [...material.units].sort(
    (left, right) => left.order - right.order
  );
  const coveredUnits = orderedUnits.filter(
    (unit) => unit.status === 'covered'
  ).length;

  return {
    ...material,
    units: orderedUnits,
    totalUnits: orderedUnits.length,
    coveredUnits,
    nextUnit:
      orderedUnits.find((unit) => unit.status === 'pending') ?? null,
  };
}
