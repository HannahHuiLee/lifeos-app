import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { NextResponse } from 'next/server';

import {
  ListeningPracticeSnapshotSchema,
  type ListeningPracticeSnapshot,
} from '@/lib/listening-contracts';

import {
  ListeningAnalysisSchema,
  type ListeningAnalysis,
} from '@/lib/listening-analysis';

import { getListeningPractice } from '@/lib/listening-practices';

import { prisma } from '@/lib/prisma';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await prisma.listeningSession.findUnique({
      where: {
        id: params.id,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Listening Session 不存在' },
        { status: 404 }
      );
    }

    let customSnapshot:
      | ListeningPracticeSnapshot
      | null = null;

    let transcript: string;
    let difficulty: string;
    let evaluationReference: string;

    if (session.practiceSnapshot !== null) {
      customSnapshot = parseStoredSnapshot(
        session.practiceSnapshot
      );

      if (!customSnapshot) {
        return NextResponse.json(
          {
            error:
              '这次练习保存的 snapshot 无效',
          },
          { status: 500 }
        );
      }

      transcript =
        customSnapshot.source.transcript;

      difficulty =
        customSnapshot.source.difficulty;

      evaluationReference = [
        `Main idea question: ${customSnapshot.exercise.mainIdeaQuestion}`,
        'Detail questions:',
        ...customSnapshot.exercise.detailQuestions.map(
          (question) => `- ${question}`
        ),
      ].join('\n');
    } else {
      const practice =
        getListeningPractice(session.practiceId);

      if (!practice) {
        return NextResponse.json(
          {
            error:
              '这次练习使用的听力素材不存在',
          },
          { status: 404 }
        );
      }

      transcript = practice.turns
        .map(
          (turn) =>
            `${turn.speaker}: ${turn.text}`
        )
        .join('\n');

      difficulty = practice.level;

      evaluationReference = `
Main idea: ${practice.reference.mainIdea}
Who: ${practice.reference.who}
What happened: ${practice.reference.whatHappened}
Why: ${practice.reference.why}
What's next: ${practice.reference.whatsNext}
  `.trim();
    }

    const useMock = process.env.MOCK_LLM === 'true';

    let result: ListeningAnalysis;
    let model: string;

    if (useMock && customSnapshot) {
      model = 'mock-custom-flow-v1';

      result = {
        understandingScore: 0,

        mainIdea: {
          captured: false,
          feedback:
            'Mock 模式只验证自定义练习的数据流，不执行真实的内容理解评估。',
        },

        keyInformation: {
          who: false,
          whatHappened: false,
          why: false,
          whatsNext: false,
        },

        missedKeyInformation: [
          '请关闭 MOCK_LLM 并使用真实模型获得基于 transcript 的反馈。',
        ],

        suggestedSummary: session.answer,

        improvements: [
          '使用真实模型完成这次自定义听力评估。',
        ],
      };
    } else if (useMock) {
      model = 'mock-v1';

      result = {
        understandingScore: 70,
        mainIdea: {
          captured: true,
          feedback:
            '你抓住了 Daniel 因为汽车问题需要搭车去野餐这一主要意思。',
        },
        keyInformation: {
          who: true,
          whatHappened: true,
          why: true,
          whatsNext: false,
        },
        missedKeyInformation: [
          '汽车的引擎警告灯亮了，修理厂要把车留到周一。',
          'Daniel 会把地址发给 Maya，并带甜点去野餐。',
        ],
        suggestedSummary:
          'Daniel cannot drive to the team picnic because his car is at the mechanic. Maya offers him a ride, and Daniel will text her his address.',
        improvements: [
          '补充汽车出现了什么具体问题。',
          '说明他们接下来分别会做什么。',
        ],
      };
    } else {
      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey) {
        return NextResponse.json(
          { error: '服务器尚未配置 OPENAI_API_KEY' },
          { status: 500 }
        );
      }

      model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

      const openai = new OpenAI({ apiKey });

      const response = await openai.responses.parse({
        model,
        input: [
          {
            role: 'system',
            content: `
你是一名耐心、务实的英语听力教练。

请比较听力原文、参考信息和用户的英文总结，判断用户理解了多少。

评估规则：
- 重点评估内容理解，不要因为小的语法或拼写错误过度扣分；
- 判断用户是否抓住 main idea；
- 判断 Who、What happened、Why、What's next 是否被提到；
- missedKeyInformation 只列出重要且确实遗漏或理解错误的信息；
- suggestedSummary 必须是简单、自然的英语，并适合本次练习指定的难度；
- 如果 Who、Why 或 What's next 对这段内容确实不适用，不要把“不适用”当作用户遗漏；
- improvements 使用中文，只指出最值得改善的 1–2 点；
- feedback 和 missedKeyInformation 使用中文；
- understandingScore 必须是 0 到 100 的整数；
- 不要编造原文中没有的信息。
            `.trim(),
          },
          {
            role: 'user',
            content: `
听力原文：
${transcript}

练习难度：
${difficulty}

评分参考或练习重点：
${evaluationReference}

用户的英文总结：
${session.answer}
  `.trim(),
          },
        ],
        text: {
          format: zodTextFormat(
            ListeningAnalysisSchema,
            'listening_analysis'
          ),
        },
      });

      if (!response.output_parsed) {
        return NextResponse.json(
          { error: 'LLM 没有返回有效的结构化分析' },
          { status: 502 }
        );
      }

      result = response.output_parsed;
    }

    const validatedResult =
      ListeningAnalysisSchema.parse(result);

    const updatedSession = await prisma.$transaction(
      async (transaction) => {
        const savedSession =
          await transaction.listeningSession.update({
            where: {
              id: session.id,
            },
            data: {
              analysis: JSON.stringify(validatedResult),
              model,
            },
          });

        if (session.learningUnitId) {
          await transaction.learningUnit.update({
            where: { id: session.learningUnitId },
            data: { status: 'covered' },
          });
        }

        return savedSession;
      }
    );

    return NextResponse.json({
      session: {
        ...updatedSession,
        analysis: validatedResult,
      },
    });
  } catch (error) {
    console.error('Failed to analyze listening session:', error);

    return NextResponse.json(
      { error: '分析 Listening Session 失败' },
      { status: 500 }
    );
  }
}

function parseStoredSnapshot(
  value: string
): ListeningPracticeSnapshot | null {
  try {
    const parsed =
      ListeningPracticeSnapshotSchema.safeParse(
        JSON.parse(value)
      );

    if (!parsed.success) {
      console.error(
        'Invalid stored listening snapshot:',
        parsed.error.flatten()
      );

      return null;
    }

    return parsed.data;
  } catch (error) {
    console.error(
      'Failed to parse listening snapshot:',
      error
    );

    return null;
  }
}
