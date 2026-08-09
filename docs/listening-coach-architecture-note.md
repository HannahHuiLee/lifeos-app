# Listening Coach MVP — Architecture Note

> Status: Proposed  
> Target project: `lifeos-app`  
> MVP flow: Practice → Answer → AI Feedback → Save Session → History

## 1. Feature goal

Listening Coach 帮助用户完成一次短听力练习，并把“听到了多少”转化为具体、可执行的反馈。

一次完整 session 包含：

1. 用户播放一段 workplace conversation。
2. 用户回答三个理解问题：main idea、decision、next step。
3. AI 对照原文和参考要点判断理解程度。
4. 页面展示针对性 feedback，而不只是一个分数。
5. 用户确认后保存本次 session。
6. 用户可以在 History 中回顾练习结果。

MVP 的核心不是题库规模，而是验证这个反馈闭环是否有价值。

## 2. User flow

```text
/listening
    ↓
Play practice audio
    ↓
Answer three questions
    ↓
POST /api/listening/analyze
    ↓
AI returns structured feedback
    ↓
User reviews feedback
    ↓
POST /api/listening/sessions
    ↓
Session saved in SQLite
    ↓
/listening/history
```

### UI states

The practice page should have five explicit states:

```text
ready → listening → answering → analyzing → feedback → saved
```

- `ready`: practice is visible and Play is available.
- `listening`: audio is playing; the user may pause or replay.
- `answering`: answers are editable.
- `analyzing`: Get Feedback is disabled and loading feedback is shown.
- `feedback`: AI feedback is visible; Save Session becomes available.
- `saved`: the saved result is confirmed and History is linked.

If the user changes an answer after receiving feedback, the old feedback must be cleared. This prevents saving feedback that no longer corresponds to the current answers.

## 3. MVP product scope

### Included

- One fixed `Workplace Conversation` practice.
- Audio playback.
- Three free-text comprehension questions.
- Structured Mock or OpenAI feedback.
- Explicit Save Session action after feedback.
- Listening History page.
- SQLite persistence through Prisma.
- Loading, validation, empty and error states.

### Not included yet

- Authentication or multiple users.
- A large practice library.
- Audio upload or generation inside the app.
- Speech-to-text answers.
- Vocabulary extraction.
- Spaced repetition.
- Adaptive difficulty.
- Cross-session progress analytics.

These should not block the first usable loop.

## 4. Proposed application structure

The feature should follow the same architectural pattern already used by Reflection: Next.js App Router, Route Handlers, Prisma, SQLite, Zod, and Mock/real LLM modes.

```text
app/
├── listening/
│   ├── page.tsx                    # Practice, answers, feedback, save
│   └── history/
│       └── page.tsx                # Saved listening sessions
└── api/
    └── listening/
        ├── analyze/
        │   └── route.ts            # Generate feedback; does not save
        └── sessions/
            └── route.ts            # POST save; GET history

lib/
├── listening-analysis.ts           # Zod schemas and TypeScript types
└── listening-practices.ts           # MVP practice metadata/reference data

prisma/
└── schema.prisma                    # ListeningSession model

public/
└── listening/
    └── workplace-conversation-01.mp3
```

The first version can use browser speech synthesis instead of an MP3 if no recording is available. A real audio file is preferable before user testing because voice, pace and natural pauses are part of listening comprehension.

## 5. Request and data flow

### Step A: Load the practice

The `/listening` page loads one known practice. Public information includes:

- practice ID;
- title and category;
- difficulty;
- audio URL;
- the three questions.

The transcript, reference answers and grading rubric should stay on the server. They should not be sent to the browser before the user submits answers.

### Step B: Request AI feedback

The browser sends only the practice ID and user answers:

```http
POST /api/listening/analyze
Content-Type: application/json
```

```json
{
  "practiceId": "workplace-conversation-01",
  "answers": {
    "mainIdea": "They are discussing a project delay.",
    "decision": "They decided to move the launch to Friday.",
    "nextStep": "Alex will email the client today."
  }
}
```

The server then:

1. validates the request with Zod;
2. retrieves the server-side transcript and rubric using `practiceId`;
3. calls the Mock evaluator or OpenAI;
4. validates the model output with Zod;
5. returns structured feedback without saving a session.

This separation keeps the UX faithful to `Feedback → Save`. It also avoids creating unwanted History entries whenever a user merely tests an answer.

### Step C: Return structured feedback

Recommended response shape:

```json
{
  "model": "mock-listening-v1",
  "feedback": {
    "score": 78,
    "understandingLevel": "partial",
    "mainIdea": "You understood that the team was discussing a delayed launch.",
    "missedInformation": [
      "The deadline moved specifically to Friday."
    ],
    "betterSummary": "They decided to delay the launch until Friday, and Alex will notify the client today.",
    "focusNextTime": "Listen for the final decision and the person responsible for the next action.",
    "questionFeedback": [
      {
        "questionId": "mainIdea",
        "status": "correct",
        "feedback": "You captured the topic accurately."
      },
      {
        "questionId": "decision",
        "status": "partial",
        "feedback": "You identified a delay but missed the new Friday deadline."
      },
      {
        "questionId": "nextStep",
        "status": "correct",
        "feedback": "You identified both the owner and the action."
      }
    ]
  }
}
```

`score` is useful for progress tracking, but the feedback text is the primary product value.

### Step D: Save the session

After reviewing the feedback, the user clicks Save Session:

```http
POST /api/listening/sessions
Content-Type: application/json
```

The request contains:

- practice ID;
- the submitted answers;
- validated feedback;
- model name.

The server validates the payload again and writes one immutable `ListeningSession` row. The API returns the new session ID and creation time.

### Step E: Load History

```http
GET /api/listening/sessions
```

The endpoint returns the most recent sessions in descending creation order. For the MVP, a maximum of 50 records is consistent with the current Reflection History behavior.

## 6. Data storage

### SQLite and Prisma

Listening results should live in the existing SQLite database (`dev.db`) and be accessed through Prisma, just like Reflection data.

Recommended model:

```prisma
model ListeningSession {
  id           String   @id @default(cuid())
  practiceId   String
  practiceTitle String
  answers      String
  feedback     String
  score        Int
  model        String?
  createdAt    DateTime @default(now())

  @@index([createdAt])
  @@index([practiceId])
}
```

Because the current SQLite setup does not use Prisma's native JSON type:

- `answers` is stored with `JSON.stringify()`;
- `feedback` is stored with `JSON.stringify()`;
- data is parsed and validated with Zod when read back.

`score` remains a separate integer column so future progress queries do not need to parse every feedback JSON value.

### What is stored where

| Data | MVP location | Reason |
|---|---|---|
| Audio file | `public/listening/` | Static, simple and cacheable |
| Practice title/questions | Application practice catalog | Version-controlled content |
| Transcript/reference answer | Server-side practice catalog | Needed for evaluation; should not be exposed before submission |
| User answers | `ListeningSession.answers` | Reconstruct the attempt |
| AI feedback | `ListeningSession.feedback` | Preserve exactly what the user saw |
| Numeric score | `ListeningSession.score` | Fast future trend queries |
| Model name | `ListeningSession.model` | Debugging and comparison after model changes |
| Creation time | `ListeningSession.createdAt` | History ordering and progress tracking |

For this local single-user MVP, no `userId` is needed. Add ownership only when authentication is introduced.

## 7. AI evaluation design

### Structured output

The LLM must not return arbitrary Markdown. Define a Zod schema in `lib/listening-analysis.ts` and use it for:

1. constraining OpenAI structured output;
2. validating Mock output;
3. validating API responses before saving;
4. providing frontend TypeScript types;
5. validating JSON restored from SQLite.

### Evaluation rubric

The prompt should evaluate meaning rather than grammar. Each answer is checked against:

- correct core information;
- omitted key information;
- invented or contradicted information;
- whether the decision/action owner/time is understood.

The AI should not punish minor spelling or grammar errors when the intended meaning is clear.

Suggested score weighting:

| Area | Weight |
|---|---:|
| Main idea | 35% |
| Decision | 35% |
| Next step | 30% |

Suggested understanding levels:

- `strong`: 80–100
- `partial`: 50–79
- `needs_practice`: 0–49

### Mock and real modes

Keep the same environment switch already used by Reflection:

```env
MOCK_LLM=true
```

- Mock mode should evaluate a few expected keywords for this known practice and return deterministic feedback.
- Real mode should use `OPENAI_API_KEY` and the configured `OPENAI_MODEL`.
- Both paths must produce the same schema.

A deterministic Mock is better than a single fixed response because it lets the UI demonstrate correct, partial and missed-answer states.

## 8. Error handling

The MVP should handle these cases explicitly:

- Play is unavailable because the browser has no audio/speech support.
- One or more answers are empty.
- AI request fails or returns invalid structured output.
- User changes an answer after feedback was generated.
- Save fails after feedback succeeds.
- A stored JSON result can no longer be parsed.
- History is empty.

Answers must remain in the page when analyze or save fails so the user does not lose work.

## 9. Relationship to Reflection

Reflection and Listening Coach should share infrastructure, not data models.

Shared patterns:

- Next.js Route Handlers;
- Prisma and SQLite;
- Zod-validated AI output;
- Mock/real LLM switch;
- save and history behavior;
- common navigation and status UI.

Separate domain models are preferable because a Reflection is free-form personal writing while a Listening Session is an assessment tied to a known practice and numeric score.

In a later milestone, both can appear in a unified LifeOS Activity timeline:

```text
Activity
├── Reflection completed
├── Listening practice completed
└── Recent pattern analysis completed
```

Do not create a generic Activity database model until at least two modules genuinely need shared querying.

## 10. Recommended five-hour implementation plan

### Hour 1 — Data contract and database

- Add Zod answer/feedback schemas.
- Add `ListeningSession` to Prisma.
- Generate and inspect the migration.
- Add the fixed practice catalog entry.

### Hour 2 — Analyze endpoint

- Implement request validation.
- Build deterministic Mock evaluation.
- Add real OpenAI structured-output path.
- Test correct, partial and empty answers.

### Hour 3 — Practice page

- Add audio Play/replay behavior.
- Add three answer fields.
- Add Get Feedback states.
- Render the four key feedback sections.

### Hour 4 — Save and History

- Implement session POST/GET.
- Add Save Session state.
- Build Listening History cards.
- Add Navbar links.

### Hour 5 — Reliability and polish

- Verify full happy path.
- Verify validation and API failures.
- Run Prisma generation, lint and production build.
- Add one seed/demo practice and update project notes.

If time becomes tight, keep one practice and reduce visual polish. Do not remove structured validation or persistence—the end-to-end loop is the MVP.

## 11. Next milestones

### P0 — Make the MVP trustworthy

1. Use a real recorded audio clip.
2. Add API tests for analyze and save routes.
3. Add one end-to-end test for the complete session flow.
4. Confirm that changing answers invalidates old feedback.
5. Add clear retry behavior without losing answers.

### P1 — Make practice repeatable

1. Add 5–10 practices across workplace scenarios.
2. Add difficulty and topic metadata.
3. Prevent recently completed practices from being immediately repeated.
4. Add a session detail view.
5. Show score trend and common missed-information types.

### P2 — Make coaching adaptive

1. Recommend the next practice based on weaknesses.
2. Track skills such as main idea, details, decisions and action items separately.
3. Generate a weekly listening summary.
4. Connect Listening insights with Reflection when the user explicitly chooses to do so.

### P3 — Prepare for production

1. Add authentication and `userId` ownership.
2. Move from local SQLite to production storage.
3. Add rate limits and model-cost controls.
4. Version practices and evaluation rubrics.
5. Add privacy, retention and deletion controls.

## 12. MVP completion criteria

The feature is complete when a user can:

- play the workplace conversation;
- answer all three questions;
- receive feedback that changes based on the answers;
- see main idea, missed information, better summary and next focus;
- save the reviewed result;
- refresh the app and find it in Listening History;
- complete the same flow in Mock mode without API credits.

