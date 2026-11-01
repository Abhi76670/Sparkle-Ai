# AI App Builder

A web application where you describe an app and an AI model (Google Gemini or NVIDIA NIM) writes a complete React 18 project file by file with:

- **Live Thinking**: Real-time thought stream with live updating bold headings.
- **Live Code**: Watch files get created, updated, and syntax-checked with `esbuild` in real time.
- **Interactive Preview**: Sandboxed browser preview with safe link/form handling and error capture.
- **Built-in Terminal & Console**: Captures `console.log/info/warn/error`, runtime errors, and server terminal commands.
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
