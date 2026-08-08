import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import {
  ReflectionAnalysisSchema,
  type ReflectionAnalysis,
} from '@/lib/reflection-analysis';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const reflection = await prisma.reflection.findUnique({
      where: {
        id: params.id,
      },
    });

    if (!reflection) {
      return NextResponse.json(
        { error: 'Reflection 不存在' },
        { status: 404 }
      );
    }

    const useMock = process.env.MOCK_LLM === 'true';

    let result: ReflectionAnalysis;
    let model: string;

    if (useMock) {
      model = 'mock-v1';

      result = {
        summary: `这篇 Reflection 记录了：${reflection.content.slice(0, 120)}`,
        emotions: [
          {
            name: '投入',
            intensity: 7,
            evidence: '用户主动记录并反思了今天的经历。',
          },
        ],
        wins: [
          '完成了一次 Reflection 记录',
          '愿意停下来观察自己的经历',
        ],
        challenges: [
          '仍需要进一步辨认事件背后的情绪和需求',
        ],
        insights: [
          '持续记录可以帮助识别重复出现的行为和情绪模式',
        ],
        nextActions: [
          {
            action: '明天继续写一条简短 Reflection',
            reason: '连续记录能让长期模式更加清晰',
          },
        ],
        reflectionQuestion: '这件事中，什么是你最希望明天做得不同的？',
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
你是一名温和、务实的个人反思助手。

请分析用户的 Reflection：
- 总结发生的事情；
- 识别情绪，并根据文本给出 1 到 10 的强度；
- 找出做得好的地方、困难和可能的洞察；
- 给出少量、具体、可执行的下一步；
- 提出一个能够帮助用户继续思考的问题。

不要进行医疗或心理疾病诊断。
不要编造 Reflection 中没有证据支持的事实。
使用与用户 Reflection 相同的语言回答。
            `.trim(),
          },
          {
            role: 'user',
            content: reflection.content,
          },
        ],
        text: {
          format: zodTextFormat(
            ReflectionAnalysisSchema,
            'reflection_analysis'
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

    // Mock 与真实 LLM 的结果都经过同一个 schema 校验。
    const validatedResult = ReflectionAnalysisSchema.parse(result);

    const savedAnalysis = await prisma.aIAnalysis.upsert({
      where: {
        reflectionId: reflection.id,
      },
      update: {
        result: JSON.stringify(validatedResult),
        model,
      },
      create: {
        reflectionId: reflection.id,
        result: JSON.stringify(validatedResult),
        model,
      },
    });

    return NextResponse.json({
      reflection,
      analysis: {
        id: savedAnalysis.id,
        model: savedAnalysis.model,
        createdAt: savedAnalysis.createdAt,
        result: validatedResult,
      },
    });
  } catch (error) {
    console.error('Failed to analyze reflection:', error);

    return NextResponse.json(
      { error: '分析 Reflection 失败' },
      { status: 500 }
    );
  }
}