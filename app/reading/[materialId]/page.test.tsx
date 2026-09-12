import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    material: vi.fn(),
    sessions: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
    prisma: {
        material: { findUnique: mocks.material },
        readingSession: { findMany: mocks.sessions },
    },
}));
vi.mock('../ReadingPractice', () => ({
    default: () => React.createElement('div', null, 'Active practice'),
}));

import ReadingPage from './page';

const analysis = JSON.stringify({
    mainIdea: { captured: true, feedback: 'Good' },
    missedKeyPoints: [],
    corrections: [],
    suggestedSummary: 'Validated summary',
});
const unit = (order: number, status = 'covered') => ({
    id: `unit-${order}`, order, status,
    type: 'text_section', content: 'Current content',
});
const session = (order: number, answer: string, storedAnalysis = analysis) => ({
    learningUnitId: `unit-${order}`, contentSnapshot: `Snapshot ${order}`,
    answer, analysis: storedAnalysis,
});
async function render() {
    return renderToStaticMarkup(await ReadingPage({ params: { materialId: 'article' } }));
}

beforeEach(() => {
    mocks.material.mockResolvedValue({
        id: 'article', title: 'Article', type: 'article',
        units: [unit(2), unit(1)],
    });
    mocks.sessions.mockResolvedValue([]);
});

describe('completed reading review', () => {
    it('queries completed sessions newest first and renders latest snapshots in unit order', async () => {
        mocks.sessions.mockResolvedValue([
            session(2, 'Newest answer 2'),
            session(1, 'Newest answer 1'),
            session(1, 'Old answer'),
        ]);
        const html = await render();
        expect(mocks.sessions).toHaveBeenCalledWith({
            where: { learningUnitId: { in: ['unit-1', 'unit-2'] }, analysis: { not: null } },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            select: { learningUnitId: true, contentSnapshot: true, answer: true, analysis: true },
        });
        expect(html.indexOf('Unit 1')).toBeLessThan(html.indexOf('Unit 2'));
        expect(html).toContain('Snapshot 1');
        expect(html).toContain('Snapshot 2');
        expect(html).toContain('Newest answer 1');
        expect(html).toContain('Newest answer 2');
        expect(html).toContain('Validated summary');
        const sources = html.match(/<details>.*?<\/details>/g) ?? [];
        expect(sources).toHaveLength(2);
        sources.forEach((source, index) => {
            expect(source).toContain('<summary>Show source</summary>');
            expect(source).toContain(`Snapshot ${index + 1}`);
        });
        // Exact <details> opening tags have neither open nor a shared name.
        const visibleReview = html.replace(/<details>.*?<\/details>/g, '');
        expect(visibleReview).toContain('<h5>My summary</h5>');
        expect(visibleReview).toContain('<h5>Suggested summary</h5>');
        expect(visibleReview).toContain('Newest answer 1');
        expect(visibleReview).toContain('Newest answer 2');
        expect(visibleReview).toContain('Validated summary');
        expect(visibleReview).not.toContain('Snapshot');
        expect(html).not.toContain('Old answer');
        expect(html).not.toContain('Current content');
        expect(html).not.toContain('Active practice');
    });

    it.each(['{broken', JSON.stringify({ suggestedSummary: 'Unvalidated summary' })])(
        'handles invalid analysis without falling back to an older session: %s',
        async (invalid) => {
            mocks.sessions.mockResolvedValue([
                session(1, 'Latest answer', invalid),
                session(1, 'Old answer'),
            ]);
            const html = await render();
            expect(html).toContain('Latest answer');
            expect(html).toContain('Snapshot 1');
            expect(html).toContain('保存的分析无效');
            expect(html).not.toContain('Unvalidated summary');
            expect(html).not.toContain('Validated summary');
            expect(html).not.toContain('Old answer');
            expect(html).toContain('未找到此单元的已完成阅读记录');
        }
    );

    it('keeps active practice and does not load review sessions', async () => {
        mocks.material.mockResolvedValue({
            id: 'article', title: 'Article', type: 'article',
            units: [unit(1), unit(2, 'pending')],
        });
        const html = await render();
        expect(mocks.sessions).not.toHaveBeenCalled();
        expect(html).toContain('Active practice');
        expect(html).toContain('Current content');
        expect(html).not.toContain('Reading review');
    });

    it('does not load review sessions for an empty article', async () => {
        mocks.material.mockResolvedValue({
            id: 'article', title: 'Article', type: 'article', units: [],
        });
        const html = await render();
        expect(mocks.sessions).not.toHaveBeenCalled();
        expect(html).toContain('还没有可阅读的单元');
        expect(html).not.toContain('Reading review');
    });
});
