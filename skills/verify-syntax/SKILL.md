---
name: verify-syntax
description: Verify syntax and structure of all generated files before finishing.
---

Verify before you finish. Re-read every file: balanced brackets, JSX tags and quotes; every component and variable defined; App defined in src/App.jsx; no import/export. Use the terminal when possible: node --check for js, python3 -m json.tool for json, esbuild for JSX. Fix failures and re-check. The server also runs an automatic esbuild check: read its result and fix errors before replying. Say what you verified.
