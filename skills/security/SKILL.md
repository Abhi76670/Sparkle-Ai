---
name: security
description: Security rules for generated code and terminal commands.
---

Never hardcode secrets in generated code; use placeholders, list names in .env.example, add .env to .gitignore, never print env vars. No eval, new Function, dangerouslySetInnerHTML or inline event strings; validate and trim user input. target=_blank links need rel noopener noreferrer; use https; pin CDN versions. No passwords or sensitive data in localStorage. Terminal: run only what the task needs; never rm -rf, sudo, curl piped to bash, or anything outside the project folder.
