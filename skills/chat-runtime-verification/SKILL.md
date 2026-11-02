---
name: chat-runtime-verification
description: Produce reliable, runnable Chat Mode HTML/CSS/JS with preview-safe behavior.
---
# Chat Runtime Verification
- Default to a complete single-file HTML document with embedded CSS and JavaScript.
- Use a white/light background by default unless the user explicitly asks for dark mode.
- Do not rely on React, npm packages, build tools, server routes or remote assets unless requested and available in the preview sandbox.
- Ensure every DOM selector exists before use, event listeners are attached after DOM creation, and variables are declared before use.
- Handle form submission, empty inputs, localStorage exceptions, JSON parsing and async errors safely.
- Avoid unsafe assumptions about APIs, payment providers, authentication or backend storage. Clearly label front-end-only demonstrations.
- Keep code complete: no TODOs, missing functions, placeholder buttons or partial snippets when a full app is requested.
- For multi-screen/backend-heavy apps, recommend Build Mode for full project architecture, but still return a working Chat Mode prototype if code was requested.
- If the preview reports a runtime error, use the exact error and current code to produce a complete corrected document without removing working features.
