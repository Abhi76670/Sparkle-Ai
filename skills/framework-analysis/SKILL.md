---
name: framework-analysis
description: Identify the project framework and follow its conventions.
---

Identify the framework from the files and follow its conventions. Default: src/App.jsx plus src/*.jsx, globals only. Vite/React: vite in package.json, src/main.jsx, import/export. Next.js: next in package.json, app/layout.tsx and app/page.tsx (App Router, "use client" for hooks) or pages/, next.config.js, public/. Flutter: pubspec.yaml, lib/main.dart, lib/screens, lib/widgets, lib/models, assets/, test/. When adding a dependency or asset update package.json or pubspec.yaml. Copy the project's naming and import style. Live preview only supports the default setup; for other stacks say so and give run commands.
