import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import {
  ReflectionAnalysisSchema,
  type ReflectionAnalysis,
} from '@/lib/reflection-analysis';

// 它返回最近 50 条 Reflection，并将数据库中的 analysis.result 字符串恢复、校验为 JSON。
// 这里有一个重要细节：数据库里的 result 只是字符串，因此不能直接相信它。parseAnalysisResult() 会执行：  JSON.parse ↓Zod schema 校验↓有效数据或 null

function parseAnalysisResult(
  value: string
): ReflectionAnalysis | null {
  try {
    const json = JSON.parse(value);
    const parsed = ReflectionAnalysisSchema.safeParse(json);

    if (!parsed.success) {
      console.error(
        'Invalid stored analysis:',
        parsed.error.flatten()
      );
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.error('Failed to parse stored analysis:', error);
    return null;
  }
}

export async function GET() {
  try {
    const reflections = await prisma.reflection.findMany({
      include: {
        analysis: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    const history = reflections.map((reflection) => ({
      id: reflection.id,
      content: reflection.content,
      createdAt: reflection.createdAt,
      analysis: reflection.analysis
        ? {
            id: reflection.analysis.id,
            model: reflection.analysis.model,
            createdAt: reflection.analysis.createdAt,
            result: parseAnalysisResult(
              reflection.analysis.result
            ),
          }
        : null,
    }));

    return NextResponse.json({ reflections: history });
  } catch (error) {
    console.error('Failed to get reflection history:', error);

    return NextResponse.json(
      { error: '读取 Reflection 历史失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const content = body.content;

    if (typeof content !== 'string' || content.trim() === '') {
      return NextResponse.json(
        { error: 'Reflection 内容不能为空' },
        { status: 400 }
      );
    }

    const reflection = await prisma.reflection.create({
      data: {
        content: content.trim(),
      },
    });

    return NextResponse.json(
      { reflection },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create reflection:', error);

    return NextResponse.json(
      { error: '保存 Reflection 失败' },
      { status: 500 }
    );
  }
}