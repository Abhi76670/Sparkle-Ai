# AI App Builder

A web application where you describe an app and an AI model (Google Gemini or NVIDIA NIM) writes a complete React 18 project file by file with:

- **Live Thinking**: Real-time thought stream with live updating bold headings.
- **Live Code**: Watch files get created, updated, and syntax-checked with `esbuild` in real time.
- **Interactive Preview**: Sandboxed browser preview with safe link/form handling, live console capture, and bounded automatic runtime repair.
- **Built-in Terminal & Console**: Captures `console.log/info/warn/error`, uncaught runtime errors, unhandled promise rejections, and server terminal command output. Runtime errors can trigger up to two automatic repair rounds per user request.
- **One-Click ZIP Export**: Downloads all project files along with a standalone runnable `index.html`.

## Stack

- **Backend**: Node.js, TypeScript (`tsx`), Express, `esbuild`, `@google/genai`
- **Frontend**: Single-file `public/index.html` using React 18.3.1, ReactDOM 18.3.1, Babel Standalone 7.24.7, and JSZip 3.10.1 from cdnjs.

## Quick Start

1. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` (and optionally `NVIDIA_API_KEY`).
2. Install dependencies and start the server:

```bash
npm install
npm run dev
```

3. Open `http://localhost:3000`.

## Advanced Build and Integration Skills
Build Mode uses Gemini as the planning architect and forwards its detailed implementation brief alongside the original request to the selected executor model. The shared skill library now includes advanced web architecture, responsive product engineering, integration discovery, API contract engineering, database engineering, payment gateway integration, terminal/curl verification and build quality gates. Integrations require verified provider documentation and an API base URL; secrets must be configured server-side as environment variables. Sandbox checks are preferred, and live payment or destructive operations are never performed without explicit authorization.

## Multimodal Build Mode

- Uploaded screenshots/images are analyzed by Gemini and converted into a visual implementation brief for the selected coding model.
- Uploaded videos are sent through Gemini Files API processing; Gemini extracts screen sequence, layout, interactions, motion and visual details, then forwards the summary to the selected executor. Video analysis currently supports up to two clips of 20 MB each.
- Build Mode can request raster assets using `<generate_image aspect_ratio="16:9">...</generate_image>`. Generated images are stored in the project as binary assets and used in the preview/ZIP export.
- For a non-vision NVIDIA model, Gemini's visual analysis text is forwarded so the executor does not silently ignore reference images/videos.

## Clarification and Q&A

The agent answers direct questions without changing files. It asks a focused clarification only when a missing decision affects implementation correctness or security (for example payment provider, database, authentication provider or API base URL). Non-critical design decisions use sensible defaults.

## Terminal safety and verification limits

Terminal commands run in a temporary per-job workspace using a restricted command allowlist and `shell: false`; shell chaining, pipes, redirection and destructive commands are blocked. `npm install` uses `--ignore-scripts`. This is a restricted workspace, **not a full OS/container isolation boundary**. Do not run untrusted projects on a machine containing sensitive files or credentials. API secrets are not passed through the terminal environment; explicitly named server-side environment variables may be expanded into a CURL command without displaying their values in the command text.

The server checks generated JavaScript/JSX with esbuild. A syntax pass is not proof that the app works. Build/type-check/test commands and real browser viewport testing must be run separately before claiming those checks passed. Responsive design guidance covers mobile, tablet and desktop; actual visual testing depends on the available preview/browser tooling.

## Chat Mode response quality

Chat Mode now loads a dedicated `chat-response-quality` skill alongside the existing skill library. It improves intent recognition, language matching, response structure, accuracy checks, clarification behavior, conversation continuity and honest reporting. It selects concise or detailed output based on the request instead of forcing every answer into the same template.
