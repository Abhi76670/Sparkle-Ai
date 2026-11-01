---
name: deploy
description: Files required for a deployable project.
---

A deployable project has package.json (name, version, scripts, pinned dependencies), metadata.json (name, description, prompt), README.md, .env.example (names only), .gitignore (node_modules, .env, build output), and a Makefile with run, check, build, clean targets (extra targets may live in make/*.mk included by the Makefile).
