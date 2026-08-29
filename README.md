This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


数据库：
terminal：  npx prisma studio

## Grounding Reliability V3

### Deterministically improved

Evidence-backed Reflection now has two deterministic reliability safeguards, with regression coverage:

- normalized exact-content deduplication before LLM context construction, including Current ↔ Historical and Historical ↔ Historical duplicates;
- confidence caps based on validated independent Historical Evidence;
- regression coverage for Reflection Retrieval and Evidence Validation.

### Evaluated but not solved

Semantic Current/Historical attribution was evaluated but is not solved. Prompt constraints were strengthened, then Case 5 was run ten times with `gpt-4.1-mini` after the prompt was frozen. Only 2/10 runs met the strict Grounding criteria, so the prompt change is recorded as a partial, unstable mitigation rather than a fix.

### Current reliability boundary

The current reliability boundary is explicit: **LifeOS can validate evidence provenance more reliably than it can validate semantic claim entailment.** The project does not claim production-grade Grounding or semantic correctness.

### Next reliability direction

Next reliability work should explore claim-level Grounding structure, semantic verification, and repeated eval pass-rate tracking. Detailed reasoning and lessons are documented in [Grounding Reliability V3 — Engineering Notes](docs/grounding-reliability-v3-engineering-notes.md).

## Development Notes

- [Reflection MVP — 2026-08-08](docs/dev-notes-2026-08-08.md)
- [Grounding Reliability V3 — Evidence Validity Is Not Semantic Grounding](docs/grounding-reliability-v3-engineering-notes.md)
