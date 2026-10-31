# Valid citations do not establish semantic support

This offline demonstration uses only invented Reflection records and generated
claims. It reads no database, environment file, personal records, or saved runs,
and makes no API calls. Run commands from the repository root with dependencies
installed (`npm ci` in a fresh checkout).

## Scenario and expected annotation

Two fictional entries each report completing one paper model at a quiet desk.
The generated pattern claims: "I complete every paper model I attempt at the
quiet desk, without exception."

Both IDs are valid and both excerpts exactly match the supplied records. The
expected human annotation is **unsupported**: two completed models do not
establish a universal success rate across all attempts. Unsupported does not
mean the claim has been proven false. This annotation is authored fixture
metadata, not a semantic-verifier result or an independent human review.

## Existing architecture and data flow

- `lib/evidence-validation.ts`: `validateAnalysisEvidence` checks the current
  source ID, historical allowlist IDs, nonempty exact-substring excerpts, and
  confidence caps based on distinct historical IDs. It does not infer entailment.
- `lib/claim-verification.ts`: `buildClaimVerificationInputs` produces existing
  claim/evidence contracts. Its separate historical-cardinality heuristic is a
  narrow wording/count check, not a general semantic verifier.
- `lib/claim-support-verifier.ts`: an executable experimental OpenAI semantic
  verifier exists, requiring credentials and an API call. It is not integrated
  into the evidence-backed Reflection route and is **not run here**.
- `evals/fixtures/claim-verification.ts` defines the reused `LabeledClaimFixture`
  format; its import here is type-only. Existing synthetic timeline fixtures and
  manual/V3 evaluation tests remain unchanged.
- The production route `app/api/reflections/[id]/analyze-with-evidence/route.ts`
  calls deterministic evidence validation. The main repository README documents
  semantic verification as experimental and offline.
- `scripts/run-evidence-backed-reflection-v2.zsh` is a database/API harness that
  exports records. It and saved-run evaluations are deliberately not executed.

Demo flow: synthetic records + generated analysis -> existing evidence validator
-> existing claim builder/schema. The expected semantic label stays separate.
No application behavior changes and no second evaluation framework are added.

## Commands and actual results

Executed with Vitest 4.1.11:

```sh
npm test -- evals/citation-vs-support.synthetic.test.ts lib/evidence-validation.test.ts lib/claim-verification.test.ts
```

Result: exit 0; **3 test files passed, 35 tests passed** (including 4 demo tests).

| Test | Demonstrates | Does NOT demonstrate |
| --- | --- | --- |
| Valid citations retain the universal claim | Existing analysis schema accepts the fixture; citations pass; claim survives; one historical ID caps confidence at low | Semantic support or successful overgeneralization detection |
| Unknown historical ID | Citation outside the supplied allowlist is removed; no remaining insight yields insufficient evidence | Entailment, real database provenance, or retrieval quality |
| Invented historical excerpt | Text absent from the supplied source is rejected | Whether an authentic excerpt supports a claim |
| Claim contract and label | Existing claim builder/schema remain compatible; expected annotation is preserved | Semantic inference, model accuracy, or independent human agreement |
| Existing evidence-validation suite | Deterministic source/excerpt filtering and confidence behavior in its unit cases | General semantic reliability |
| Existing claim-verification suite | Claim construction, result contracts, source coverage, and narrow cardinality rules in its unit cases | Live verifier performance or production semantic enforcement |

Additional executed checks:

```sh
npx eslint evals/fixtures/citation-vs-support.synthetic.ts evals/citation-vs-support.synthetic.test.ts
git diff --check
```

Both exited 0 with no output. A Python pattern scan over the three new files
also exited 0: no user/home paths, Windows drive paths, private-key headers,
common OpenAI/GitHub token patterns, emails, or phone-number patterns were found.
Source review confirmed invented content and no runtime or saved-run data imports.
Pattern scanning cannot prove the absence of every possible secret.

## Limitations and public-data boundary

The expected semantic outcome is an annotation only. No automatic semantic
verdict, detection rate, or model performance is measured. Lower confidence does
not repair the claim. Tests use supplied in-memory sources and do not prove those
sources correspond to external reality. No full suite, saved-response evaluation,
database harness, live API evaluation, or application build was run.

All new IDs, timestamps, records, and claims are synthetic. Only these three new
demo files were checked for secrets, personal identifiers, and machine-specific
paths; this is not a privacy audit of existing repository artifacts. No existing
saved response or private evaluation artifact is included in this demonstration.
