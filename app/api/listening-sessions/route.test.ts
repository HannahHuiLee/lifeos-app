import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { POST } from '@/app/api/listening-sessions/route';

const {
  createSessionMock,
  findManySessionsMock,
  findUniqueUnitMock,
} = vi.hoisted(() => ({
  createSessionMock: vi.fn(),
  findManySessionsMock: vi.fn(),
  findUniqueUnitMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    listeningSession: {
      create: createSessionMock,
      findMany: findManySessionsMock,
    },
    learningUnit: {
      findUnique: findUniqueUnitMock,
    },
  },
}));

const validSnapshot = {
  source: {
    title: 'How AI Changes Technical Work',
    sourceType: 'video',
    sourceUrl: 'https://example.com/video',
    transcript: 'A'.repeat(500),
    difficulty: 'B1-B2',
  },

  exercise: {
    topic: 'AI in technical work',
    mainIdeaQuestion:
      "What is the speaker's main point?",
    detailQuestions: [
      'What change does the speaker describe?',
      'Why does the speaker think it matters?',
    ],
    usefulPhrases: [
      'from my perspective',
      'the main challenge is',
      'a practical next step',
    ],
    vocabulary: [
      {
        term: 'workflow',
        meaning: 'a sequence of work steps',
      },
      {
        term: 'automation',
        meaning:
          'using technology to perform tasks',
      },
      {
        term: 'trade-off',
        meaning:
          'a balance between competing advantages',
      },
    ],
    summaryPrompt:
      'Summarize the main point and two important details.',
  },
};

function snapshotWithSourceType(sourceType: 'video' | 'podcast') {
  return {
    ...validSnapshot,
    source: {
      ...validSnapshot.source,
      sourceType,
    },
  };
}

function createRequest(
  body: unknown,
  raw = false
) {
  return new Request(
    'http://localhost/api/listening-sessions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: raw
        ? String(body)
        : JSON.stringify(body),
    }
  );
}

describe('POST /api/listening-sessions', () => {
  beforeEach(() => {
    createSessionMock.mockReset();
    findUniqueUnitMock.mockReset();

    createSessionMock.mockImplementation(
      async ({ data }) => ({
        id: 'session-1',
        ...data,
        analysis: null,
        model: null,
        createdAt: new Date(
          '2026-08-30T16:00:00.000Z'
        ),
      })
    );
  });

  it(
    'preserves the legacy practice flow',
    async () => {
      const response = await POST(
        createRequest({
          practiceId: 'team-picnic-ride',
          answer: '  Daniel needs a ride.  ',
        })
      );

      expect(response.status).toBe(201);

      expect(
        createSessionMock
      ).toHaveBeenCalledWith({
        data: {
          practiceId: 'team-picnic-ride',
          practiceSnapshot: undefined,
          learningUnitId: undefined,
          answer: 'Daniel needs a ride.',
        },
      });
    }
  );

  it(
    'serializes and saves a custom snapshot',
    async () => {
      const response = await POST(
        createRequest({
          practiceSnapshot: validSnapshot,
          answer:
            '  AI is changing technical workflows.  ',
        })
      );

      expect(response.status).toBe(201);

      const createArguments =
        createSessionMock.mock.calls[0][0];

      expect(createArguments.data).toMatchObject({
        practiceId: 'custom',
        answer:
          'AI is changing technical workflows.',
      });

      expect(
        JSON.parse(
          createArguments.data.practiceSnapshot
        )
      ).toEqual(validSnapshot);
      expect(createArguments.data.learningUnitId).toBeUndefined();
    }
  );

  it('links a matching podcast unit to the session', async () => {
    const podcastSnapshot = snapshotWithSourceType('podcast');

    findUniqueUnitMock.mockResolvedValue({
      id: 'unit-1',
      type: 'audio_segment',
      content: podcastSnapshot.source.transcript,
      status: 'pending',
      material: { type: 'podcast' },
    });

    const response = await POST(
      createRequest({
        practiceSnapshot: podcastSnapshot,
        learningUnitId: 'unit-1',
        answer: 'AI is changing technical workflows.',
      })
    );

    expect(response.status).toBe(201);
    expect(createSessionMock.mock.calls[0][0].data.learningUnitId).toBe(
      'unit-1'
    );
  });

  it('links a matching video unit to the session', async () => {
    findUniqueUnitMock.mockResolvedValue({
      id: 'unit-video',
      type: 'audio_segment',
      content: validSnapshot.source.transcript,
      status: 'pending',
      material: { type: 'video' },
    });

    const response = await POST(
      createRequest({
        practiceSnapshot: validSnapshot,
        learningUnitId: 'unit-video',
        answer: 'AI is changing technical workflows.',
      })
    );

    expect(response.status).toBe(201);
    expect(createSessionMock.mock.calls[0][0].data.learningUnitId).toBe(
      'unit-video'
    );
  });

  it('rejects a snapshot source type that does not match its material', async () => {
    findUniqueUnitMock.mockResolvedValue({
      id: 'unit-1',
      type: 'audio_segment',
      content: validSnapshot.source.transcript,
      status: 'pending',
      material: { type: 'podcast' },
    });

    const response = await POST(
      createRequest({
        practiceSnapshot: validSnapshot,
        learningUnitId: 'unit-1',
        answer: 'My summary.',
      })
    );

    expect(response.status).toBe(400);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it('rejects a snapshot that does not match its unit content', async () => {
    findUniqueUnitMock.mockResolvedValue({
      id: 'unit-1',
      type: 'audio_segment',
      content: 'Different persisted content',
      status: 'pending',
      material: { type: 'podcast' },
    });

    const response = await POST(
      createRequest({
        practiceSnapshot: snapshotWithSourceType('podcast'),
        learningUnitId: 'unit-1',
        answer: 'My summary.',
      })
    );

    expect(response.status).toBe(400);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it('rejects an article unit for Listening Coach', async () => {
    findUniqueUnitMock.mockResolvedValue({
      id: 'unit-1',
      type: 'text_section',
      content: validSnapshot.source.transcript,
      status: 'pending',
      material: { type: 'article' },
    });

    const response = await POST(
      createRequest({
        practiceSnapshot: validSnapshot,
        learningUnitId: 'unit-1',
        answer: 'My summary.',
      })
    );

    const body = await response.json();

    expect(body.error).toBe(
      '这个 Learning Unit 不能用于 Listening Coach'
    );
    expect(findUniqueUnitMock).toHaveBeenCalled();

    expect(response.status).toBe(400);
    expect(createSessionMock).not.toHaveBeenCalled();

  });

  it(
    'rejects an invalid custom snapshot',
    async () => {
      const response = await POST(
        createRequest({
          practiceSnapshot: {
            ...validSnapshot,
            source: {
              ...validSnapshot.source,
              transcript: 'Too short',
            },
          },
          answer: 'My summary.',
        })
      );

      expect(response.status).toBe(400);
      expect(
        createSessionMock
      ).not.toHaveBeenCalled();
    }
  );

  it(
    'rejects an unknown legacy practice',
    async () => {
      const response = await POST(
        createRequest({
          practiceId: 'unknown-practice',
          answer: 'My summary.',
        })
      );

      expect(response.status).toBe(404);
      expect(
        createSessionMock
      ).not.toHaveBeenCalled();
    }
  );

  it(
    'rejects malformed JSON',
    async () => {
      const response = await POST(
        createRequest('{"answer":', true)
      );

      expect(response.status).toBe(400);
      expect(
        createSessionMock
      ).not.toHaveBeenCalled();
    }
  );
});
