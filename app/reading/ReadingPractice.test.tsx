import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import ReadingPractice from './ReadingPractice';
import ReadingFeedback from './ReadingFeedback';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

it('shows a lightweight section summary guide before the answer input', () => {
    const html = renderToStaticMarkup(<ReadingPractice learningUnitId="unit-1" />);
    for (const text of [
        'Section Summary Guide',
        'Main point — What is this section mainly saying?',
        'Role — What is this section doing in the article: explaining, giving evidence, showing an example, contrasting, or qualifying?',
        'Takeaway — What is one idea, detail, or expression worth keeping?',
        'Aim for 2–4 sentences. You don’t need to include every detail.',
        'Your Answer',
    ]) expect(html).toContain(text);
    expect(html.indexOf('Section Summary Guide')).toBeLessThan(html.indexOf('<textarea'));
    expect(html).not.toContain('Correct Answer');
});

it('renders concise comparison and a secondary AI reference without fabricating omissions', () => {
    const html = renderToStaticMarkup(<ReadingFeedback analysis={{
        mainIdea: { captured: true, feedback: 'Main idea understood.' },
        missedKeyPoints: [], corrections: [], suggestedSummary: 'Practice helps us improve.',
        comparison: {
            doneWell: ['You understood the main point.'],
            usefulUpgrade: { learnerWording: 'Practice make better', suggestion: 'Practice helps us improve.' },
        },
    }} />);
    for (const text of ['AI Reference', 'What you missed', 'Useful English upgrades',
        'Practice make better', 'Practice helps us improve.', 'No major content gaps.']) {
        expect(html).toContain(text);
    }
    expect(html).toContain('<aside');
    expect(html).not.toContain('<details');
    expect(html).not.toContain('Reusable English patterns');
    expect(html).not.toContain('Grammar note');
    expect(html).not.toContain('What you did well');
    expect(html).not.toContain('You understood the main point.');
    expect(html).not.toContain('Correct Answer');
});

it('keeps detailed learner upgrades separate from the independent AI reference', () => {
    const html = renderToStaticMarkup(<ReadingFeedback analysis={{
        mainIdea: { captured: true, feedback: 'Understood.' },
        missedKeyPoints: ['The source describes gradual change.'], corrections: [], suggestedSummary: 'Independent source summary.',
        reusablePatterns: ['This section explains how...'],
        grammarNotes: [{ original: 'a book call', corrected: 'a book called', explanation: 'Use a past participle.', example: 'a method called reflection' }],
        comparison: { doneWell: [], usefulUpgrade: {
            items: [{ original: 'Practice make better', improved: 'Practice helps us improve', reason: 'More natural phrasing.' }],
            upgradedAnswer: 'With practice, I can improve.',
        } },
    }} />);
    expect(html).toContain('<q>Practice make better</q> → <q>Practice helps us improve</q>');
    expect(html).toContain('More natural phrasing.');
    expect(html).not.toContain('What you did well');
    expect(html).toContain('<q>a book call</q> → <q>a book called</q>');
    expect(html).toContain('Use a past participle.');
    expect(html).toContain('Example: a method called reflection');
    const headings = ['AI Reference', 'What you missed', 'Useful English upgrades', 'Grammar note', 'Reusable English patterns', 'Your answer, upgraded'];
    headings.slice(1).forEach((heading, index) => expect(html.indexOf(headings[index])).toBeLessThan(html.indexOf(heading)));
    expect(html.split('Useful English upgrades')[1].split('Grammar note')[0]).not.toContain('a book call');
    expect(html).toContain('<details><summary>Your answer, upgraded</summary>');
    expect(html).toContain('<strong>This section explains how...</strong>');
    const contentFeedback = html.split('What you missed')[1].split('Useful English upgrades')[0];
    expect(contentFeedback).toContain('The source describes gradual change.');
    expect(contentFeedback).not.toContain('Practice make better');
    expect(html.split('Useful English upgrades')[1]).not.toContain('The source describes gradual change.');
    expect(html).toContain('With practice, I can improve.');
    const reference = html.match(/<aside.*?<\/aside>/)?.[0];
    expect(reference).toContain('AI Reference');
    expect(reference).toContain('Independent source summary.');
    expect(reference).not.toContain('With practice, I can improve.');
});
