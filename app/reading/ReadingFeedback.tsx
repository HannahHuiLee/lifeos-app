import type { ReadingAnalysis } from '@/lib/reading-analysis';

export default function ReadingFeedback({ analysis, compact = false }: {
    analysis: ReadingAnalysis;
    compact?: boolean;
}) {
    const upgrade = analysis.comparison?.usefulUpgrade;
    const contentGaps = [
        ...analysis.missedKeyPoints,
        ...analysis.corrections.map((item) => item.correction),
    ];
    const grammarNotes = analysis.grammarNotes?.length ? (
        <ul>{analysis.grammarNotes.slice(0, 2).map((note, index) => (
            <li key={index}>
                <q>{note.original}</q> → <q>{note.corrected}</q>
                <p>{note.explanation}</p>
                {note.example && <p>Example: {note.example}</p>}
            </li>
        ))}</ul>
    ) : null;
    const comparison = (
        <>
            <h5>What you missed</h5>
            {contentGaps.length ? (
                <ul>
                    {(compact ? contentGaps.slice(0, 2) : contentGaps).map((point, index) => (
                        <li key={index}>{point}</li>
                    ))}
                </ul>
            ) : <p>No major content gaps.</p>}
            {upgrade && (
                <section>
                <h5>Useful English upgrades</h5>
                {
                'items' in upgrade ? (
                    <div style={{ fontSize: '0.9em', overflowWrap: 'anywhere' }}>
                        <ul>
                            {(compact ? upgrade.items.slice(0, 2) : upgrade.items).map((item, index) => (
                                <li key={index}>
                                    <q>{item.original}</q> → <q>{item.improved}</q>
                                    {item.reason && <p>{item.reason}</p>}
                                </li>
                            ))}
                        </ul>

                    </div>
                ) : <p>“{upgrade.learnerWording}” → {upgrade.suggestion}</p>
                }
                </section>
            )}
            {grammarNotes && !compact && (
                <section style={{ fontSize: '0.9em' }}>
                    <h5>Grammar note</h5>
                    {grammarNotes}
                </section>
            )}
            {!!analysis.reusablePatterns?.length && (
                <section>
                    <h5>Reusable English patterns</h5>
                    <ul>{analysis.reusablePatterns.slice(0, 3).map((pattern, index) => (
                        <li key={index}><strong>{pattern}</strong></li>
                    ))}</ul>
                </section>
            )}
            {grammarNotes && compact && (
                <details>
                    <summary>Grammar notes</summary>
                    {grammarNotes}
                </details>
            )}
            {upgrade && 'items' in upgrade && upgrade.upgradedAnswer && (
                <details>
                    <summary>Your answer, upgraded</summary>
                    <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9em' }}>{upgrade.upgradedAnswer}</p>
                </details>
            )}
        </>
    );

    return (
        <>
            <aside style={{ border: '1px solid #d1d5db', borderRadius: '10px', padding: '12px', fontSize: '0.9em' }}>
                <h5>AI Reference</h5>
                <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{analysis.suggestedSummary}</p>
            </aside>
            {comparison}
        </>
    );
}
