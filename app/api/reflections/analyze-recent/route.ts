import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import {
    RecentPatternsSchema,
    type RecentPatterns,
} from '@/lib/reflection-analysis';

const REFLECTION_LIMIT = 5;

export async function GET() {
    try {
        const latestAnalysis =
            await prisma.recentPatternAnalysis.findFirst({
                orderBy: {
                    createdAt: 'desc',
                },
            });

        if (!latestAnalysis) {
            return NextResponse.json({
                analysis: null,
            });
        }

        const parsedResult = RecentPatternsSchema.safeParse(
            JSON.parse(latestAnalysis.result)
        );

        if (!parsedResult.success) {
            console.error(
                'Invalid stored recent patterns:',
                parsedResult.error.flatten()
            );

            return NextResponse.json(
                { error: '保存的趋势分析格式无效' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            analysis: {
                id: latestAnalysis.id,
                reflectionIds: JSON.parse(
                    latestAnalysis.reflectionIds
                ),
                reflectionCount:
                    latestAnalysis.reflectionCount,
                model: latestAnalysis.model,
                createdAt: latestAnalysis.createdAt,
                result: parsedResult.data,
            },
        });
    } catch (error) {
        console.error(
            'Failed to get latest pattern analysis:',
            error
        );

        return NextResponse.json(
            { error: '读取趋势分析失败' },
            { status: 500 }
        );
    }
}


export async function POST() {
    try {
        const reflections = await prisma.reflection.findMany({
            orderBy: {
                createdAt: 'desc',
            },
            take: REFLECTION_LIMIT,
        });

        if (reflections.length < 2) {
            return NextResponse.json(
                { error: '至少需要两条 Reflection 才能分析趋势' },
                { status: 400 }
            );
        }

        const useMock = process.env.MOCK_LLM === 'true';

        let result: RecentPatterns;
        let model: string;

        if (useMock) {
            model = 'mock-v1';

            result = {
                recurringThemes: [
                    '职业方向的不确定感',
                    '英语表达的信心',
                    '与他人建立连接',
                ],
                positivePattern:
                    '当你离开家并参加有明确结构的活动后，通常会感觉更好。',
                challenge:
                    '你在活动开始之前，会花费较多精力担忧和反复考虑。',
                recommendations: [
                    '减少开始行动前需要做出的决定数量',
                    '提前安排活动，而不是等待当天再决定',
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

            const reflectionText = reflections
                .slice()
                .reverse()
                .map((reflection, index) => {
                    const date = reflection.createdAt
                        .toISOString()
                        .slice(0, 10);

                    return [
                        `Reflection ${index + 1}`,
                        `Date: ${date}`,
                        reflection.content,
                    ].join('\n');
                })
                .join('\n\n---\n\n');

            const response = await openai.responses.parse({
                model,
                input: [
                    {
                        role: 'system',
                        content: `
你是一名温和、务实的长期反思分析助手。

请比较用户最近的多条 Reflection，并识别：
- 重复出现的主题；
- 对用户有帮助的正向模式；
- 最主要的挑战模式；
- 少量、具体、可执行的建议。

只根据 Reflection 中出现的信息分析。
不要进行医疗或心理疾病诊断。
不要把一次性事件描述成长期模式。
使用与 Reflection 相同的主要语言回答。
            `.trim(),
                    },
                    {
                        role: 'user',
                        content: reflectionText,
                    },
                ],
                text: {
                    format: zodTextFormat(
                        RecentPatternsSchema,
                        'recent_reflection_patterns'
                    ),
                },
            });

            if (!response.output_parsed) {
                return NextResponse.json(
                    { error: 'LLM 没有返回有效的趋势分析' },
                    { status: 502 }
                );
            }

            result = response.output_parsed;
        }

        const validatedResult = RecentPatternsSchema.parse(result);

        const reflectionIds = reflections.map(
            (reflection) => reflection.id
        );

        const savedAnalysis =
            await prisma.recentPatternAnalysis.create({
                data: {
                    reflectionIds: JSON.stringify(reflectionIds),
                    reflectionCount: reflections.length,
                    result: JSON.stringify(validatedResult),
                    model,
                },
            });

        return NextResponse.json({
            id: savedAnalysis.id,
            reflectionCount: savedAnalysis.reflectionCount,
            reflectionIds,
            model: savedAnalysis.model,
            createdAt: savedAnalysis.createdAt,
            result: validatedResult,
        });
    } catch (error) {
        console.error(
            'Failed to analyze recent reflections:',
            error
        );

        return NextResponse.json(
            { error: '分析最近的 Reflection 失败' },
            { status: 500 }
        );
    }
}

