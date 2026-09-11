import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { CreateReadingSessionInputSchema } from '@/lib/reading-contracts';
import {
    LearningUnitStatusSchema,
    LearningUnitTypeSchema,
    MaterialTypeSchema,
} from '@/lib/learning-materials';

export async function POST(request: Request) {
    // 1. 请求体首先是不可信的未知数据。
    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: '请求必须包含有效的 JSON' },
            { status: 400 }
        );
    }

    // 2. 校验输入结构，并取得 trim 后的数据。
    const inputResult = CreateReadingSessionInputSchema.safeParse(body);

    if (!inputResult.success) {
        return NextResponse.json(
            {
                error: 'Reading Session 输入无效',
                details: inputResult.error.flatten(),
            },
            { status: 400 }
        );
    }

    const input = inputResult.data;

    try {
        // 3. 从数据库读取可信原文及所属材料。
        const unit = await prisma.learningUnit.findUnique({
            where: { id: input.learningUnitId },
            include: { material: true },
        });

        if (!unit) {
            return NextResponse.json(
                { error: 'Learning Unit 不存在' },
                { status: 404 }
            );
        }

        // 4. 数据库中的这些字段是 String，需要检查合法值。
        const materialType = MaterialTypeSchema.safeParse(unit.material.type);
        const unitType = LearningUnitTypeSchema.safeParse(unit.type);
        const unitStatus = LearningUnitStatusSchema.safeParse(unit.status);

        if (
            !materialType.success ||
            !unitType.success ||
            !unitStatus.success
        ) {
            return NextResponse.json(
                { error: 'Learning Unit 保存的数据无效' },
                { status: 500 }
            );
        }

        // 5. Reading 只接受文章的文本单元。
        if (
            materialType.data !== 'article' ||
            unitType.data !== 'text_section'
        ) {
            return NextResponse.json(
                { error: '这个 Learning Unit 不能用于 Reading Coach' },
                { status: 400 }
            );
        }

        if (unitStatus.data === 'covered') {
            return NextResponse.json(
                { error: '这个 Learning Unit 已完成' },
                { status: 409 }
            );
        }

        // 6. 保存答案和快照；此时不更新单元进度。
        const session = await prisma.readingSession.create({
            data: {
                learningUnitId: unit.id,
                materialTitle: unit.material.title,
                contentSnapshot: unit.content,
                answer: input.answer,
            },
        });

        return NextResponse.json(
            { session },
            { status: 201 }
        );
    } catch (error) {
        console.error('Failed to create reading session:', error);

        return NextResponse.json(
            { error: '保存 Reading Session 失败' },
            { status: 500 }
        );
    }
}