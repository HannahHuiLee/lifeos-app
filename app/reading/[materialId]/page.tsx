import Link from 'next/link';
import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import {
    LearningUnitStatusSchema,
    LearningUnitTypeSchema,
    withMaterialProgress,
} from '@/lib/learning-materials';

import ReadingPractice from '../ReadingPractice';

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
                {progress.coveredUnits} / {progress.totalUnits} units covered
            </p>

            {progress.totalUnits === 0 ? (
                <p>这份材料还没有可阅读的单元。</p>
            ) : unit ? (
                <section aria-labelledby="reading-unit-heading">
                    <h3 id="reading-unit-heading">
                        Unit {unit.order}
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
                <p>这份材料的所有单元都已完成。</p>
            )}
        </main>
    );
}