import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET, POST } from '@/app/api/materials/route';

const { createMaterialMock, findManyMaterialsMock } = vi.hoisted(() => ({
  createMaterialMock: vi.fn(),
  findManyMaterialsMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    material: {
      create: createMaterialMock,
      findMany: findManyMaterialsMock,
    },
  },
}));

const transcript = Array.from(
  { length: 30 },
  (_, index) =>
    `The public podcast guest explains example ${index + 1} and a useful next step.`
).join(' ');

describe('/api/materials', () => {
  beforeEach(() => {
    createMaterialMock.mockReset();
    findManyMaterialsMock.mockReset();
  });

  it('creates a podcast and nested ordered audio units', async () => {
    createMaterialMock.mockImplementation(async ({ data }) => ({
      id: 'material-1',
      ...data,
      status: 'active',
      sourceUrl: data.sourceUrl ?? null,
      createdAt: new Date('2026-09-10T12:00:00.000Z'),
      units: data.units.create.map(
        (unit: Record<string, unknown>, index: number) => ({
          id: `unit-${index + 1}`,
          status: 'pending',
          ...unit,
        })
      ),
    }));

    const response = await POST(
      new Request('http://localhost/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'podcast',
          title: 'Synthetic public podcast',
          sourceUrl: 'https://example.com/podcast',
          difficulty: 'B1-B2',
          content: transcript,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.material.totalUnits).toBeGreaterThan(1);
    expect(body.material.coveredUnits).toBe(0);
    expect(body.material.nextUnit.order).toBe(1);
    expect(
      createMaterialMock.mock.calls[0][0].data.units.create.every(
        (unit: { type: string }) => unit.type === 'audio_segment'
      )
    ).toBe(true);
  });

  it('creates a video material with listening units', async () => {
    createMaterialMock.mockImplementation(async ({ data }) => ({
      id: 'material-video',
      ...data,
      status: 'active',
      sourceUrl: data.sourceUrl ?? null,
      createdAt: new Date('2026-09-10T12:00:00.000Z'),
      units: data.units.create.map(
        (unit: Record<string, unknown>, index: number) => ({
          id: `video-unit-${index + 1}`,
          status: 'pending',
          ...unit,
        })
      ),
    }));

    const response = await POST(
      new Request('http://localhost/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'video',
          title: 'Synthetic public video',
          sourceUrl: 'https://example.com/video',
          difficulty: 'B1-B2',
          content: transcript,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.material.type).toBe('video');
    expect(
      createMaterialMock.mock.calls[0][0].data.units.create.every(
        (unit: { type: string }) => unit.type === 'audio_segment'
      )
    ).toBe(true);
  });

  it('returns persisted progress and the next unfinished unit', async () => {
    findManyMaterialsMock.mockResolvedValue([
      {
        id: 'material-1',
        type: 'podcast',
        title: 'Synthetic public podcast',
        sourceUrl: null,
        difficulty: 'B1',
        status: 'active',
        createdAt: new Date('2026-09-10T12:00:00.000Z'),
        units: [
          {
            id: 'unit-1',
            order: 1,
            type: 'audio_segment',
            content: 'A'.repeat(250),
            status: 'covered',
          },
          {
            id: 'unit-2',
            order: 2,
            type: 'audio_segment',
            content: 'B'.repeat(250),
            status: 'pending',
          },
        ],
      },
    ]);

    const response = await GET(
      new Request('http://localhost/api/materials?type=podcast')
    );
    const body = await response.json();

    expect(body.materials[0]).toMatchObject({
      totalUnits: 2,
      coveredUnits: 1,
      nextUnit: { id: 'unit-2' },
    });
    expect(findManyMaterialsMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { type: 'podcast' } })
    );
  });

  it('rejects invalid material input before persistence', async () => {
    const response = await POST(
      new Request('http://localhost/api/materials', {
        method: 'POST',
        body: JSON.stringify({
          type: 'podcast',
          title: 'Too short',
          difficulty: 'B1',
          content: 'short',
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(createMaterialMock).not.toHaveBeenCalled();
  });
});
