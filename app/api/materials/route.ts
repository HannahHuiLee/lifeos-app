import { NextResponse } from 'next/server';

import {
  CreateMaterialInputSchema,
  getLearningUnitType,
  isListeningMaterialType,
  MaterialTypeSchema,
  splitIntoLearningUnits,
  withMaterialProgress,
  type MaterialWithUnits,
} from '@/lib/learning-materials';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const typeValue = new URL(request.url).searchParams.get('type');
  const typeResult = typeValue
    ? MaterialTypeSchema.safeParse(typeValue)
    : null;

  if (typeValue && !typeResult?.success) {
    return NextResponse.json(
      { error: 'Material type 无效' },
      { status: 400 }
    );
  }

  try {
    const materials = await prisma.material.findMany({
      where: typeResult?.success ? { type: typeResult.data } : undefined,
      include: {
        units: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      materials: materials.map((material) =>
        withMaterialProgress(material as MaterialWithUnits)
      ),
    });
  } catch (error) {
    console.error('Failed to get materials:', error);
    return NextResponse.json(
      { error: '读取 Materials 失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: '请求必须包含有效的 JSON' },
      { status: 400 }
    );
  }

  const inputResult = CreateMaterialInputSchema.safeParse(body);

  if (!inputResult.success) {
    return NextResponse.json(
      {
        error: 'Material 输入无效',
        details: inputResult.error.flatten(),
      },
      { status: 400 }
    );
  }

  const input = inputResult.data;
  const contents = splitIntoLearningUnits(input.content, input.type);

  if (isListeningMaterialType(input.type) && contents.length < 2) {
    return NextResponse.json(
      { error: 'Listening transcript 无法安全分成至少两个学习单元' },
      { status: 400 }
    );
  }

  try {
    const material = await prisma.material.create({
      data: {
        type: input.type,
        title: input.title,
        sourceUrl: input.sourceUrl,
        difficulty:
          input.type === 'article' ? null : input.difficulty,
        units: {
          create: contents.map((content, index) => ({
            order: index + 1,
            type: getLearningUnitType(input.type),
            content,
          })),
        },
      },
      include: {
        units: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return NextResponse.json(
      {
        material: withMaterialProgress(
          material as MaterialWithUnits
        ),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create material:', error);
    return NextResponse.json(
      { error: '保存 Material 失败' },
      { status: 500 }
    );
  }
}
