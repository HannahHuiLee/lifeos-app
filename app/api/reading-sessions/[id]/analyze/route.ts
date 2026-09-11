import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { analyzeReading } from '@/lib/reading-analyzer';
import { ReadingAnalysisSchema } from '@/lib/reading-analysis';

export async function POST(
    _request: Request,
    { params }: { params: { id: string } }
) {
    try {
        // 1. 使用已保存的会话，客户端无需重新提交原文或答案。
        const session = await prisma.readingSession.findUnique({
            where: { id: params.id },
        });

        if (!session) {
            return NextResponse.json(
                { error: 'Reading Session 不存在' },
                { status: 404 }
            );
        }

        // 2. 网络调用在事务外完成。
        const result = await analyzeReading({
            materialTitle: session.materialTitle,
            contentSnapshot: session.contentSnapshot,
            answer: session.answer,
        });

        // 3. 只有有效反馈才能进入持久化阶段。
        const analysis = ReadingAnalysisSchema.parse(result.analysis);

        const savedSession = await prisma.$transaction(
            async (transaction) => {
                // 4. 保存分析，并取得当前的会话关联。
                const updatedSession =
                    await transaction.readingSession.update({
                        where: { id: session.id },
                        data: {
                            analysis: JSON.stringify(analysis),
                            model: result.model,
                        },
                    });

                // 5. 如果单元仍存在，将其标记为已覆盖。
                if (updatedSession.learningUnitId) {
                    await transaction.learningUnit.update({
                        where: {
                            id: updatedSession.learningUnitId,
                        },
                        data: {
                            status: 'covered',
                        },
                    });
                }

                return updatedSession;
            }
        );

        // 6. 数据库存字符串，API 返回结构化对象。
        return NextResponse.json({
            session: {
                ...savedSession,
                analysis,
            },
        });
    } catch (error) {
        console.error('Failed to analyze reading session:', error);

        return NextResponse.json(
            { error: '分析 Reading Session 失败，请稍后重试' },
            { status: 500 }
        );
    }
}