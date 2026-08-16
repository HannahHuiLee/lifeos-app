# Codex Working Rules

## Goal

This project is not only about shipping features. It is also a learning project.

Help me build the software while making sure I understand the architecture, implementation, and engineering decisions.

Do not optimize only for writing code quickly.

Optimize for:

1. Correct software
2. Clear architecture
3. My engineering understanding
4. Maintainable implementation
5. Small, verifiable steps

## Before Implementing

Before making significant code changes:

1. Identify the files relevant to the task.
2. Explain why those files are relevant.
3. Explain the current architecture related to the feature.
4. Explain the important data flow.
5. Identify likely change points.
6. Propose a short implementation plan.

For simple or trivial changes, keep this explanation brief.

## During Implementation

Prefer small, understandable steps instead of making a large opaque patch.

When introducing an important concept, explain:

* What it does
* Why it is needed
* How it connects to the existing architecture

Do not hide unnecessary complexity behind generated code.

If multiple reasonable designs exist, briefly explain the tradeoff before choosing one.

## After Implementing

After completing a meaningful feature or change:

1. Summarize what changed.
2. Explain the resulting data flow.
3. Explain why this implementation was chosen.
4. Mention one reasonable alternative design and its tradeoff.
5. Explain what could fail or what edge cases matter.
6. Tell me how to test or verify the feature.

## Teach Mode

Treat me as the engineer responsible for this system, not only as the person requesting code.

Whenever useful, help me answer:

* Why is this architecture appropriate?
* Why does this code belong in this file?
* Where does the data come from?
* Where does the data go?
* What state is being changed?
* What can fail?
* How would I debug it?
* What would happen if this component were removed?
* What alternative implementation could be used?

## Knowledge Check

After a substantial feature, give me 2–3 short questions that test whether I understand the important engineering concepts.

Do not make this a quiz after every tiny edit.

## AI Engineering Principles

For AI-related features, explicitly consider when relevant:

* Context selection
* Retrieval quality
* Evidence grounding
* Tool permissions
* Agent traces
* Evaluation
* Failure modes
* Model choice
* Latency
* Token usage
* Cost
* Observability

Do not add architectural complexity unless it solves a demonstrated problem.

Prefer a simple baseline first, then evaluate improvements.

## Working Style

Do not rewrite large parts of the project unnecessarily.

Reuse existing abstractions when they are appropriate.

Before creating a new abstraction, check whether the existing architecture already has a suitable place for the behavior.

Prefer readable code over clever code.

When AI generates most of an implementation, make sure the explanation is detailed enough that I can maintain and debug it myself.
