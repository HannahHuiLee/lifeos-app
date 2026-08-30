import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { POST } from '@/app/api/listening-practices/generate/route';

const { parseResponseMock } = vi.hoisted(() => ({
  parseResponseMock: vi.fn(),
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

const validSource = {
  title: 'How AI Changes Technical Work',
  sourceType: 'video',
  sourceUrl: 'https://example.com/video',
  transcript: 'A'.repeat(500),
  difficulty: 'B1-B2',
};

const validExercise = {
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
};

function createRequest(
  body: unknown,
  raw = false
) {
  return new Request(
    'http://localhost/api/listening-practices/generate',
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

describe(
  'POST /api/listening-practices/generate',
  () => {
    beforeEach(() => {
      parseResponseMock.mockReset();
      vi.unstubAllEnvs();
    });

    it(
      'returns 400 for malformed JSON',
      async () => {
        const response = await POST(
          createRequest(
            '{"title":',
            true
          )
        );

        expect(response.status).toBe(400);
        expect(
          parseResponseMock
        ).not.toHaveBeenCalled();
      }
    );

    it(
      'returns 400 for an invalid source',
      async () => {
        const response = await POST(
          createRequest({
            ...validSource,
            transcript: 'Too short',
          })
        );

        expect(response.status).toBe(400);
        expect(
          parseResponseMock
        ).not.toHaveBeenCalled();
      }
    );

    it(
      'returns a valid exercise in mock mode',
      async () => {
        vi.stubEnv('MOCK_LLM', 'true');

        const response = await POST(
          createRequest(validSource)
        );

        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toMatchObject({
          source: validSource,
          model:
            'mock-listening-generator-v1',
        });

        expect(
          body.exercise.detailQuestions
        ).toHaveLength(2);

        expect(
          parseResponseMock
        ).not.toHaveBeenCalled();
      }
    );

    it(
      'returns 500 when OpenAI is not configured',
      async () => {
        vi.stubEnv('MOCK_LLM', 'false');
        vi.stubEnv('OPENAI_API_KEY', '');

        const response = await POST(
          createRequest(validSource)
        );

        expect(response.status).toBe(500);
        expect(
          parseResponseMock
        ).not.toHaveBeenCalled();
      }
    );

    it(
      'returns the parsed OpenAI exercise',
      async () => {
        vi.stubEnv('MOCK_LLM', 'false');
        vi.stubEnv(
          'OPENAI_API_KEY',
          'test-api-key'
        );
        vi.stubEnv(
          'OPENAI_MODEL',
          'test-model'
        );

        parseResponseMock.mockResolvedValue({
          output_parsed: validExercise,
        });

        const response = await POST(
          createRequest(validSource)
        );

        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.exercise).toEqual(
          validExercise
        );
        expect(body.model).toBe('test-model');

        expect(
          parseResponseMock
        ).toHaveBeenCalledTimes(1);

        expect(
          parseResponseMock
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'test-model',
          })
        );
      }
    );
  }
);