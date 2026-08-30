import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { POST } from '@/app/api/listening-sessions/[id]/analyze/route';

const {
  findUniqueSessionMock,
  updateSessionMock,
  parseResponseMock,
} = vi.hoisted(() => ({
  findUniqueSessionMock: vi.fn(),
  updateSessionMock: vi.fn(),
  parseResponseMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    listeningSession: {
      findUnique: findUniqueSessionMock,
      update: updateSessionMock,
    },
  },
}));

vi.mock('openai', () => {
  class MockOpenAI {
    responses = {
      parse: parseResponseMock,
    };
  }

  return {
    default: MockOpenAI,
  };
});

const customTranscript = (
  'CUSTOM TRANSCRIPT: AI changes code review workflows. '
).repeat(8);

const customSnapshot = {
  source: {
    title: 'AI and Code Review',
    sourceType: 'video',
    sourceUrl: 'https://example.com/video',
    transcript: customTranscript,
    difficulty: 'B1-B2',
  },

  exercise: {
    topic: 'AI-assisted code review',
    mainIdeaQuestion:
      'How is AI changing code review?',
    detailQuestions: [
      'What benefit does the speaker describe?',
      'What concern does the speaker mention?',
    ],
    usefulPhrases: [
      'from my perspective',
      'the main concern is',
      'a practical next step',
    ],
    vocabulary: [
      {
        term: 'workflow',
        meaning: 'a sequence of work steps',
      },
      {
        term: 'code review',
        meaning:
          'checking code before it is accepted',
      },
      {
        term: 'automation',
        meaning:
          'using technology to perform tasks',
      },
    ],
    summaryPrompt:
      'Summarize the main point and two details.',
  },
};

const validAnalysis = {
  understandingScore: 75,

  mainIdea: {
    captured: true,
    feedback: '你理解了主要观点。',
  },

  keyInformation: {
    who: true,
    whatHappened: true,
    why: true,
    whatsNext: false,
  },

  missedKeyInformation: [
    '你遗漏了一个后续步骤。',
  ],

  suggestedSummary:
    'AI is changing code review workflows.',

  improvements: [
    '补充一个具体细节。',
  ],
};

function createSession(
  overrides: Record<string, unknown>
) {
  return {
    id: 'session-1',
    practiceId: 'custom',
    practiceSnapshot: null,
    answer:
      'AI is changing technical workflows.',
    analysis: null,
    model: null,
    createdAt: new Date(
      '2026-08-30T16:00:00.000Z'
    ),
    ...overrides,
  };
}

async function analyzeSession() {
  return POST(
    new Request(
      'http://localhost/api/listening-sessions/session-1/analyze',
      { method: 'POST' }
    ),
    {
      params: {
        id: 'session-1',
      },
    }
  );
}

describe(
  'POST /api/listening-sessions/[id]/analyze',
  () => {
    beforeEach(() => {
      findUniqueSessionMock.mockReset();
      updateSessionMock.mockReset();
      parseResponseMock.mockReset();
      vi.unstubAllEnvs();

      vi.stubEnv('MOCK_LLM', 'false');
      vi.stubEnv(
        'OPENAI_API_KEY',
        'test-api-key'
      );
      vi.stubEnv('OPENAI_MODEL', 'test-model');

      parseResponseMock.mockResolvedValue({
        output_parsed: validAnalysis,
      });

      updateSessionMock.mockResolvedValue(
        createSession({
          analysis: JSON.stringify(
            validAnalysis
          ),
          model: 'test-model',
        })
      );
    });

    it(
      'uses the custom snapshot transcript and exercise',
      async () => {
        findUniqueSessionMock.mockResolvedValue(
          createSession({
            practiceSnapshot:
              JSON.stringify(customSnapshot),
          })
        );

        const response = await analyzeSession();

        expect(response.status).toBe(200);

        const modelInput = JSON.stringify(
          parseResponseMock.mock.calls[0][0]
            .input
        );

        expect(modelInput).toContain(
          'CUSTOM TRANSCRIPT'
        );
        expect(modelInput).toContain(
          'How is AI changing code review?'
        );
        expect(modelInput).toContain('B1-B2');
        expect(modelInput).not.toContain(
          'Daniel needs transportation'
        );

        expect(
          updateSessionMock
        ).toHaveBeenCalledWith({
          where: {
            id: 'session-1',
          },
          data: {
            analysis:
              JSON.stringify(validAnalysis),
            model: 'test-model',
          },
        });
      }
    );

    it(
      'preserves the legacy catalog fallback',
      async () => {
        findUniqueSessionMock.mockResolvedValue(
          createSession({
            practiceId: 'team-picnic-ride',
            practiceSnapshot: null,
            answer:
              'Daniel needs a ride to the picnic.',
          })
        );

        const response = await analyzeSession();

        expect(response.status).toBe(200);

        const modelInput = JSON.stringify(
          parseResponseMock.mock.calls[0][0]
            .input
        );

        expect(modelInput).toContain('Daniel');
        expect(modelInput).toContain(
          'Daniel needs transportation'
        );
        expect(modelInput).toContain('A2–B1');
      }
    );

    it(
      'rejects a corrupted stored snapshot',
      async () => {
        findUniqueSessionMock.mockResolvedValue(
          createSession({
            practiceSnapshot:
              '{"source":{"title":"broken"}}',
          })
        );

        const response = await analyzeSession();

        expect(response.status).toBe(500);
        expect(
          parseResponseMock
        ).not.toHaveBeenCalled();
        expect(
          updateSessionMock
        ).not.toHaveBeenCalled();
      }
    );
  }
);