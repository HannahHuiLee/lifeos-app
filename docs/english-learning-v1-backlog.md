# English Learning V1 Status

## Implemented

- Shared Material and LearningUnit persistence, progress, and resume.
- Separate Reading and Listening practice flows.
- Reading answer and source-snapshot persistence.
- Structured Reading analysis.
- Transactional analysis and progress updates.
- Unified material entry with legacy demo content removed from the primary UI.
- Accessible answer fields and clearly labeled mock feedback.

## Verified

- 182 automated tests passed; 3 skipped.
- TypeScript check passed.
- Production build passed.
- Temporary SQLite verification passed:
  migration replay, transaction rollback, successful commit,
  and history preservation after material deletion.
- Manual Reading and Listening progress flows verified.
- Real-model Reading analysis completed successfully.
- Completion flow verified through `1 / 1`.
- Revised Reading prompt no longer produced unsupported numerical deduction
  in the evaluated sample.

## Known limitations

- Evidence qualifiers are not always preserved precisely.
  Example: participant self-report may be summarized too strongly.
- Similar feedback may appear in both missing-points and correction sections.


## Optional follow-up

- Improve retry and idempotency behavior.
- Add manual audio timestamps if later required.
- Tighten MaterialWithUnits domain types for difficulty and material status.
- Revisit forced two-unit split for short listening materials. It currently exists mainly to exercise the multi-unit lifecycle.

## Outside V1

- Expression Bank, mastery states, and spaced repetition.
- Readiness engine and dashboards.
- URL scraping and semantic segmentation.
- Voice recording and Reading TTS.