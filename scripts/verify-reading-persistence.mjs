import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import prismaPackage from '../lib/prisma-generated/index.js';

const { PrismaClient } = prismaPackage;

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'lifeos-reading-')
);
const databaseUrl = `file:${join(temporaryDirectory, 'test.db')}`;

// 明确指定临时数据库，不使用应用的开发数据库连接。
const prisma = new PrismaClient({
    datasources: {
        db: { url: databaseUrl },
    },
});

try {
    // 1. 在空数据库上应用项目的全部迁移。
    const migration = spawnSync(
        process.execPath,
        [
            join(projectRoot, 'node_modules/prisma/build/index.js'),
            'migrate',
            'deploy',
            '--schema',
            join(projectRoot, 'prisma/schema.prisma'),
        ],
        {
            cwd: projectRoot,
            env: {
                ...process.env,
                DATABASE_URL: databaseUrl,
            },
            encoding: 'utf8',
            timeout: 60_000,
        }
    );

    if (migration.error) {
        throw migration.error;
    }

    if (migration.status !== 0) {
        throw new Error(
            `Migration failed:\n${migration.stdout}\n${migration.stderr}`
        );
    }

    console.log('PASS: migrations applied to a temporary database');

    // 2. 创建真实材料、单元和阅读会话。
    const material = await prisma.material.create({
        data: {
            type: 'article',
            title: 'Practice',
            units: {
                create: {
                    order: 1,
                    type: 'text_section',
                    content: 'Practice supports gradual improvement.',
                },
            },
        },
        include: { units: true },
    });

    const unit = material.units[0];

    const session = await prisma.readingSession.create({
        data: {
            learningUnitId: unit.id,
            materialTitle: material.title,
            contentSnapshot: unit.content,
            answer: 'Practice helps people improve.',
        },
    });

    const analysis = JSON.stringify({
        mainIdea: {
            captured: true,
            feedback: '你抓住了主旨。',
        },
        missedKeyPoints: [],
        corrections: [],
        suggestedSummary: 'Practice supports gradual improvement.',
    });

    // 3. 第一次写入成功，第二次故意更新不存在的单元。
    // Prisma 应抛出 P2025，并回滚第一次写入。
    await assert.rejects(
        () =>
            prisma.$transaction(async (transaction) => {
                await transaction.readingSession.update({
                    where: { id: session.id },
                    data: {
                        analysis,
                        model: 'persistence-test',
                    },
                });

                await transaction.learningUnit.update({
                    where: { id: 'deliberately-missing-unit' },
                    data: { status: 'covered' },
                });
            }),
        { code: 'P2025' }
    );

    const afterFailure =
        await prisma.readingSession.findUniqueOrThrow({
            where: { id: session.id },
        });
    const pendingUnit = await prisma.learningUnit.findUniqueOrThrow({
        where: { id: unit.id },
    });

    assert.equal(afterFailure.analysis, null);
    assert.equal(afterFailure.model, null);
    assert.equal(afterFailure.answer, session.answer);
    assert.equal(pendingUnit.status, 'pending');

    console.log('PASS: failed transaction rolled back the analysis');

    // 4. 正常事务：分析与进度都应保存。
    await prisma.$transaction(async (transaction) => {
        await transaction.readingSession.update({
            where: { id: session.id },
            data: {
                analysis,
                model: 'persistence-test',
            },
        });

        await transaction.learningUnit.update({
            where: { id: unit.id },
            data: { status: 'covered' },
        });
    });

    const afterSuccess =
        await prisma.readingSession.findUniqueOrThrow({
            where: { id: session.id },
        });
    const coveredUnit = await prisma.learningUnit.findUniqueOrThrow({
        where: { id: unit.id },
    });

    assert.equal(afterSuccess.analysis, analysis);
    assert.equal(afterSuccess.model, 'persistence-test');
    assert.equal(coveredUnit.status, 'covered');

    console.log('PASS: successful transaction saved analysis and progress');

    // 5. 删除材料：单元级联删除，会话保留且外键置空。
    await prisma.material.delete({
        where: { id: material.id },
    });

    const historicalSession =
        await prisma.readingSession.findUniqueOrThrow({
            where: { id: session.id },
        });

    assert.equal(
        await prisma.learningUnit.findUnique({
            where: { id: unit.id },
        }),
        null
    );
    assert.equal(historicalSession.learningUnitId, null);
    assert.equal(historicalSession.materialTitle, material.title);
    assert.equal(historicalSession.contentSnapshot, unit.content);
    assert.equal(historicalSession.answer, session.answer);
    assert.equal(historicalSession.analysis, analysis);

    console.log('PASS: deletion preserved the session and its snapshot');
} finally {
    // 无论成功或失败，都关闭连接并删除本次临时数据库。
    try {
        await prisma.$disconnect();
    } finally {
        await rm(temporaryDirectory, {
            recursive: true,
            force: true,
        });
    }
}