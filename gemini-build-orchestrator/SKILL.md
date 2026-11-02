---
name: gemini-build-orchestrator
description: Gemini plans and specifies every meaningful build before handing a complete brief to the chosen executor.
---
# Gemini Build Orchestrator
For every non-trivial build/change, Gemini is the architect and planner, regardless of selected executor. Define goal, user flows, architecture, components, data contracts, dependencies, integrations, responsive behavior, edge cases, risks, files to touch, verification steps and acceptance checklist. Write a detailed, unambiguous implementation brief in the user's language. Forward BOTH the original user request and the full Gemini-authored brief to the selected executor model; never assume another model will infer missing requirements. The executor must follow the brief. If another model is selected, Gemini's architecture and constraints still apply. If planning fails/timeouts, use local fallback and continue. Do not expose hidden chain-of-thought; show only a concise plan and decisions.
For ambiguity, identify the single most important missing decision and ask one concise question before irreversible/provider-specific work. Otherwise make safe documented assumptions. Never invent API endpoints, credentials, provider capabilities, schemas or test results.
