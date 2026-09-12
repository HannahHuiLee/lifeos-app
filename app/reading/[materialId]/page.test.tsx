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
        const sources = (html.match(/<details>.*?<\/details>/g) ?? [])
            .filter((section) => section.includes('<summary>Show source</summary>'));
        expect(sources).toHaveLength(2);
        sources.forEach((source, index) => {
            expect(source).toContain('<summary>Show source</summary>');
            expect(source).toContain(`Snapshot ${index + 1}`);
        });
        // Exact <details> opening tags have neither open nor a shared name.
        const visibleReview = html.replace(/<details>.*?<\/details>/g, '');
        expect(visibleReview).toContain('<h5>Your Answer</h5>');
        expect(visibleReview).toContain('<h5>AI Reference</h5>');
        expect(visibleReview).toContain('Newest answer 1');
        expect(visibleReview).toContain('Newest answer 2');
        expect(visibleReview).toContain('Validated summary');
        expect(visibleReview).not.toContain('Snapshot');
        expect(html).not.toContain('Grammar notes');
        expect(html).not.toContain('Reusable English patterns');
        expect(html).not.toContain('Your answer, upgraded');
        expect(html).not.toContain('Section Summary Guide');
        expect(html).not.toContain('Correct Answer');
        expect(html).not.toContain('Old answer');
        expect(html).not.toContain('Current content');
        expect(html).not.toContain('Active practice');
        expect(html).toContain('2 / 2 units covered');
        expect(html).not.toContain('You can stop anytime');
    });

    it('renders historical language upgrades without collapsing the comparison', async () => {
        mocks.sessions.mockResolvedValue([session(1, 'Practice make better', JSON.stringify({
            ...JSON.parse(analysis),
            comparison: {
                doneWell: ['You understood gradual improvement.'],
                usefulUpgrade: { learnerWording: 'Practice make better', suggestion: 'Practice helps us improve.' },
            },
        }))]);
        const html = await render();
        expect(html).not.toContain('Comparison feedback');
        expect(html).not.toContain('What you did well');
        expect(html).toContain('What you missed');
        expect(html).toContain('Useful English upgrades');
        expect(html).not.toContain('You understood gradual improvement.');
        expect(html).toContain('Practice helps us improve.');
    });

    it('keeps quick-review feedback visible and secondary content independently collapsed', async () => {
        mocks.sessions.mockResolvedValue([session(1, 'Stored learner answer', JSON.stringify({
            ...JSON.parse(analysis),
            missedKeyPoints: ['First gap', 'Second gap', 'Third gap'],
            comparison: { usefulUpgrade: {
                items: [1, 2, 3].map((number) => ({ original: `Original ${number}`, improved: `Improved ${number}`, reason: `Reason ${number}` })),
                upgradedAnswer: 'Stored upgraded answer',
            } },
            grammarNotes: [{ original: 'Grammar original', corrected: 'Grammar corrected', explanation: 'Short rule', example: 'Stored example' }],
            reusablePatterns: ['This section explains...', 'One takeaway is...', 'The author suggests...'],
        }))]);
        const html = await render();
        const visible = html.replace(/<details>.*?<\/details>/g, '');
        for (const text of ['Your Answer', 'Stored learner answer', 'AI Reference', 'Validated summary',
            'What you missed', 'First gap', 'Second gap', 'Useful English upgrades',
            'Original 1', 'Improved 1', 'Original 2', 'Improved 2', 'Reusable English patterns']) {
            expect(visible).toContain(text);
        }
        for (const text of ['Third gap', 'Original 3', 'Improved 3', 'Section Summary Guide',
            'Aim for 2–4 sentences', 'Active practice', '<button', 'Comparison feedback']) {
            expect(html).not.toContain(text);
        }
        for (const pattern of ['This section explains...', 'One takeaway is...', 'The author suggests...']) {
            expect(visible).toContain(`<strong>${pattern}</strong>`);
        }
        for (const [label, text] of [['Show source', 'Snapshot 1'], ['Grammar notes', 'Grammar corrected'], ['Your answer, upgraded', 'Stored upgraded answer']]) {
            const section = (html.match(/<details>.*?<\/details>/g) ?? []).find((item) => item.includes(`<summary>${label}</summary>`));
            expect(section).toContain(text);
            expect(visible).not.toContain(text);
        }
        expect(html).toContain('Stored example');
        expect(html).not.toContain('Current content');
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
        expect(html).toContain('Unit 2 of 2');
        expect(html).toContain('1 / 2 units completed');
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
