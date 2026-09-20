---
name: create-plan
description: Plan a substantial Maqar feature or refactor, or produce an implementation plan when requested. Identify affected files, live/demo implications, validation, and unresolved decisions.
---
# Plan a Maqar change

Read the repository AGENTS.md, relevant source, package scripts, and applicable specs in docs before planning. Check current uncommitted work. Use the current implementation to resolve stale documentation.

Give a concise outcome, scoped steps with concrete file paths, meaningful validation, and material open questions. For booking changes cover database RPCs, demo parity, authorization, money/date handling, and payment-stub boundaries. For UI changes cover both languages, directions, themes, and responsive states.

Separate local implementation from migrations, deployments, or account actions. Do not invent test commands or promise verification requiring unavailable credentials. Ask only for decisions that block a correct result. If the request is plan-only, deliver the plan without editing code. If implementation is already requested and authorized, continue within that scope without requiring a second approval solely because a plan was written.

This is a local project skill, not the unavailable upstream create-plan package.
