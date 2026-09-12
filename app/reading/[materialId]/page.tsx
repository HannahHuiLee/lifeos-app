import Link from 'next/link';
import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { ReadingAnalysisSchema, type ReadingAnalysis } from '@/lib/reading-analysis';
import {
    LearningUnitStatusSchema,
    LearningUnitTypeSchema,
    withMaterialProgress,
} from '@/lib/learning-materials';

import ReadingPractice from '../ReadingPractice';
import ReadingFeedback from '../ReadingFeedback';

// 每次服务端渲染都读取数据库中的当前进度。
export const dynamic = 'force-dynamic';

export default async function ReadingPage({
    params,
}: {
    params: { materialId: string };
}) {
    const material = await prisma.material.findUnique({
        where: { id: params.materialId },
        include: {
            units: {
                orderBy: { order: 'asc' },
            },
        },
    });

    // 这个页面只接受文章。
    if (!material || material.type !== 'article') {
        notFound();
    }

    // 数据库字符串转换为共享领域类型。
    const units = material.units.map((unit) => {
        const type = LearningUnitTypeSchema.parse(unit.type);
        const status = LearningUnitStatusSchema.parse(unit.status);

        if (type !== 'text_section') {
            throw new Error('Article contains a non-text learning unit');
        }

        return {
            ...unit,
            type,
            status,
        };
    });

    const progress = withMaterialProgress({
        ...material,
        type: 'article',
        units,
    });

    const unit = progress.nextUnit;
    const completedSessions = !unit && progress.coveredUnits > 0
        ? await prisma.readingSession.findMany({
            where: {
                learningUnitId: {
                    in: progress.units
                        .filter((item) => item.status === 'covered')
                        .map((item) => item.id),
                },
                analysis: { not: null },
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            select: {
                learningUnitId: true,
                contentSnapshot: true,
                answer: true,
                analysis: true,
            },
        })
        : [];

    // 查询按时间降序，首次遇到的会话就是该单元最新的已完成会话。
    const latestSessions = new Map<string, typeof completedSessions[number]>();
    for (const session of completedSessions) {
        if (session.learningUnitId && !latestSessions.has(session.learningUnitId)) {
            latestSessions.set(session.learningUnitId, session);
        }
    }

    const review = progress.units
        .filter((item) => item.status === 'covered')
        .map((item) => {
            const session = latestSessions.get(item.id);
            let analysis: ReadingAnalysis | null = null;
            if (session?.analysis) {
                try {
                    analysis = ReadingAnalysisSchema.parse(
                        JSON.parse(session.analysis)
                    );
                } catch {
                    // 历史数据损坏时仍展示保存的原文和答案。
                }
            }
            return { unit: item, session, analysis };
        });

    return (
        <main
            style={{
                maxWidth: '760px',
                margin: '40px auto',
                padding: '0 20px 60px',
            }}
        >
            <Link href="/listening">← Material Library</Link>

            <h1>Reading Coach</h1>
            <h2>{material.title}</h2>

            <p>
                {progress.coveredUnits} / {progress.totalUnits} units {unit ? 'completed' : 'covered'}
            </p>

            {progress.totalUnits === 0 ? (
                <p>这份材料还没有可阅读的单元。</p>
            ) : unit ? (
                <section aria-labelledby="reading-unit-heading">
                    <h3 id="reading-unit-heading">
                        Unit {unit.order} of {progress.totalUnits}
                    </h3>

                    <p style={{ color: '#4b5563' }}>
                        Read this section and identify its main idea.
                    </p>

                    <div
                        style={{
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'anywhere',
                            lineHeight: 1.8,
                            padding: '20px',
                            border: '1px solid #d1d5db',
                            borderRadius: '10px',
                        }}
                    >
                        {unit.content}
                    </div>
                    
                    <ReadingPractice
                        key={unit.id}
                        learningUnitId={unit.id}
                    />
                </section>
            ) : (
                <section aria-labelledby="reading-review-heading">
                    <p>这份材料的所有单元都已完成。</p>
                    <h3 id="reading-review-heading">Reading review</h3>
                    {review.map(({ unit: completedUnit, session, analysis }) => (
                        <section key={completedUnit.id} style={{ marginTop: '24px' }}>
                            <h4>Unit {completedUnit.order}</h4>
                            {session ? (
                                <>
                                    <details>
                                        <summary>Show source</summary>
                                        <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                                            {session.contentSnapshot}
                                        </p>
                                    </details>
                                    <h5>Your Answer</h5>
                                    <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                                        {session.answer}
                                    </p>
                                    {analysis ? (
                                        <ReadingFeedback analysis={analysis} compact />
                                    ) : (
                                        <div>
                                            <h5>AI Reference</h5>
                                            <p>保存的分析无效，参考总结暂不可用。</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p>未找到此单元的已完成阅读记录。</p>
                            )}
                        </section>
                    ))}
                </section>
            )}
        </main>
    );
}