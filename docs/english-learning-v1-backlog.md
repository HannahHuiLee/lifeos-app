# English Learning V1 Backlog

The current vertical slice intentionally stops at persistent video/podcast
units, Listening Coach practice, covered progress, resume, and saved article
text units.

## Weekend V1 candidates

- Add optional manual timestamps and segment-aware playback for podcast/video
  units; today's deterministic transcript splitter does not locate audio.
- Build the first Reading Coach flow on top of existing article text units.
- Add an accessible label for the listening-summary textarea.
- Prevent duplicate sessions when saving succeeds but analysis fails and the
  user retries the whole submission.
- Verify Prisma migration deployment with a supported Node/Prisma toolchain;
  Prisma 5.22's schema engine failed under the local Node 24 environment even
  though the schema validated and every migration applied successfully with
  SQLite directly.

## Later, not part of this V1

- Expression Bank and mastery states.
- Spaced repetition and cross-material review.
- Readiness scoring and weekly dashboards.
- URL scraping, automatic transcription, and semantic segmentation.
