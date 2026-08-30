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
} = vi.hoisted(() => ({
  createSessionMock: vi.fn(),
  findManySessionsMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    listeningSession: {
      create: createSessionMock,
      findMany: findManySessionsMock,
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
    }
  );

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