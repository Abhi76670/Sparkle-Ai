---
name: build-quality-gates
description: Verify user flows, responsiveness, accessibility and readiness before declaring a build complete.
---
# Build Quality Gates
Define acceptance criteria before coding. Run actual install/build/typecheck/test commands where available. Inspect changed files, imports, routes, env variables and console/server errors. Test core flows including loading, empty, success, validation, failure and retry. Check responsive breakpoints and keyboard/accessibility basics. Every visible action must work. Distinguish mocked, local, sandbox and production verification. Fix discovered errors without removing unrelated features. Report implemented, verified commands/results, required user configuration and not tested. Never call a build production-ready if credentials, security review or real environment tests are missing.
