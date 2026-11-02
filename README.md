# AI App Builder

A web application where you describe an app and an AI model (Google Gemini or NVIDIA NIM) writes a complete React 18 project file by file with:

- **Live Thinking**: Real-time thought stream with live updating bold headings.
- **Live Code**: Watch files get created, updated, and syntax-checked with `esbuild` in real time.
- **Interactive Preview**: Sandboxed browser preview with safe link/form handling, live console capture, bounded automatic runtime repair, and a real isolated Vite dev server for Vite projects.
- **Independent Model Routing**: Select a Planner separately from the Run model in both Build Mode and Chat Mode. Planner choices include Gemini plus chat-capable NVIDIA Nemotron and DeepSeek models; Run choices include Gemini and available NVIDIA NIM models. NVIDIA Planner and executor calls require `NVIDIA_API_KEY`; availability and pricing depend on the provider account.
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

## Reliability and Chat Mode improvements (2026-11-02)

- Reference-image edits now pass the uploaded image bytes to Gemini's image model. Edit requests preserve the original subject and only apply the requested change; reference-image edits do not silently fall back to text-only NVIDIA generation.
- Build Mode now has an explicit dependency-recovery workflow. An `ERESOLVE` install failure receives one bounded automatic `npm install --legacy-peer-deps` retry; other install errors are returned to the coding agent with instructions to diagnose, correct package versions and retry.
- Chat Mode now defaults to complete, self-contained HTML/CSS/JS with a white/light design unless the user asks otherwise. It distinguishes simple runnable prototypes from larger projects where Build Mode is recommended.
- Chat code previews now offer a full-screen code view, a full-screen live preview and a “Fix this code with Gemini” action when the preview reports a runtime error.
- Build Mode's app preview can expand to the full viewport, hiding terminal chrome while expanded.
- Added skills: `reference-image-editing`, `dependency-recovery`, `chat-runtime-verification`, and `fullscreen-preview`.

### Verification notes

The updated server TypeScript and the main React/Babel JSX script both passed syntax transpilation checks. A full dependency installation was attempted but did not finish within the available test window, so a full Vite production build and live Gemini/image-edit API test remain unverified. Configure the required server-side Gemini/NVIDIA environment variables before running the application.

The root `index.html` is kept in sync with `public/index.html` so `npm run build` builds the actual application shell rather than the previous empty React entry. Vite's `publicDir` is disabled to prevent a duplicate public index from overwriting the root build entry.


## Preview-first update
New-project instructions now prioritize immediate browser preview and avoid unrequested Vite/Next/TypeScript frameworks. Model picker includes All, Gemini, Nemotron, and DeepSeek family tabs. Gemini remains the default. NVIDIA endpoint availability requires a configured NVIDIA API key.

## Live preview and model routing update

- Build Mode now has independent Planner Model and Run Model controls. The planner selector is restricted to Gemini models because the planner endpoint uses the Google GenAI API; the Run Model selector can choose the configured Gemini/NVIDIA-hosted executor models.
- The model picker includes All, Gemini, Nemotron, DeepSeek and NVIDIA family tabs. The actual available executor list depends on the configured NVIDIA API key/catalog response; model availability and pricing are not guaranteed by the picker.
- Vite projects now start an isolated preview workspace. Dependencies are installed with lifecycle scripts disabled; ERESOLVE gets one `--legacy-peer-deps` retry. Vite starts on loopback and is exposed at a same-origin `/preview/...` URL. The UI waits for HTTP readiness and shows the real startup error if it fails.
- Plain HTML/JS and browser-ready React projects continue using the instant iframe preview. Next.js/other server frameworks are not silently treated as live Vite previews.
- Preview sessions are replaced per project and cleaned up after 45 minutes. Preview is for development validation, not production hosting.

## Model selection and previews

- Build Mode and Chat Mode both have separate Planner and Run model selections.
- Planner options are Gemini 3.8 Flash and Gemini 3.5 Flash. The current planner implementation uses the Gemini API.
- Planner and Run model options are independently selectable in Chat and Build modes. Planner includes Gemini plus Nemotron and DeepSeek; Run includes Gemini and the available NVIDIA NIM catalog entries. NVIDIA Planner and execution require `NVIDIA_API_KEY` on the server. A provider model being listed does not guarantee free-tier access or account entitlement.
- Vite projects are previewed using an isolated temporary workspace and a real Vite dev server. Dependency installation and server startup errors are shown in the Preview panel. Plain browser-ready projects continue to use the instant sandbox preview.


### NVIDIA Planner models

The Planner picker includes the chat-capable Nemotron and DeepSeek models returned by the NVIDIA model catalog, plus safe fallback IDs when the catalog is unavailable. DeepSeek V4.1 Flash is listed with a free NVIDIA endpoint; DeepSeek V4 Flash may require partner or self-hosted access and can fail on the serverless endpoint depending on account/model availability. Model listing does not guarantee entitlement.
