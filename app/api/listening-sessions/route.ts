import { NextResponse } from 'next/server';

import { getListeningPractice } from '@/lib/listening-practices';
import { prisma } from '@/lib/prisma';
// History 的数据层
import {
    ListeningAnalysisSchema,
    type ListeningAnalysis,
} from '@/lib/listening-analysis';

import {
    CreateListeningSessionInputSchema,
} from '@/lib/listening-contracts';

// JSON.parse → Zod 校验 → 有效分析或 null
function parseAnalysis(
    value: string | null
): ListeningAnalysis | null {
    if (!value) {
        return null;
    }

    try {
        const json = JSON.parse(value);
        const parsed = ListeningAnalysisSchema.safeParse(json);

        if (!parsed.success) {
            console.error(
                'Invalid stored listening analysis:',
                parsed.error.flatten()
            );
            return null;
        }

        return parsed.data;
    } catch (error) {
        console.error(
            'Failed to parse stored listening analysis:',
            error
        );
        return null;
    }
}


export async function GET() {
    try {
        const sessions = await prisma.listeningSession.findMany({
            orderBy: {
                createdAt: 'desc',
            },
            take: 50,
        });

        const history = sessions.map((session) => {
            const practice = getListeningPractice(session.practiceId);

            return {
                id: session.id,
                practiceId: session.practiceId,
                practice: practice
                    ? {
                        title: practice.title,
                        level: practice.level,
                    }
                    : null,
                answer: session.answer,
                analysis: parseAnalysis(session.analysis),
                model: session.model,
                createdAt: session.createdAt,
            };
        });

        return NextResponse.json({ sessions: history });
    } catch (error) {
        console.error(
            'Failed to get listening session history:',
            error
        );

        return NextResponse.json(
            { error: '读取 Listening History 失败' },
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

    const inputResult =
        CreateListeningSessionInputSchema.safeParse(
            body
        );

    if (!inputResult.success) {
        return NextResponse.json(
            {
                error: 'Listening Session 输入无效',
                details: inputResult.error.flatten(),
            },
            { status: 400 }
        );
    }

    const input = inputResult.data;

    let practiceId: string;
    let practiceSnapshot: string | undefined;

    if (input.practiceSnapshot) {
        practiceId = 'custom';
        practiceSnapshot = JSON.stringify(
            input.practiceSnapshot
        );
    } else {
        if (!input.practiceId) {
            return NextResponse.json(
                { error: 'practiceId 缺失' },
                { status: 400 }
            );
        }

        const practice =
            getListeningPractice(input.practiceId);

        if (!practice) {
            return NextResponse.json(
                { error: '听力素材不存在' },
                { status: 404 }
            );
        }

        practiceId = input.practiceId;
        practiceSnapshot = undefined;
    }

    try {
        const session =
            await prisma.listeningSession.create({
                data: {
                    practiceId,
                    practiceSnapshot,
                    answer: input.answer,
                },
            });

        return NextResponse.json(
            { session },
            { status: 201 }
        );
    } catch (error) {
        console.error(
            'Failed to create listening session:',
            error
        );

        return NextResponse.json(
            { error: '保存 Listening Session 失败' },
            { status: 500 }
        );
    }
}