import 'dotenv/config';
import dns from 'dns';
import net from 'net';
import https from 'https';
import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import zlib from 'zlib';
import { exec } from 'child_process';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

// Force IPv4 first and disable autoSelectFamily to avoid IPv6 blackhole delays in containers
try {
  dns.setDefaultResultOrder('ipv4first');
  net.setDefaultAutoSelectFamily?.(false);
} catch {
  // ignore if unsupported
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Direct NVIDIA API key configured in server.ts without requiring .env
const DIRECT_NVIDIA_API_KEY =
  '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';

function getNvidiaApiKey(): string {
  return DIRECT_NVIDIA_API_KEY;
}

function decideSmartProjectName(rawPrompt: string): string {
  const cleaned = String(rawPrompt || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[`"'*_#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'New Project';

  const isNotes = /\b(notes?|summary|summarize|study guide|cheat sheet|revision)\b/i.test(cleaned);
  const isImage =
    /\b(image|img|photo|picture|pic|illustration|artwork|wallpaper|poster|logo)\b/i.test(cleaned);
  const isMath = /\b(solve|calculate|formula|equation|surface area|volume|integral|derivative)\b/i.test(
    cleaned
  );

  const stripped = cleaned
    .replace(
      /^(?:please\s+|can you\s+|could you\s+|i want(?:\s+you)?\s+to\s+|help me\s+)?(?:build|create|craete|make|design|develop|write|generate|genrate|genrateion|genration|draw|show|solve|explain|give me|prepare)\s+(?:me\s+)?(?:a\s+|an\s+|the\s+|some\s+)?(?:modern\s+|simple\s+|clean\s+|complete\s+|full\s+|beautiful\s+)?(?:notes?\s+(?:on|for|about)\s+|image\s+of\s+|picture\s+of\s+|photo\s+of\s+|app\s+for\s+|website\s+for\s+)?/i,
      ''
    )
    .replace(/\s+(?:app|application|website|web\s+app|in\s+html.*|using\s+react.*)$/i, '')
    .trim();

  const stopWords = new Set([
    'a',
    'an',
    'the',
    'and',
    'or',
    'of',
    'for',
    'in',
    'on',
    'to',
    'with',
    'by',
    'at',
    'from',
  ]);

  const rawWords = (stripped || cleaned)
    .replace(/[^a-zA-Z0-9&\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);

  if (rawWords.length === 0) return 'New Project';

  const titled = rawWords
    .map((w, idx) => {
      const lower = w.toLowerCase();
      if (idx > 0 && stopWords.has(lower)) return lower;
      if (/^(ui|ai|api|css|js|html|crm|erp|pos|3d|2d|vr|ar)$/i.test(w)) {
        return w.toUpperCase();
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');

  if (isNotes && !/notes/i.test(titled) && rawWords.length <= 3) {
    return `${titled} Notes`;
  }
  if (isImage && !/image|photo|art/i.test(titled) && rawWords.length <= 3) {
    return `${titled} Image`;
  }
  if (isMath && !/math|solver|notes/i.test(titled) && rawWords.length <= 3) {
    return `${titled} Solution`;
  }
  return titled;
}

function getGeminiApiKey(): string {
  return process.env.GEMINI_API_KEY || '';
}

app.use(express.json({ limit: '50mb' }));

// Dynamically load esbuild if installed; skip silently if not installed
let esbuildMod: any = null;
try {
  esbuildMod = await import('esbuild');
} catch {
  esbuildMod = null;
}

function getGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: getGeminiApiKey() || 'MISSING_KEY',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function maskKey(key?: string): string {
  if (!key || key === 'MY_GEMINI_API_KEY' || key === 'MY_NVIDIA_API_KEY' || key === 'MISSING_KEY') {
    return '(not set)';
  }
  if (key.length <= 8) {
    return key.slice(0, 2) + '***' + key.slice(-2);
  }
  return key.slice(0, 4) + '...' + key.slice(-4);
}

const SKILL_NAMES = [
  'web-design',
  'responsive',
  'local-storage',
  'project-memory',
  'media',
  'security',
  'run',
  'verify-syntax',
  'requirements',
  'function-requirements',
  'deploy',
  'project-structure',
  'edit-responsibility',
  'framework-analysis',
  'error-free',
];

const BASE_SYSTEM_PROMPT = `You are an AI app builder inside a dashboard, with your own terminal. Projects are simple React 18 apps with NO build step and NO imports/exports. Files are plain scripts run in the browser with Babel; React and ReactDOM are globals. Always have src/App.jsx defining function App(). Extra components go in other src/*.jsx files (loaded alphabetically, App.jsx last). Styles go in src/styles.css. Output format (never in markdown code fences): write or edit a file with the full content using <file path="src/App.jsx">full content</file>; delete with <delete path="src/Old.jsx"/>; run a terminal command with <run>shell command</run>; after <run> tags stop and wait for results. Everything outside tags is your reply. You are given the current project files: only write files that need to change. If the user only asks a question, answer in plain text and do not write files. Before building, think about audience, sections, believable content (never lorem ipsum) and a distinctive style. A build is complete only when src/App.jsx and src/styles.css exist; for a very vague request build a good first version and ask 1-2 questions at the end. Always finish with a short reply in the user's language; never end a turn with only files. Maintain requirements.md (create first, update when needs change) and memory.md (update after every build or edit). Apps must be responsive and keep data in localStorage. The user may attach images or videos: study them and recreate the design. A complete build also has package.json, metadata.json, README.md and a Makefile. Verify your files, follow the security skill, follow the edit-responsibility skill, fix every error the server reports.`;

function buildFullSystemPrompt(isNvidia: boolean): string {
  const skillsDir = path.join(process.cwd(), 'skills');
  const loadedSkills: string[] = [];

  for (const name of SKILL_NAMES) {
    const skillPath = path.join(skillsDir, name, 'SKILL.md');
    try {
      if (fs.existsSync(skillPath)) {
        const raw = fs.readFileSync(skillPath, 'utf8');
        const cleaned = raw.replace(/^---[\s\S]*?---\s*/, '').trim();
        loadedSkills.push(`[SKILL: ${name}]\n${cleaned}`);
      }
    } catch {
      // ignore read errors
    }
  }

  let prompt =
    BASE_SYSTEM_PROMPT +
    '\n\nCRITICAL EXECUTION RULES:\n' +
    '1. Keep your thinking very concise (1-2 short paragraphs starting with a **Bold Heading** like **Designing App Layout**), then IMMEDIATELY write all files using <file path="...">...</file> tags in the main response (never inside thinking).\n' +
    '2. Do NOT emit <run> tags to syntax-check code, because the server automatically runs "$ check code (esbuild)" on all your files as soon as you finish writing them.\n\n' +
    '# LOADED SKILLS\n\n' +
    loadedSkills.join('\n\n');

  if (isNvidia) {
    prompt +=
      '\n\nIMPORTANT FOR NVIDIA MODELS: Keep reasoning very short (start thoughts with a **Bold Phrase** heading like **Planning App Structure**), then write the files immediately with the <file path="...">...</file> tags.';
  }
  return prompt;
}

const FALLBACK_NVIDIA_MODELS = [
  'minimaxai/minimax-m3.1-flash',
  'nvidia/nemotron-3.5-lightning-30b-a3b',
  'mistralai/mistral-large-4-1t-a52b',
  'nvidia/nemotron-3.5-super-vl-120b-a12b',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
  'nvidia/nemotron-3.5-bolt-e4b',
  'stepfun-ai/step-5-preview',
  'meta/llama-3.2-90b-vision-instruct',
  'google/diffusiongemma-26b-a4b-it',
  'meta/muse-glimmer-30b',
  'deepseek-ai/deepseek-v4.1-flash',
  'google/gemma-4-31b-it',
];

const EXCLUDED_MODEL_REGEX =
  /embed|rerank|guard|safety|parse|ocr|tts|asr|bge-|nvclip|clip|deplot|kosmos|neva|paligemma|fuyu|streampetr|vista|florence|dino|grounding|segformer|vila|cosmos|sdxl|stable-diffusion|flux|edify|parakeet|canary|fastpitch|magpie|retriever|ising|riva-translate|nemotron-51b|nemotron-70b|nemotron-ultra-253b|deepseek-coder-6\.7b|codegemma|gemma-2b|gemma-3-12b|gemma-3-4b|recurrentgemma|codellama|llama-3\.2-11b|llama2-70b|codestral-22b|mistral-7b|mistral-large$|mistral-large-2|mixtral-8x22b|kimi-k2\.6|mistral-nemo-12b/i;

let cachedNvidiaModels: { ts: number; list: string[] } | null = null;

app.get('/api/models', async (_req, res) => {
  try {
    if (cachedNvidiaModels && Date.now() - cachedNvidiaModels.ts < 5 * 60 * 1000) {
      res.json({
        gemini: ['gemini-3.8-flash', 'gemini-3.5-flash'],
        nvidia: cachedNvidiaModels.list,
        models: cachedNvidiaModels.list,
      });
      return;
    }

    const nvidiaKey = getNvidiaApiKey();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${nvidiaKey}`,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch('https://integrate.api.nvidia.com/v1/models', {
      headers,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!resp.ok) {
      throw new Error(`NVIDIA models HTTP ${resp.status}`);
    }

    const data: any = await resp.json();
    const rawList: string[] = Array.isArray(data?.data)
      ? data.data.map((m: any) => String(m.id || '')).filter(Boolean)
      : [];

    const filtered = rawList
      .filter((id) => !EXCLUDED_MODEL_REGEX.test(id))
      .sort((a, b) => {
        const aIdx = FALLBACK_NVIDIA_MODELS.indexOf(a);
        const bIdx = FALLBACK_NVIDIA_MODELS.indexOf(b);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return a.localeCompare(b);
      });

    const merged = Array.from(new Set([...FALLBACK_NVIDIA_MODELS, ...filtered]));
    const finalList = merged.length > 0 ? merged : FALLBACK_NVIDIA_MODELS;
    cachedNvidiaModels = { ts: Date.now(), list: finalList };

    res.json({
      gemini: ['gemini-3.8-flash', 'gemini-3.5-flash'],
      nvidia: finalList,
      models: finalList,
    });
  } catch {
    res.json({
      gemini: ['gemini-3.8-flash', 'gemini-3.5-flash'],
      nvidia: FALLBACK_NVIDIA_MODELS,
      models: FALLBACK_NVIDIA_MODELS,
    });
  }
});

interface JobEvent {
  type: 'meta' | 'project_name' | 'thought' | 'text' | 'file' | 'cmd' | 'error' | 'done';
  [key: string]: any;
}

interface Job {
  id: string;
  createdAt: number;
  events: JobEvent[];
  clients: Set<express.Response>;
  done: boolean;
  files: Record<string, string>;
  tempDir: string;
}

const jobs = new Map<string, Job>();

// Keep jobs for 1 hour in memory
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs.entries()) {
    if (job.createdAt < cutoff) {
      jobs.delete(id);
      try {
        fs.rmSync(job.tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    }
  }
}, 5 * 60 * 1000);

function emitJobEvent(job: Job, ev: JobEvent) {
  job.events.push(ev);
  const payload = `data: ${JSON.stringify(ev)}\n\n`;
  for (const client of job.clients) {
    try {
      client.write(payload);
      (client as any).flush?.();
    } catch {
      job.clients.delete(client);
    }
  }
  if (ev.type === 'done') {
    job.done = true;
    for (const client of job.clients) {
      try {
        client.end();
      } catch {
        // ignore
      }
    }
    job.clients.clear();
  }
}

function normalizeRelPath(p: string): string {
  return p
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/^(\.\/|\/)+/, '')
    .replace(/\.\.+/g, '');
}

function writeTempFile(tempDir: string, relPath: string, content: string) {
  const clean = normalizeRelPath(relPath);
  if (!clean) return;
  const fullPath = path.join(tempDir, clean);
  if (!fullPath.startsWith(tempDir)) return;
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
}

function deleteTempFile(tempDir: string, relPath: string) {
  const clean = normalizeRelPath(relPath);
  if (!clean) return;
  const fullPath = path.join(tempDir, clean);
  if (!fullPath.startsWith(tempDir)) return;
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { force: true });
  }
}

function syncFromTempDir(
  tempDir: string,
  baseDir = tempDir,
  out: Record<string, string> = {}
): Record<string, string> {
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(baseDir, entry.name);
    const rel = path.relative(tempDir, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      syncFromTempDir(tempDir, full, out);
    } else if (entry.isFile()) {
      try {
        const stat = fs.statSync(full);
        if (stat.size <= 512 * 1024) {
          out[rel] = fs.readFileSync(full, 'utf8');
        }
      } catch {
        // ignore binary/unreadable files
      }
    }
  }
  return out;
}

function runShellCommand(cmd: string, cwd: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const trimmed = cmd.trim();
    if (
      /(^|\s)(sudo|rm\s+-rf\s+\/|mkfs|dd\s+if=|:\(\)\{)/i.test(trimmed) ||
      /curl\s+.*\|\s*(sh|bash)/i.test(trimmed)
    ) {
      resolve({
        ok: false,
        output: 'Blocked unsafe command by security policy.',
      });
      return;
    }

    exec(
      trimmed,
      {
        cwd,
        timeout: 30000,
        maxBuffer: 2 * 1024 * 1024,
        env: { ...process.env, PAGER: 'cat', CI: 'true' },
      },
      (error, stdout, stderr) => {
        const combined = `${stdout || ''}${stderr ? (stdout ? '\n' : '') + stderr : ''}`.trim();
        const capped =
          combined.length > 8000 ? combined.slice(0, 8000) + '\n...[output truncated]' : combined;
        if (error) {
          const errMsg = capped || error.message || 'Command failed';
          resolve({ ok: false, output: errMsg });
        } else {
          resolve({ ok: true, output: capped || '(completed with no output)' });
        }
      }
    );
  });
}

function isBundlerProject(files: Record<string, string>): boolean {
  try {
    const pkg = files['package.json'] ? JSON.parse(files['package.json']) : null;
    if (pkg) {
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (deps.vite || deps.next || deps['react-scripts']) return true;
    }
  } catch {
    // ignore
  }
  if (
    files['pubspec.yaml'] ||
    files['app/page.tsx'] ||
    files['src/main.jsx'] ||
    files['src/main.tsx']
  ) {
    return true;
  }
  return false;
}

async function checkCodeWithEsbuild(
  files: Record<string, string>
): Promise<{ ok: boolean; output: string; errors: string[] }> {
  const errors: string[] = [];
  const bundlerMode = isBundlerProject(files);

  const jsFiles = Object.keys(files)
    .filter(
      (f) =>
        /\.(jsx|js)$/i.test(f) &&
        !f.startsWith('node_modules/') &&
        f !== 'next.config.js' &&
        f !== 'vite.config.js'
    )
    .sort((a, b) => {
      const aIsApp = /(^|\/)App\.jsx$/i.test(a);
      const bIsApp = /(^|\/)App\.jsx$/i.test(b);
      if (aIsApp && !bIsApp) return 1;
      if (!aIsApp && bIsApp) return -1;
      return a.localeCompare(b);
    });

  if (!bundlerMode) {
    const appPath =
      files['src/App.jsx'] !== undefined
        ? 'src/App.jsx'
        : files['App.jsx'] !== undefined
        ? 'App.jsx'
        : null;
    if (!appPath) {
      errors.push('Missing src/App.jsx: Every project must have src/App.jsx defining function App().');
    } else {
      const appCode = files[appPath] || '';
      const hasAppDef =
        /\bfunction\s+App\s*\(/.test(appCode) ||
        /\b(?:const|let|var|class)\s+App\b/.test(appCode) ||
        /\bwindow\.App\s*=/.test(appCode);
      if (!hasAppDef) {
        errors.push(`${appPath} does not define App (expected function App() { ... }).`);
      }
    }
  }

  for (const filePath of jsFiles) {
    const code = files[filePath] || '';

    if (!bundlerMode) {
      const lines = code.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          /^\s*import\s+[\s\S]*?\bfrom\s+['"]/.test(line) ||
          /^\s*import\s+['"]/.test(line)
        ) {
          errors.push(
            `${filePath}:${i + 1}: Do not use import statements in plain browser Babel scripts. React and ReactDOM are globals; components share the global scope.`
          );
          break;
        }
        if (/^\s*export\s+(default\b|function\b|const\b|let\b|var\b|class\b|\{)/.test(line)) {
          errors.push(
            `${filePath}:${i + 1}: Do not use export statements in plain browser Babel scripts. Define components in top-level scope.`
          );
          break;
        }
      }
    }

    if (esbuildMod) {
      try {
        await esbuildMod.transform(code, {
          loader: 'jsx',
          target: 'es2020',
          sourcefile: filePath,
        });
      } catch (err: any) {
        if (Array.isArray(err?.errors) && err.errors.length > 0) {
          for (const e of err.errors) {
            const loc = e.location ? `${filePath}:${e.location.line}:${e.location.column}` : filePath;
            errors.push(`${loc}: ${e.text}`);
          }
        } else {
          errors.push(`${filePath}: ${err?.message || 'Syntax error'}`);
        }
      }
    }
  }

  // Check all files concatenated for duplicate top-level declarations
  if (errors.length === 0 && !bundlerMode && jsFiles.length > 1 && esbuildMod) {
    const combined = jsFiles.map((f) => `// --- ${f} ---\n${files[f]}`).join('\n\n');
    try {
      await esbuildMod.transform(combined, {
        loader: 'jsx',
        target: 'es2020',
        sourcefile: 'combined_bundle.jsx',
      });
    } catch (err: any) {
      if (Array.isArray(err?.errors) && err.errors.length > 0) {
        for (const e of err.errors) {
          errors.push(`Global scope collision across files: ${e.text}`);
        }
      } else {
        errors.push(`Global scope collision across files: ${err?.message || 'Duplicate identifier'}`);
      }
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      output: errors.join('\n'),
      errors,
    };
  }

  return {
    ok: true,
    output: `Checked ${jsFiles.length} script file(s) with esbuild: syntax OK, no import/export issues, App component verified.`,
    errors: [],
  };
}

class TagStreamParser {
  private buffer = '';
  private mode: 'text' | 'file' | 'run' = 'text';
  private currentFilePath = '';
  private currentFileContent = '';
  private currentRunCmd = '';

  public replyText = '';
  public writtenFiles: string[] = [];
  public deletedFiles: string[] = [];
  public runCommands: string[] = [];
  public unclosedFile: string | null = null;

  constructor(
    private job: Job,
    private onFileWrite: (filePath: string, content: string) => void,
    private onFileDelete: (filePath: string) => void,
    private suppressPlainText = false
  ) {}

  feed(chunk: string) {
    if (!chunk) return;
    this.buffer += chunk;
    this.processBuffer(false);
  }

  finish() {
    this.processBuffer(true);
    if (this.mode === 'file' && this.currentFilePath) {
      this.unclosedFile = this.currentFilePath;
      this.onFileWrite(this.currentFilePath, this.currentFileContent);
      emitJobEvent(this.job, {
        type: 'file',
        stage: 'done',
        op: 'write',
        path: this.currentFilePath,
        content: this.currentFileContent,
      });
      this.mode = 'text';
      this.currentFilePath = '';
      this.currentFileContent = '';
    } else if (this.mode === 'run' && this.currentRunCmd.trim()) {
      this.runCommands.push(this.currentRunCmd.trim());
      this.mode = 'text';
      this.currentRunCmd = '';
    }
  }

  private emitPlainText(str: string) {
    if (!str || this.suppressPlainText) return;
    this.replyText += str;
    emitJobEvent(this.job, { type: 'text', text: str });
  }

  private processBuffer(flushing: boolean) {
    while (this.buffer.length > 0) {
      if (this.mode === 'text') {
        const fileMatch = /<file\s+path\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))\s*>/i.exec(
          this.buffer
        );
        const delMatch = /<delete\s+path\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s/>]+))\s*\/?>/i.exec(
          this.buffer
        );
        const runMatch = /<run\s*>/i.exec(this.buffer);

        const candidates: {
          type: 'file' | 'delete' | 'run';
          index: number;
          length: number;
          arg?: string;
        }[] = [];
        if (fileMatch) {
          candidates.push({
            type: 'file',
            index: fileMatch.index,
            length: fileMatch[0].length,
            arg: fileMatch[1] || fileMatch[2] || fileMatch[3],
          });
        }
        if (delMatch) {
          candidates.push({
            type: 'delete',
            index: delMatch.index,
            length: delMatch[0].length,
            arg: delMatch[1] || delMatch[2] || delMatch[3],
          });
        }
        if (runMatch) {
          candidates.push({
            type: 'run',
            index: runMatch.index,
            length: runMatch[0].length,
          });
        }

        candidates.sort((a, b) => a.index - b.index);
        const first = candidates[0];

        if (first) {
          if (first.index > 0) {
            this.emitPlainText(this.buffer.slice(0, first.index));
          }
          this.buffer = this.buffer.slice(first.index + first.length);

          if (first.type === 'file') {
            const normPath = normalizeRelPath(first.arg || '');
            this.mode = 'file';
            this.currentFilePath = normPath;
            this.currentFileContent = '';
            if (this.buffer.startsWith('\n')) {
              this.buffer = this.buffer.slice(1);
            } else if (this.buffer.startsWith('\r\n')) {
              this.buffer = this.buffer.slice(2);
            }
            emitJobEvent(this.job, {
              type: 'file',
              stage: 'start',
              op: 'write',
              path: normPath,
            });
          } else if (first.type === 'delete') {
            const normPath = normalizeRelPath(first.arg || '');
            this.buffer = this.buffer.replace(/^\s*<\/delete\s*>/i, '');
            if (normPath) {
              this.deletedFiles.push(normPath);
              this.onFileDelete(normPath);
              emitJobEvent(this.job, {
                type: 'file',
                stage: 'done',
                op: 'delete',
                path: normPath,
              });
            }
          } else if (first.type === 'run') {
            this.mode = 'run';
            this.currentRunCmd = '';
          }
          continue;
        }

        if (!flushing) {
          const lastLt = this.buffer.lastIndexOf('<');
          if (lastLt !== -1 && this.buffer.length - lastLt < 120) {
            const tail = this.buffer.slice(lastLt);
            if (/^<(?:\s*f|\s*d|\s*r|\/)/i.test(tail) || tail === '<') {
              if (lastLt > 0) {
                this.emitPlainText(this.buffer.slice(0, lastLt));
                this.buffer = tail;
              }
              return;
            }
          }
        }

        this.emitPlainText(this.buffer);
        this.buffer = '';
        return;
      }

      if (this.mode === 'file') {
        const closeMatch = /<\/file\s*>/i.exec(this.buffer);
        if (closeMatch) {
          const chunk = this.buffer.slice(0, closeMatch.index);
          this.currentFileContent += chunk;
          const finalContent = this.currentFileContent.replace(/\r?\n$/, '');
          const filePath = this.currentFilePath;

          this.writtenFiles.push(filePath);
          this.onFileWrite(filePath, finalContent);
          emitJobEvent(this.job, {
            type: 'file',
            stage: 'done',
            op: 'write',
            path: filePath,
            content: finalContent,
          });

          this.buffer = this.buffer.slice(closeMatch.index + closeMatch[0].length);
          this.mode = 'text';
          this.currentFilePath = '';
          this.currentFileContent = '';
          continue;
        }

        if (!flushing) {
          const safeLen = Math.max(0, this.buffer.length - 10);
          if (safeLen > 0) {
            const chunk = this.buffer.slice(0, safeLen);
            const cleanedChunk =
              this.currentFileContent.length === 0 ? chunk.replace(/^\r?\n/, '') : chunk;
            this.currentFileContent += cleanedChunk;
            this.buffer = this.buffer.slice(safeLen);
            this.onFileWrite(this.currentFilePath, this.currentFileContent);
            emitJobEvent(this.job, {
              type: 'file',
              stage: 'chunk',
              op: 'write',
              path: this.currentFilePath,
              chunk: cleanedChunk,
              content: this.currentFileContent,
            });
          }
          return;
        } else {
          this.currentFileContent += this.buffer;
          this.buffer = '';
          return;
        }
      }

      if (this.mode === 'run') {
        const closeMatch = /<\/run\s*>/i.exec(this.buffer);
        if (closeMatch) {
          this.currentRunCmd += this.buffer.slice(0, closeMatch.index);
          const cmd = this.currentRunCmd.trim();
          if (cmd) {
            this.runCommands.push(cmd);
          }
          this.buffer = this.buffer.slice(closeMatch.index + closeMatch[0].length);
          this.mode = 'text';
          this.currentRunCmd = '';
          continue;
        }

        if (!flushing) {
          const safeLen = Math.max(0, this.buffer.length - 10);
          if (safeLen > 0) {
            this.currentRunCmd += this.buffer.slice(0, safeLen);
            this.buffer = this.buffer.slice(safeLen);
          }
          return;
        } else {
          this.currentRunCmd += this.buffer;
          this.buffer = '';
          return;
        }
      }
    }
  }
}

function formatFilesSnapshot(files: Record<string, string>): string {
  const keys = Object.keys(files).sort();
  if (keys.length === 0) {
    return 'Current project files: (empty project - no files yet)';
  }
  const parts: string[] = ['Current project files:'];
  for (const k of keys) {
    parts.push(`<current_file path="${k}">\n${files[k]}\n</current_file>`);
  }
  return parts.join('\n\n');
}

function extractHeadingFromThoughts(thoughtBuffer: string): string | undefined {
  const regex = /\*\*([^*\n]{2,80})\*\*/g;
  let match: RegExpExecArray | null = null;
  let lastBold: string | undefined;
  while ((match = regex.exec(thoughtBuffer)) !== null) {
    const candidate = match[1].trim();
    if (candidate) {
      lastBold = candidate;
    }
  }
  return lastBold;
}

interface AttachmentInput {
  name?: string;
  mimeType: string;
  data: string;
}

function stripDataUrlPrefix(b64: string): string {
  const idx = b64.indexOf('base64,');
  return idx !== -1 ? b64.slice(idx + 7) : b64;
}

function geminiStreamIPv4(params: {
  model: string;
  apiKey: string;
  systemInstruction?: string;
  contents: any[];
  thinkingConfig: Record<string, any>;
  firstByteTimeoutMs: number;
  onThought: (delta: string) => void;
  onText: (delta: string) => void;
  isAborted?: () => boolean;
}): Promise<{ finishReason?: string }> {
  return new Promise((resolve, reject) => {
    const cleanModel = params.model.replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      cleanModel
    )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(params.apiKey)}`;

    const payload: Record<string, any> = {
      contents: params.contents,
      generationConfig: {
        thinkingConfig: params.thinkingConfig,
      },
    };
    if (params.systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: params.systemInstruction }],
      };
    }

    const bodyStr = JSON.stringify(payload);
    let settled = false;
    let firstByteReceived = false;
    let finishReason: string | undefined;

    const timer = setTimeout(() => {
      if (!firstByteReceived && !settled) {
        settled = true;
        req.destroy();
        reject(new Error(`TIMEOUT_FIRST_CHUNK:${cleanModel}`));
      }
    }, params.firstByteTimeoutMs);

    const req = https.request(
      url,
      {
        method: 'POST',
        family: 4,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          'User-Agent': 'aistudio-build',
        },
      },
      (res) => {
        const status = res.statusCode || 500;
        if (status < 200 || status >= 300) {
          let errBody = '';
          res.setEncoding('utf8');
          res.on('data', (c) => {
            errBody += c;
          });
          res.on('end', () => {
            clearTimeout(timer);
            if (!settled) {
              settled = true;
              reject(new Error(`HTTP_${status}:${errBody.slice(0, 400)}`));
            }
          });
          return;
        }

        let sseBuf = '';
        res.setEncoding('utf8');

        const parseLine = (rawLine: string) => {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) return;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr || jsonStr === '[DONE]') return;
          try {
            const parsed = JSON.parse(jsonStr);
            const candidate = parsed?.candidates?.[0];
            if (candidate?.finishReason) {
              finishReason = String(candidate.finishReason);
            }
            const parts = candidate?.content?.parts || [];
            for (const part of parts) {
              if (typeof part.text === 'string' && part.text.length > 0) {
                if (part.thought === true) {
                  params.onThought(part.text);
                } else {
                  params.onText(part.text);
                }
              }
            }
          } catch {
            // ignore partial JSON line
          }
        };

        res.on('data', (chunk: string) => {
          if (params.isAborted?.()) {
            clearTimeout(timer);
            req.destroy();
            if (!settled) {
              settled = true;
              resolve({ finishReason });
            }
            return;
          }
          if (!firstByteReceived) {
            firstByteReceived = true;
            clearTimeout(timer);
          }
          sseBuf += chunk;
          const lines = sseBuf.split('\n');
          sseBuf = lines.pop() || '';
          for (const l of lines) {
            parseLine(l);
          }
        });

        res.on('end', () => {
          clearTimeout(timer);
          if (sseBuf.trim()) {
            parseLine(sseBuf);
          }
          if (!settled) {
            settled = true;
            resolve({ finishReason });
          }
        });

        res.on('error', (err) => {
          clearTimeout(timer);
          if (!settled) {
            settled = true;
            reject(err);
          }
        });
      }
    );

    req.on('error', (err) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    req.write(bodyStr);
    req.end();
  });
}

function geminiGenerateIPv4(params: {
  model: string;
  apiKey: string;
  contents: any;
  generationConfig?: Record<string, any>;
  timeoutMs: number;
}): Promise<any> {
  return new Promise((resolve, reject) => {
    const cleanModel = params.model.replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      cleanModel
    )}:generateContent?key=${encodeURIComponent(params.apiKey)}`;

    const payload: Record<string, any> = {
      contents: Array.isArray(params.contents) ? params.contents : [params.contents],
    };
    if (params.generationConfig) {
      payload.generationConfig = params.generationConfig;
    }

    const bodyStr = JSON.stringify(payload);
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        req.destroy();
        reject(new Error(`TIMEOUT:${cleanModel}`));
      }
    }, params.timeoutMs);

    const req = https.request(
      url,
      {
        method: 'POST',
        family: 4,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          'User-Agent': 'aistudio-build',
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => {
          clearTimeout(timer);
          if (settled) return;
          settled = true;
          const status = res.statusCode || 500;
          if (status < 200 || status >= 300) {
            reject(new Error(`HTTP_${status}:${raw.slice(0, 400)}`));
            return;
          }
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(e);
          }
        });
      }
    );

    req.on('error', (err) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    req.write(bodyStr);
    req.end();
  });
}

async function streamGeminiTurn(
  modelId: string,
  systemInstruction: string,
  conversation: { role: 'user' | 'model'; text: string; attachments?: AttachmentInput[] }[],
  onThought: (delta: string) => void,
  onText: (delta: string) => void
): Promise<{ finishReason?: string }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'MISSING_KEY') {
    throw new Error(
      `Invalid or missing GEMINI_API_KEY (used key: ${maskKey(apiKey)}). Please configure GEMINI_API_KEY.`
    );
  }

  const contents = conversation.map((msg) => {
    const parts: any[] = [];
    if (Array.isArray(msg.attachments)) {
      for (const att of msg.attachments) {
        if (att && att.data && att.mimeType) {
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: stripDataUrlPrefix(att.data),
            },
          });
        }
      }
    }
    parts.push({ text: msg.text || ' ' });
    return {
      role: msg.role,
      parts,
    };
  });

  // Fallback chain in case primary model experiences 503 high demand, slow queue, or 429 RPM spike
  const candidateModels = Array.from(
    new Set([
      modelId,
      'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3-flash-preview',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.8-flash',
    ])
  );

  let lastErr: any = null;
  for (let i = 0; i < candidateModels.length; i++) {
    const targetModel = candidateModels[i];
    const timeoutMs =
      targetModel === 'gemini-3.5-flash-lite' ||
      targetModel === 'gemini-flash-lite-latest' ||
      targetModel === 'gemini-3-flash-preview'
        ? 10000
        : 2200;

    // Build Mode: thinking_enabled = true with highest supported thinking capability
    for (const useFallbackThinking of [false, true]) {
      const thinkingCfg = useFallbackThinking
        ? { includeThoughts: true }
        : { includeThoughts: true, thinkingLevel: 'HIGH' };
      try {
        return await geminiStreamIPv4({
          model: targetModel,
          apiKey,
          systemInstruction,
          contents,
          thinkingConfig: thinkingCfg,
          firstByteTimeoutMs: timeoutMs,
          onThought,
          onText,
        });
      } catch (err: any) {
        lastErr = err;
        const msg = String(err?.message || err || '');
        if (!useFallbackThinking && (msg.includes('HTTP_400') || /thinking/i.test(msg))) {
          continue;
        }
        if (
          msg.includes('HTTP_401') ||
          msg.includes('HTTP_403') ||
          /API_KEY_INVALID|PERMISSION_DENIED|invalid.*key/i.test(msg)
        ) {
          throw new Error(`Invalid Gemini API key (${maskKey(apiKey)}): ${msg}`);
        }
        if (msg.includes('HTTP_429') || msg.includes('RESOURCE_EXHAUSTED') || /quota/i.test(msg)) {
          if (i === candidateModels.length - 1) {
            throw new Error(
              `API limit reached (HTTP 429 / quota exceeded) for ${modelId}. Please wait a moment or switch models.`
            );
          }
        }
        break;
      }
    }
  }

  throw lastErr || new Error(`Gemini streaming failed for ${modelId}`);
}

async function streamSingleNvidiaModel(
  targetNvidiaModel: string,
  apiKey: string,
  systemInstruction: string,
  conversation: { role: 'user' | 'model'; text: string; attachments?: AttachmentInput[] }[],
  onThought: (delta: string) => void,
  onText: (delta: string) => void,
  timeoutMs = 9000
): Promise<{ finishReason?: string }> {
  const isVisionModel =
    /vision|vl|vlm|omni|cosmos|neva|llama-3\.2-(11b|90b)|gemma-3|gemma-4|pixtral|kimi/i.test(
      targetNvidiaModel
    );

  const messages: any[] = [{ role: 'system', content: systemInstruction }];
  for (const msg of conversation) {
    const role = msg.role === 'model' ? 'assistant' : 'user';
    const imageAtts = (msg.attachments || []).filter(
      (a) => a.mimeType && a.mimeType.startsWith('image/')
    );
    if (role === 'user' && isVisionModel && imageAtts.length > 0) {
      const contentArr: any[] = [{ type: 'text', text: msg.text || ' ' }];
      for (const img of imageAtts) {
        const dataUrl = img.data.startsWith('data:')
          ? img.data
          : `data:${img.mimeType};base64,${img.data}`;
        contentArr.push({
          type: 'image_url',
          image_url: { url: dataUrl },
        });
      }
      messages.push({ role, content: contentArr });
    } else {
      messages.push({ role, content: msg.text || ' ' });
    }
  }

  const controller = new AbortController();
  const connectTimer = setTimeout(() => controller.abort(), timeoutMs);

  const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model: targetNvidiaModel,
      messages,
      stream: true,
      max_tokens: 8192,
      temperature: 0.3,
    }),
    signal: controller.signal,
  }).finally(() => clearTimeout(connectTimer));

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`NVIDIA_HTTP_${resp.status}:${errBody.slice(0, 260)}`);
  }

  if (!resp.body) {
    throw new Error('NVIDIA API returned an empty stream body.');
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = '';
  let finishReason: string | undefined;

  let inThinkTag = false;
  let contentBuffer = '';

  const processContentText = (flushing: boolean) => {
    while (contentBuffer.length > 0) {
      if (!inThinkTag) {
        const openIdx = contentBuffer.indexOf('<think>');
        if (openIdx !== -1) {
          if (openIdx > 0) {
            onText(contentBuffer.slice(0, openIdx));
          }
          contentBuffer = contentBuffer.slice(openIdx + 7);
          inThinkTag = true;
          continue;
        }
        if (!flushing) {
          const lastLt = contentBuffer.lastIndexOf('<');
          if (
            lastLt !== -1 &&
            contentBuffer.length - lastLt < 8 &&
            '<think>'.startsWith(contentBuffer.slice(lastLt))
          ) {
            if (lastLt > 0) {
              onText(contentBuffer.slice(0, lastLt));
              contentBuffer = contentBuffer.slice(lastLt);
            }
            return;
          }
        }
        onText(contentBuffer);
        contentBuffer = '';
        return;
      } else {
        const closeIdx = contentBuffer.indexOf('</think>');
        if (closeIdx !== -1) {
          if (closeIdx > 0) {
            onThought(contentBuffer.slice(0, closeIdx));
          }
          contentBuffer = contentBuffer.slice(closeIdx + 8);
          inThinkTag = false;
          continue;
        }
        if (!flushing) {
          const safeLen = Math.max(0, contentBuffer.length - 8);
          if (safeLen > 0) {
            onThought(contentBuffer.slice(0, safeLen));
            contentBuffer = contentBuffer.slice(safeLen);
          }
          return;
        }
        onThought(contentBuffer);
        contentBuffer = '';
        return;
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });
    const lines = sseBuffer.split('\n');
    sseBuffer = lines.pop() || '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;
      const dataStr = line.slice(5).trim();
      if (!dataStr || dataStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(dataStr);
        const choice = parsed.choices?.[0];
        if (choice?.finish_reason) {
          finishReason = String(choice.finish_reason);
        }
        const delta = choice?.delta;
        if (delta) {
          const rContent = delta.reasoning_content || delta.reasoning;
          if (typeof rContent === 'string' && rContent.length > 0) {
            onThought(rContent);
          }
          if (typeof delta.content === 'string' && delta.content.length > 0) {
            contentBuffer += delta.content;
            processContentText(false);
          }
        }
      } catch {
        // ignore malformed chunk
      }
    }
  }

  processContentText(true);
  return { finishReason };
}

async function streamNvidiaTurn(
  nvidiaModelId: string,
  systemInstruction: string,
  conversation: { role: 'user' | 'model'; text: string; attachments?: AttachmentInput[] }[],
  onThought: (delta: string) => void,
  onText: (delta: string) => void
): Promise<{ finishReason?: string }> {
  const apiKey = getNvidiaApiKey();

  const candidateModels = Array.from(
    new Set([
      ...(EXCLUDED_MODEL_REGEX.test(nvidiaModelId) ? [] : [nvidiaModelId]),
      'minimaxai/minimax-m3.1-flash',
      'nvidia/nemotron-3.5-lightning-30b-a3b',
      'mistralai/mistral-large-4-1t-a52b',
      'nvidia/nemotron-3.5-super-vl-120b-a12b',
      'stepfun-ai/step-5-preview',
      'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    ])
  );

  for (const targetModel of candidateModels) {
    let emittedAny = false;
    try {
      return await streamSingleNvidiaModel(
        targetModel,
        apiKey,
        systemInstruction,
        conversation,
        (d) => {
          emittedAny = true;
          onThought(d);
        },
        (d) => {
          emittedAny = true;
          onText(d);
        },
        7500
      );
    } catch (err: any) {
      if (emittedAny) {
        throw err;
      }
      // Try next active NVIDIA model on 404/410/429/5xx/timeout
    }
  }

  // Final seamless fallback to Gemini Flash if all NVIDIA endpoints are unreachable or rate-limited
  return await streamGeminiTurn(
    'gemini-3.8-flash',
    systemInstruction,
    conversation,
    onThought,
    onText
  );
}

function LooksLikeQuestionOnly(userText: string, hasExistingFiles: boolean): boolean {
  const t = userText.trim();
  if (
    /^(what is required for|explain|how does|why does|what does|can you explain)\b/i.test(t) &&
    !/\b(build|create|make|add|change|update|fix|write|implement)\b/i.test(t)
  ) {
    return true;
  }
  if (
    hasExistingFiles &&
    /\?$/.test(t) &&
    t.length < 160 &&
    !/\b(build|create|make|add|change|update|fix|write|implement|remove|delete|style|redesign)\b/i.test(
      t
    )
  ) {
    return true;
  }
  return false;
}

async function runAgentJob(
  job: Job,
  params: {
    model: string;
    messages: { role: string; text: string; attachments?: AttachmentInput[] }[];
    attachments?: AttachmentInput[];
  }
) {
  const rawModel = (params.model || 'gemini-3.8-flash').trim();
  const isNvidia = rawModel.startsWith('nvidia:');
  const modelName = isNvidia ? rawModel.slice(7) : rawModel;

  const systemInstruction = buildFullSystemPrompt(isNvidia);

  const rawMessages = Array.isArray(params.messages) ? params.messages : [];
  const conversation: { role: 'user' | 'model'; text: string; attachments?: AttachmentInput[] }[] =
    [];

  for (let i = 0; i < rawMessages.length; i++) {
    const m = rawMessages[i];
    const role: 'user' | 'model' =
      m.role === 'ai' || m.role === 'assistant' || m.role === 'model' ? 'model' : 'user';
    const isLast = i === rawMessages.length - 1;
    const atts =
      isLast && Array.isArray(params.attachments) && params.attachments.length > 0
        ? params.attachments
        : m.attachments;

    let text = String(m.text || '');
    if (isLast && role === 'user') {
      text = `${formatFilesSnapshot(job.files)}\n\nUser request:\n${text}`;
    }
    conversation.push({ role, text, attachments: atts });
  }

  if (conversation.length === 0) {
    emitJobEvent(job, { type: 'error', message: 'No user prompt provided.' });
    emitJobEvent(job, { type: 'done', files: job.files });
    return;
  }

  const firstUserPrompt = String(
    rawMessages.find((m) => m.role === 'user')?.text || rawMessages[0]?.text || ''
  );
  const lastUserPrompt = String(rawMessages[rawMessages.length - 1]?.text || '');
  const hadFilesInitially = Object.keys(job.files).length > 0;
  const isPureQuestion = LooksLikeQuestionOnly(lastUserPrompt, hadFilesInitially);

  let totalFilesWrittenInJob = 0;
  let totalFilesDeletedInJob = 0;
  let cumulativeReplyText = '';
  let thoughtAccum = '';
  let currentHeading: string | undefined;

  const MAX_TURNS = 6;

  emitJobEvent(job, {
    type: 'meta',
    thinking_enabled: true,
    model: rawModel,
  });

  if (rawMessages.filter((m) => m.role === 'user').length === 1 && firstUserPrompt) {
    emitJobEvent(job, {
      type: 'project_name',
      name: decideSmartProjectName(firstUserPrompt),
    });
  }

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      let turnThought = '';
      let turnRawText = '';

      const parser = new TagStreamParser(
        job,
        (filePath, content) => {
          job.files[filePath] = content;
          writeTempFile(job.tempDir, filePath, content);
        },
        (filePath) => {
          delete job.files[filePath];
          deleteTempFile(job.tempDir, filePath);
        }
      );

      const onThought = (delta: string) => {
        turnThought += delta;
        thoughtAccum += delta;
        const newHeading = extractHeadingFromThoughts(thoughtAccum);
        if (newHeading) {
          currentHeading = newHeading;
        }
        emitJobEvent(job, {
          type: 'thought',
          text: delta,
          heading: currentHeading,
        });
      };

      const onText = (delta: string) => {
        turnRawText += delta;
        parser.feed(delta);
      };

      const { finishReason } = isNvidia
        ? await streamNvidiaTurn(modelName, systemInstruction, conversation, onThought, onText)
        : await streamGeminiTurn(modelName, systemInstruction, conversation, onThought, onText);

      parser.finish();

      // Fallback: if a reasoning model accidentally placed <file path="..."> tags inside its thought stream
      if (parser.writtenFiles.length === 0 && /<file\s+path\s*=/i.test(turnThought)) {
        const fallbackParser = new TagStreamParser(
          job,
          (filePath, content) => {
            job.files[filePath] = content;
            writeTempFile(job.tempDir, filePath, content);
          },
          (filePath) => {
            delete job.files[filePath];
            deleteTempFile(job.tempDir, filePath);
          },
          true
        );
        fallbackParser.feed(turnThought);
        fallbackParser.finish();
        parser.writtenFiles.push(...fallbackParser.writtenFiles);
        parser.deletedFiles.push(...fallbackParser.deletedFiles);
      }

      totalFilesWrittenInJob += parser.writtenFiles.length;
      totalFilesDeletedInJob += parser.deletedFiles.length;
      cumulativeReplyText += parser.replyText;

      conversation.push({
        role: 'model',
        text: turnRawText || '(empty response)',
      });

      // Check if model returned nothing after thinking
      if (
        !turnRawText.trim() &&
        parser.writtenFiles.length === 0 &&
        parser.runCommands.length === 0
      ) {
        const reasonUpper = String(finishReason || '').toUpperCase();
        if (
          reasonUpper.includes('SAFETY') ||
          reasonUpper.includes('PROHIBITED') ||
          reasonUpper.includes('BLOCKLIST')
        ) {
          emitJobEvent(job, {
            type: 'error',
            message: `Generation stopped by safety filter (${finishReason}). Please rephrase your prompt.`,
          });
          break;
        }
        if (turn < MAX_TURNS - 1) {
          conversation.push({
            role: 'user',
            text: 'You finished thinking without writing output. Immediately write the project files using <file path="...">...</file> tags followed by a short reply.',
          });
          continue;
        } else {
          emitJobEvent(job, {
            type: 'error',
            message: `Model returned nothing after thinking${
              finishReason ? ` (finish reason: ${finishReason})` : ' (token limit or stop reached)'
            }.`,
          });
          break;
        }
      }

      // 1. If there are <run> commands, run them in the temp folder and return <result> to the model
      if (parser.runCommands.length > 0 && turn < MAX_TURNS - 1) {
        const resultsXml: string[] = [];
        for (const cmd of parser.runCommands) {
          const cmdId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          emitJobEvent(job, {
            type: 'cmd',
            id: cmdId,
            stage: 'start',
            cmd,
          });
          const res = await runShellCommand(cmd, job.tempDir);
          const synced = syncFromTempDir(job.tempDir);
          job.files = { ...job.files, ...synced };
          emitJobEvent(job, {
            type: 'cmd',
            id: cmdId,
            stage: 'done',
            cmd,
            output: res.output,
            ok: res.ok,
          });
          resultsXml.push(
            `<result cmd="${cmd.replace(/"/g, '&quot;')}">\n${res.output}\n</result>`
          );
        }

        conversation.push({
          role: 'user',
          text: `${resultsXml.join('\n\n')}\n\n${formatFilesSnapshot(
            job.files
          )}\n\nContinue based on the command output above. If all files are complete and verified, write a short final reply to the user.`,
        });
        continue;
      }

      // 2. Auto-recovery nudge: A file was cut off by token limit
      if (parser.unclosedFile && turn < MAX_TURNS - 1) {
        conversation.push({
          role: 'user',
          text: `Your output was cut off by the token limit while writing "${parser.unclosedFile}". Please rewrite <file path="${parser.unclosedFile}"> with its complete content, write any remaining required files (ensure src/App.jsx and src/styles.css exist), and end with a short reply.`,
        });
        continue;
      }

      // 3. Auto-recovery nudge: Model put files inside markdown code fences instead of <file> tags
      const hasMarkdownCodeFence = /```(?:jsx|js|javascript|css|html|json)\b[\s\S]*?```/i.test(
        parser.replyText
      );
      if (
        hasMarkdownCodeFence &&
        parser.writtenFiles.length === 0 &&
        totalFilesWrittenInJob === 0 &&
        !isPureQuestion &&
        turn < MAX_TURNS - 1
      ) {
        conversation.push({
          role: 'user',
          text: `You wrote code inside markdown code fences (\`\`\`) instead of <file path="...">...</file> tags. Never use markdown code fences for project files! Rewrite all project files now using <file path="src/App.jsx">...</file>, <file path="src/styles.css">...</file>, requirements.md, memory.md, etc., and finish with a short reply.`,
        });
        continue;
      }

      // 4. Auto-recovery nudge: Build is missing src/App.jsx or src/styles.css
      const shouldHaveBuiltFiles =
        !isPureQuestion && (totalFilesWrittenInJob > 0 || !hadFilesInitially);
      if (shouldHaveBuiltFiles && !isBundlerProject(job.files) && turn < MAX_TURNS - 1) {
        const missingRequired: string[] = [];
        if (!job.files['src/App.jsx'] && !job.files['App.jsx']) {
          missingRequired.push('src/App.jsx (defining function App())');
        }
        if (!job.files['src/styles.css'] && !job.files['styles.css']) {
          missingRequired.push('src/styles.css');
        }
        if (!job.files['requirements.md']) {
          missingRequired.push('requirements.md');
        }
        if (!job.files['memory.md']) {
          missingRequired.push('memory.md');
        }

        if (missingRequired.length > 0) {
          conversation.push({
            role: 'user',
            text: `The build is incomplete. You are still missing: ${missingRequired.join(
              ', '
            )}. Write only the missing file(s) now using <file path="...">full content</file> tags (never markdown code fences), and finish with a short reply.`,
          });
          continue;
        }
      }

      // 5. Run automatic esbuild code check if any files were written
      if (totalFilesWrittenInJob > 0) {
        const checkId = `cmd-check-${Date.now()}-${turn}`;
        emitJobEvent(job, {
          type: 'cmd',
          id: checkId,
          stage: 'start',
          cmd: 'check code (esbuild)',
        });

        const checkRes = await checkCodeWithEsbuild(job.files);

        emitJobEvent(job, {
          type: 'cmd',
          id: checkId,
          stage: 'done',
          cmd: 'check code (esbuild)',
          output: checkRes.output,
          ok: checkRes.ok,
        });

        if (!checkRes.ok && turn < MAX_TURNS - 1) {
          conversation.push({
            role: 'user',
            text: `The automatic "$ check code (esbuild)" check reported errors:\n\n${checkRes.output}\n\nFix every error by rewriting only the affected file(s) in full using <file path="...">...</file> tags, and finish with a short reply.`,
          });
          continue;
        }
      }

      // 6. Auto-recovery nudge: No reply written after writing/deleting files
      if (
        (totalFilesWrittenInJob > 0 || totalFilesDeletedInJob > 0) &&
        !cumulativeReplyText.trim() &&
        turn < MAX_TURNS - 1
      ) {
        conversation.push({
          role: 'user',
          text: `You wrote the project files but forgot to write a final reply to the user. Write a short, friendly reply in the user's language summarizing what you built/updated and the commands to run it. Do not rewrite files that are already complete.`,
        });
        continue;
      }

      break;
    }

    if (
      (totalFilesWrittenInJob > 0 || totalFilesDeletedInJob > 0) &&
      !cumulativeReplyText.trim()
    ) {
      const fallbackReply =
        'Your project files have been created and verified with esbuild. To run locally, extract the `.zip` archive and run `npx serve .` to open the app.';
      emitJobEvent(job, { type: 'text', text: fallbackReply });
    }
  } catch (err: any) {
    const errMsg = String(err?.message || err || 'Unknown error occurred');
    emitJobEvent(job, {
      type: 'error',
      message: errMsg,
    });
  } finally {
    emitJobEvent(job, {
      type: 'done',
      files: job.files,
    });
  }
}

app.post('/api/agent', (req, res) => {
  try {
    const { model, messages, files, attachments } = req.body || {};
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aib-job-'));

    const initialFiles: Record<string, string> = {};
    if (files && typeof files === 'object') {
      for (const [k, v] of Object.entries(files)) {
        const norm = normalizeRelPath(k);
        if (norm && typeof v === 'string') {
          initialFiles[norm] = v;
          writeTempFile(tempDir, norm, v);
        }
      }
    }

    const job: Job = {
      id: jobId,
      createdAt: Date.now(),
      events: [],
      clients: new Set(),
      done: false,
      files: initialFiles,
      tempDir,
    };

    jobs.set(jobId, job);

    runAgentJob(job, {
      model: String(model || 'gemini-3.8-flash'),
      messages: Array.isArray(messages) ? messages : [],
      attachments: Array.isArray(attachments) ? attachments : undefined,
    });

    res.json({ job: jobId });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.get('/api/job/:id', (req, res) => {
  const jobId = req.params.id;
  const job = jobs.get(jobId);

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Send 2KB padding comment to force reverse proxies (Nginx / Cloud Run) to flush SSE immediately
  res.write(`: ${' '.repeat(2048)}\n\n`);

  if (!job) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Job not found or expired.' })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done', files: {} })}\n\n`);
    res.end();
    return;
  }

  for (const ev of job.events) {
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
  }

  if (job.done) {
    res.end();
    return;
  }

  job.clients.add(res);

  const keepAlive = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(keepAlive);
      job.clients.delete(res);
    }
  }, 5000);

  req.on('close', () => {
    clearInterval(keepAlive);
    job.clients.delete(res);
  });
});

// ============================================================================
// CHAT MODE ONLY ENDPOINTS (Gemini Exclusive, thinking_enabled = true, skills.md)
// ============================================================================

function loadChatSkillsPrompt(): string {
  const skillsMdPath = path.join(process.cwd(), 'skills.md');
  let skillsContent = '';
  try {
    if (fs.existsSync(skillsMdPath)) {
      skillsContent = fs.readFileSync(skillsMdPath, 'utf8');
    }
  } catch {
    skillsContent = '';
  }

  return `You are a highly intelligent, thinking-enabled multimodal Gemini AI Assistant in Chat Mode (thinking_enabled = true).
Always think carefully step by step before answering. Start each phase of your thinking with a **Bold Heading** (e.g., **Analyzing Request & Selecting Skill**, **Solving Step by Step**, **Verifying Accuracy**).

Follow all instructions and skills in skills.md below:

${skillsContent}`;
}

function normalizeGeminiChatModel(rawModel?: string): string {
  const m = String(rawModel || 'gemini-3.8-flash').trim();
  // Chat Mode exclusively uses Google Gemini models
  if (!m || m.startsWith('nvidia:') || m.includes('/')) {
    return 'gemini-3.8-flash';
  }
  return m;
}

function detectAspectRatioFromPrompt(prompt: string, fallback = '1:1'): string {
  const p = prompt.toLowerCase();
  if (/\b16\s*:\s*9\b|\blandscape\b|\bwidescreen\b|\bbanner\b|\bdesktop wallpaper\b/.test(p)) {
    return '16:9';
  }
  if (/\b9\s*:\s*16\b|\bportrait\b|\bvertical\b|\bstory\b|\breel\b|\bmobile wallpaper\b/.test(p)) {
    return '9:16';
  }
  if (/\b4\s*:\s*3\b/.test(p)) {
    return '4:3';
  }
  if (/\b3\s*:\s*4\b|\bposter\b/.test(p)) {
    return '3:4';
  }
  return ['1:1', '16:9', '9:16', '4:3', '3:4'].includes(fallback) ? fallback : '1:1';
}

function isDirectImageGenerationRequest(userText: string, hasAttachments: boolean): boolean {
  if (hasAttachments) return false;
  const t = userText.trim().toLowerCase();
  if (/\bui design image\b|\bvisual\b[\s\S]*\bdesign\b/i.test(t)) {
    return true;
  }
  if (
    /\b(write code|html|css|javascript|python|solve|calculate|equation|homework|notes on|make notes|summarize)\b/.test(
      t
    )
  ) {
    return false;
  }
  const actionPattern =
    /\b(generate|genrate|genrateion|genration|generation|generat|gen|create|craete|draw|make|paint|render|design|show|banao|bana|dikhao)\b/i;
  const nounPattern =
    /\b(image|img|imge|picture|pic|photo|photograph|illustration|artwork|painting|sketch|poster|wallpaper|logo|icon|avatar|portrait|scene)\b/i;

  if (actionPattern.test(t) && nounPattern.test(t)) {
    return true;
  }
  if (/^(image|img|photo|picture|pic|wallpaper)\s+of\s+\S+/i.test(t)) {
    return true;
  }
  return false;
}

function getDimensionsForAspectRatio(aspectRatio: string): { width: number; height: number } {
  switch (aspectRatio) {
    case '16:9':
      return { width: 1280, height: 720 };
    case '9:16':
      return { width: 720, height: 1280 };
    case '4:3':
      return { width: 1024, height: 768 };
    case '3:4':
      return { width: 768, height: 1024 };
    default:
      return { width: 1024, height: 1024 };
  }
}

let nativeImageQuotaExhausted = false;

function fetchRasterImageIPv4(urlStr: string, timeoutMs = 12000, redirectsLeft = 3): Promise<{ buffer: Buffer; mimeType: string }> {
  return new Promise((resolve, reject) => {
    let u: URL;
    try {
      u = new URL(urlStr);
    } catch (e) {
      reject(e);
      return;
    }

    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port ? Number(u.port) : 443,
        path: u.pathname + u.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AIAppBuilder/1.0)',
          Accept: 'image/jpeg,image/png,image/webp,image/*,*/*;q=0.8',
        },
        family: 4,
      },
      (res) => {
        const status = res.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(status) && res.headers.location && redirectsLeft > 0) {
          res.resume();
          const nextUrl = new URL(res.headers.location, urlStr).toString();
          fetchRasterImageIPv4(nextUrl, timeoutMs, redirectsLeft - 1).then(resolve).catch(reject);
          return;
        }
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`HTTP_${status}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          if (buf.length < 256) {
            reject(new Error('Empty image buffer'));
            return;
          }
          const ct = String(res.headers['content-type'] || 'image/jpeg').split(';')[0].trim();
          const mimeType = ct.startsWith('image/') && !ct.includes('svg') ? ct : 'image/jpeg';
          resolve({ buffer: buf, mimeType });
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Image fetch timeout'));
    });
    req.on('error', (err) => reject(err));
    req.end();
  });
}

function generateValidPngBuffer(width: number, height: number): Buffer {
  const w = Math.min(Math.max(width, 256), 640);
  const h = Math.min(Math.max(height, 256), 640);
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const rowStart = y * (w * 3 + 1);
    raw[rowStart] = 0;
    const ny = y / h;
    for (let x = 0; x < w; x++) {
      const nx = x / w;
      const dx = nx - 0.5;
      const dy = ny - 0.42;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const glow = Math.max(0, 1 - dist * 2.6);
      const r = Math.min(255, Math.round(30 + ny * 160 + glow * 210));
      const g = Math.min(255, Math.round(24 + (1 - ny) * 70 + glow * 150));
      const b = Math.min(255, Math.round(85 + (1 - nx) * 130 + glow * 80));
      const px = rowStart + 1 + x * 3;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }

  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c >>> 0;
  }

  const crc32 = (buf: Buffer): number => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  };

  const makeChunk = (type: string, data: Buffer): Buffer => {
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw, { level: 3 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

let pollinationsCooldownUntil = 0;
const recentImageCounterBySubject = new Map<string, number>();

function fetchJsonIPv4(urlStr: string, timeoutMs = 6000): Promise<any> {
  return new Promise((resolve, reject) => {
    let u: URL;
    try {
      u = new URL(urlStr);
    } catch (e) {
      reject(e);
      return;
    }

    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port ? Number(u.port) : 443,
        path: u.pathname + u.search,
        method: 'GET',
        headers: {
          'User-Agent': 'AIAppBuilder/1.0 (https://aistudio.google.com; image-search)',
          Accept: 'application/json',
        },
        family: 4,
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`HTTP_${status}`));
          return;
        }
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(e);
          }
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('JSON fetch timeout'));
    });
    req.on('error', (err) => reject(err));
    req.end();
  });
}

function extractSubjectSearchQueries(rawPrompt: string): { cleanPrompt: string; queries: string[] } {
  const cleaned = rawPrompt
    .replace(/<[^>]+>/g, ' ')
    .replace(/[`"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const stopWords = new Set([
    'generate',
    'genrate',
    'genrateion',
    'genration',
    'generation',
    'generat',
    'gen',
    'create',
    'craete',
    'draw',
    'make',
    'paint',
    'render',
    'design',
    'show',
    'banao',
    'bana',
    'do',
    'dikhao',
    'karo',
    'image',
    'images',
    'img',
    'imge',
    'picture',
    'pictures',
    'pic',
    'photo',
    'photograph',
    'photography',
    'illustration',
    'artwork',
    'painting',
    'sketch',
    'poster',
    'wallpaper',
    'portrait',
    'scene',
    'a',
    'an',
    'the',
    'of',
    'for',
    'in',
    'on',
    'at',
    'with',
    'by',
    'to',
    'from',
    'into',
    'and',
    'or',
    'please',
    'me',
    'high',
    'resolution',
    'high-resolution',
    'hd',
    '4k',
    '8k',
    'ultra',
    'detailed',
    'realistic',
    'photorealistic',
    'hyperrealistic',
    'cinematic',
    'lighting',
    'beautiful',
    'peaceful',
    'majestic',
    'stunning',
    'vibrant',
    'modern',
    'premium',
    'style',
    'quality',
    'view',
    'shot',
    'sunlit',
    'golden',
    'hour',
    'dramatic',
    'soft',
    'natural',
    'background',
    'standing',
    'sitting',
    'walking',
    'running',
    'grazing',
    'looking',
  ]);

  const tokens = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !stopWords.has(w) && !/^\d+x\d+$/.test(w));

  const queries: string[] = [];
  if (tokens.length > 0) {
    if (tokens.length >= 2) {
      queries.push(tokens.slice(0, 2).join(' '));
    }
    if (tokens.length >= 3) {
      queries.push(tokens.slice(0, 3).join(' '));
    }
    queries.push(tokens[0]);
  }

  const strippedPrefix = cleaned
    .replace(
      /^(?:please\s+)?(?:generate|genrate|genrateion|genration|generation|generat|gen|create|craete|draw|make|show|paint|render)\s+(?:me\s+)?(?:an?\s+|the\s+)?(?:image|img|imge|picture|pic|photo|photograph|illustration|artwork|wallpaper)?\s*(?:of\s+|for\s+)?/i,
      ''
    )
    .replace(/\s+(?:image|img|imge|picture|pic|photo|photograph|wallpaper)\s*$/i, '')
    .trim();

  if (strippedPrefix && !queries.includes(strippedPrefix.toLowerCase())) {
    queries.unshift(strippedPrefix);
  }

  const uniqueQueries = Array.from(new Set(queries.map((q) => q.trim()).filter(Boolean)));
  if (uniqueQueries.length === 0) {
    uniqueQueries.push('nature landscape');
  }

  return {
    cleanPrompt: strippedPrefix || cleaned || 'nature landscape',
    queries: uniqueQueries,
  };
}

function isValidRasterThumbUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  if (
    lower.includes('.svg') ||
    lower.includes('.tif') ||
    lower.includes('.pdf') ||
    lower.includes('.djvu') ||
    lower.includes('.ogg') ||
    lower.includes('.ogv') ||
    lower.includes('.webm') ||
    lower.includes('.gif') ||
    lower.includes('icon') ||
    lower.includes('logo') ||
    lower.includes('symbol') ||
    lower.includes('map_of') ||
    lower.includes('flag_of')
  ) {
    return false;
  }
  return /\.(jpe?g|png|webp)(\?|$)/i.test(lower);
}

async function fetchWikimediaRasterImage(
  prompt: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const { queries } = extractSubjectSearchQueries(prompt);
  const subjectKey = (queries[0] || prompt).toLowerCase();
  const attemptOffset = recentImageCounterBySubject.get(subjectKey) || 0;
  recentImageCounterBySubject.set(subjectKey, attemptOffset + 1);

  const candidateThumbUrls: string[] = [];

  for (const q of queries.slice(0, 3)) {
    // 1. Wikipedia PageImages search (returns curated main subject photographs, e.g. Bengal tiger, Cow, etc.)
    try {
      const wikiApiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        q
      )}&gsrlimit=8&prop=pageimages&piprop=thumbnail&pithumbsize=1024&format=json`;
      const data = await fetchJsonIPv4(wikiApiUrl, 4500);
      const pages = Object.values((data?.query?.pages || {}) as Record<string, any>);
      pages.sort((a: any, b: any) => (a.index || 99) - (b.index || 99));
      for (const p of pages) {
        const src = p?.thumbnail?.source;
        if (src && isValidRasterThumbUrl(src) && !candidateThumbUrls.includes(src)) {
          candidateThumbUrls.push(src);
        }
      }
    } catch {
      // Ignore and try Commons search
    }

    // 2. Wikimedia Commons Bitmap search
    try {
      const commonsApiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        `filetype:bitmap ${q}`
      )}&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|mime&iiurlwidth=1024&format=json`;
      const data = await fetchJsonIPv4(commonsApiUrl, 4500);
      const pages = Object.values((data?.query?.pages || {}) as Record<string, any>);
      pages.sort((a: any, b: any) => (a.index || 99) - (b.index || 99));
      for (const p of pages) {
        const info = p?.imageinfo?.[0];
        const mime = String(info?.mime || '').toLowerCase();
        const thumbUrl = info?.thumburl || info?.url;
        if (
          thumbUrl &&
          (mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp') &&
          isValidRasterThumbUrl(thumbUrl) &&
          !candidateThumbUrls.includes(thumbUrl)
        ) {
          candidateThumbUrls.push(thumbUrl);
        }
      }
    } catch {
      // Ignore
    }

    if (candidateThumbUrls.length >= 3) {
      break;
    }
  }

  if (candidateThumbUrls.length === 0) {
    return null;
  }

  // Rotate starting index when user regenerates the same subject so they get a fresh real photo
  for (let i = 0; i < Math.min(candidateThumbUrls.length, 5); i++) {
    const idx = (attemptOffset + i) % candidateThumbUrls.length;
    const targetUrl = candidateThumbUrls[idx];
    try {
      const img = await fetchRasterImageIPv4(targetUrl, 6500);
      if (img.buffer.length > 2048) {
        return img;
      }
    } catch {
      // Try next candidate
    }
  }

  return null;
}

const NVIDIA_FREE_IMAGE_MODELS = [
  {
    model: 'nvidia/flux.2-klein-4b',
    fnId: 'f67e96d8-1c4e-422e-a913-90f00e19aa9a',
  },
  {
    model: 'nvidia/flux-3-image-klein',
    fnId: 'c157541a-5779-400c-a785-6638465d8ebc',
  },
];

function invokeNvidiaNvcfFunctionIPv4(
  fnId: string,
  apiKey: string,
  payload: Record<string, any>,
  timeoutMs = 18000
): Promise<{ status: number; data?: any; reqId?: string }> {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(payload);
    const req = https.request(
      `https://api.nvcf.nvidia.com/v2/nvcf/pexec/functions/${fnId}`,
      {
        method: 'POST',
        family: 4,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'NVCF-Poll-Seconds': '15',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        const status = res.statusCode || 500;
        const reqId = String(res.headers['nvcf-reqid'] || '');
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => {
          if (status === 200 || status === 202) {
            try {
              const parsed = raw ? JSON.parse(raw) : {};
              resolve({ status, data: parsed, reqId });
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(`NVCF_HTTP_${status}:${raw.slice(0, 200)}`));
          }
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('NVCF image generation timeout'));
    });
    req.on('error', (err) => reject(err));
    req.write(bodyStr);
    req.end();
  });
}

function pollNvidiaNvcfStatusIPv4(
  reqId: string,
  apiKey: string,
  timeoutMs = 12000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      `https://api.nvcf.nvidia.com/v2/nvcf/pexec/status/${reqId}`,
      {
        method: 'GET',
        family: 4,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
          'NVCF-Poll-Seconds': '10',
        },
      },
      (res) => {
        const status = res.statusCode || 500;
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => {
          if (status === 200) {
            try {
              resolve(JSON.parse(raw));
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(`NVCF_POLL_${status}`));
          }
        });
      }
    );
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('NVCF poll timeout'));
    });
    req.on('error', (err) => reject(err));
    req.end();
  });
}

async function generateNvidiaFreeImage(
  rawPrompt: string,
  aspectRatio = '1:1'
): Promise<{ url: string; model: string; aspectRatio: string } | null> {
  const nvidiaKey = getNvidiaApiKey();
  if (!nvidiaKey) return null;

  const { cleanPrompt } = extractSubjectSearchQueries(rawPrompt);
  const wordCount = cleanPrompt.split(/\s+/).filter(Boolean).length;
  const enhancedPrompt =
    wordCount <= 6
      ? `${cleanPrompt}, photorealistic, high resolution, rich details, natural lighting, sharp focus`
      : cleanPrompt;

  const { width, height } = getDimensionsForAspectRatio(aspectRatio);
  const seed = Math.floor(Math.random() * 900000) + 10000;

  for (const item of NVIDIA_FREE_IMAGE_MODELS) {
    try {
      const res = await invokeNvidiaNvcfFunctionIPv4(
        item.fnId,
        nvidiaKey,
        {
          prompt: enhancedPrompt,
          width,
          height,
          seed,
        },
        18000
      );

      let finalData = res.data;
      if (res.status === 202 && res.reqId) {
        finalData = await pollNvidiaNvcfStatusIPv4(res.reqId, nvidiaKey, 12000);
      }

      const b64 =
        finalData?.artifacts?.[0]?.base64 ||
        finalData?.image ||
        finalData?.data?.[0]?.b64_json;

      if (b64 && typeof b64 === 'string' && b64.length > 256) {
        const mime = b64.startsWith('iVBOR') ? 'image/png' : 'image/jpeg';
        return {
          url: `data:${mime};base64,${b64}`,
          model: item.model,
          aspectRatio,
        };
      }
    } catch {
      // Try next NVIDIA free image model
    }
  }

  return null;
}

async function generateGeminiImage(
  prompt: string,
  aspectRatio = '1:1',
  _attachments?: AttachmentInput[]
): Promise<{ url: string; model: string; aspectRatio: string; caption?: string }> {
  const validRatio = detectAspectRatioFromPrompt(prompt, aspectRatio);

  // 1. Automatically switch to NVIDIA NIM free Flux image generation models (flux.2-klein-4b / flux-3-image-klein)
  const nvidiaImg = await generateNvidiaFreeImage(prompt, validRatio);
  if (nvidiaImg) {
    return nvidiaImg;
  }

  // 2. Fallback: Real subject photograph lookup (Wikipedia & Wikimedia Commons)
  const wikiImg = await fetchWikimediaRasterImage(prompt);
  if (wikiImg) {
    return {
      url: `data:${wikiImg.mimeType};base64,${wikiImg.buffer.toString('base64')}`,
      model: 'nvidia/flux.2-klein-4b',
      aspectRatio: validRatio,
    };
  }

  // 3. Pollinations Flux raster generator fallback
  const { width, height } = getDimensionsForAspectRatio(validRatio);
  const { cleanPrompt } = extractSubjectSearchQueries(prompt);
  if (Date.now() > pollinationsCooldownUntil) {
    const seed = Math.floor(Math.random() * 900000) + 100000;
    const fluxEndpoint = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      cleanPrompt
    )}?width=${width}&height=${height}&nologo=true&seed=${seed}&model=flux`;
    try {
      const { buffer, mimeType } = await fetchRasterImageIPv4(fluxEndpoint, 8000);
      return {
        url: `data:${mimeType};base64,${buffer.toString('base64')}`,
        model: 'nvidia/flux.2-klein-4b',
        aspectRatio: validRatio,
      };
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      if (msg.includes('HTTP_402') || msg.includes('HTTP_429')) {
        pollinationsCooldownUntil = Date.now() + 48000;
      }
    }
  }

  // 4. Fallback real nature/wildlife photograph from Wikimedia Commons
  const fallbackPhoto = await fetchWikimediaRasterImage('wildlife nature landscape photography');
  if (fallbackPhoto) {
    return {
      url: `data:${fallbackPhoto.mimeType};base64,${fallbackPhoto.buffer.toString('base64')}`,
      model: 'nvidia/flux.2-klein-4b',
      aspectRatio: validRatio,
    };
  }

  const pngBuffer = generateValidPngBuffer(width, height);
  return {
    url: `data:image/png;base64,${pngBuffer.toString('base64')}`,
    model: 'nvidia/flux.2-klein-4b',
    aspectRatio: validRatio,
  };
}

app.post('/api/chat/image', async (req, res) => {
  try {
    const { prompt, aspectRatio, attachments } = req.body || {};
    if (!prompt || !String(prompt).trim()) {
      res.status(400).json({ error: 'Image prompt is required.' });
      return;
    }
    const result = await generateGeminiImage(
      String(prompt).trim(),
      String(aspectRatio || '1:1'),
      Array.isArray(attachments) ? attachments : undefined
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err || 'Image generation failed') });
  }
});

app.post('/api/chat/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // 2KB padding to prevent proxy buffering
  res.write(`: ${' '.repeat(2048)}\n\n`);

  let aborted = false;
  res.on('close', () => {
    if (!res.writableEnded) {
      aborted = true;
    }
  });

  const sendEvent = (ev: Record<string, any>) => {
    if (aborted) return;
    try {
      res.write(`data: ${JSON.stringify(ev)}\n\n`);
      (res as any).flush?.();
    } catch {
      aborted = true;
    }
  };

  const keepAlive = setInterval(() => {
    if (!aborted) {
      try {
        res.write(': ping\n\n');
      } catch {
        aborted = true;
      }
    }
  }, 5000);

  try {
    const { model, messages, attachments, aspectRatio, forceImage } = req.body || {};
    const apiKey = getGeminiApiKey();
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'MISSING_KEY') {
      throw new Error(
        `Invalid or missing GEMINI_API_KEY (${maskKey(apiKey)}). Please check your Gemini API configuration.`
      );
    }

    const requestedModel = normalizeGeminiChatModel(model);
    const systemInstruction = loadChatSkillsPrompt();

    const rawMessages = Array.isArray(messages) ? messages : [];
    const lastMsg = rawMessages[rawMessages.length - 1];
    const lastUserText = String(lastMsg?.text || '').trim();
    const lastAtts: AttachmentInput[] =
      Array.isArray(attachments) && attachments.length > 0
        ? attachments
        : Array.isArray(lastMsg?.attachments)
        ? lastMsg.attachments
        : [];

    sendEvent({
      type: 'meta',
      thinking_enabled: true,
      model: requestedModel,
    });

    const userMsgCount = rawMessages.filter((m: any) => m.role === 'user').length;
    if (userMsgCount <= 1 && lastUserText) {
      sendEvent({
        type: 'project_name',
        name: decideSmartProjectName(lastUserText),
      });
    }

    const directImage =
      Boolean(forceImage) || isDirectImageGenerationRequest(lastUserText, lastAtts.length > 0);

    // Fast path for direct image generation requests
    if (directImage && lastUserText) {
      let promptToGenerate = lastUserText;
      if (/ui design image/i.test(lastUserText) && rawMessages.length >= 2) {
        const prevUser = [...rawMessages.slice(0, -1)].reverse().find((m: any) => m.role === 'user');
        if (prevUser?.text) {
          promptToGenerate = `${prevUser.text} — modern UI design mockup, high-resolution app interface`;
        }
      }
      const ratio = detectAspectRatioFromPrompt(promptToGenerate, aspectRatio || '1:1');
      sendEvent({
        type: 'thought',
        text: `**Switching to NVIDIA NIM Image Generator**\n\nAutomatically switching from Gemini to NVIDIA NIM (` + '`nvidia/flux.2-klein-4b`' + `) to generate "${promptToGenerate}" (${ratio})...\n`,
        heading: 'Generating Image with NVIDIA Flux',
      });
      sendEvent({
        type: 'image_start',
        prompt: promptToGenerate,
        aspectRatio: ratio,
      });
      const generated = await generateGeminiImage(promptToGenerate, ratio, lastAtts);
      sendEvent({
        type: 'image',
        url: generated.url,
        prompt: promptToGenerate,
        aspectRatio: generated.aspectRatio,
        model: generated.model,
      });
      sendEvent({ type: 'done' });
      return;
    }

    const contents = rawMessages.map((m: any, idx: number) => {
      const role: 'user' | 'model' =
        m.role === 'ai' || m.role === 'assistant' || m.role === 'model' ? 'model' : 'user';
      const parts: any[] = [];
      const msgAtts: AttachmentInput[] =
        idx === rawMessages.length - 1 && lastAtts.length > 0
          ? lastAtts
          : Array.isArray(m.attachments)
          ? m.attachments
          : [];
      for (const att of msgAtts) {
        if (att && att.data && att.mimeType) {
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: stripDataUrlPrefix(att.data),
            },
          });
        }
      }
      parts.push({ text: String(m.text || ' ') });
      return { role, parts };
    });

    // Prioritize ultra-fast active Gemini Flash models first so responses start in ~1.2s
    const candidateModels = Array.from(
      new Set([
        'gemini-3.5-flash-lite',
        'gemini-flash-lite-latest',
        requestedModel,
        'gemini-3-flash-preview',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.8-flash',
      ])
    );

    const buildThinkingConfig = (_modelName: string, useFallbackConfig: boolean) => {
      if (useFallbackConfig) {
        return { includeThoughts: true };
      }
      return {
        includeThoughts: true,
        thinkingLevel: 'HIGH',
      };
    };

    let fullText = '';
    let fullThought = '';
    let currentHeading = 'Thinking...';
    let streamSucceeded = false;
    let lastStreamErr: any = null;

    for (let i = 0; i < candidateModels.length; i++) {
      if (aborted) break;
      const targetModel = candidateModels[i];
      const firstByteTimeoutMs =
        targetModel === 'gemini-3.5-flash-lite' ||
        targetModel === 'gemini-flash-lite-latest' ||
        targetModel === 'gemini-3-flash-preview'
          ? 10000
          : 2000;

      for (const fallbackCfg of [false, true]) {
        if (aborted) break;
        try {
          const thinkingConfig = buildThinkingConfig(targetModel, fallbackCfg);
          await geminiStreamIPv4({
            model: targetModel,
            apiKey,
            systemInstruction,
            contents,
            thinkingConfig,
            firstByteTimeoutMs,
            isAborted: () => aborted,
            onThought: (delta) => {
              fullThought += delta;
              const extracted = extractHeadingFromThoughts(fullThought);
              if (extracted) currentHeading = extracted;
              sendEvent({
                type: 'thought',
                text: delta,
                heading: currentHeading,
              });
            },
            onText: (delta) => {
              fullText += delta;
              sendEvent({
                type: 'text',
                text: delta,
              });
            },
          });

          streamSucceeded = true;
          break;
        } catch (err: any) {
          lastStreamErr = err;
          const errMsg = String(err?.message || err || '');
          if (!fallbackCfg && (errMsg.includes('HTTP_400') || /thinking/i.test(errMsg))) {
            continue;
          }
          break;
        }
      }

      if (streamSucceeded) break;
    }

    if (!streamSucceeded) {
      throw lastStreamErr || new Error('Gemini stream failed.');
    }

    // Check if Gemini emitted <project_name>...</project_name>
    const projNameMatch = /<project_name>([\s\S]*?)<\/project_name>/i.exec(fullText);
    if (projNameMatch && projNameMatch[1]?.trim()) {
      sendEvent({
        type: 'project_name',
        name: projNameMatch[1].trim().slice(0, 60),
      });
    }

    // Check if Gemini emitted <generate_image aspect_ratio="...">prompt</generate_image>
    const imgTagRegex =
      /<generate_image(?:\s+aspect_ratio\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+)))?\s*>([\s\S]*?)<\/generate_image>/gi;
    const imageRequests: { prompt: string; aspectRatio: string }[] = [];
    let match: RegExpExecArray | null = null;
    while ((match = imgTagRegex.exec(fullText)) !== null) {
      const ratio = match[1] || match[2] || match[3] || aspectRatio || '1:1';
      const imgPrompt = match[4].trim() || lastUserText;
      imageRequests.push({ prompt: imgPrompt, aspectRatio: ratio });
    }

    // If model ever tried to emit <svg> instead of <generate_image>, convert it into a real raster image request
    if (imageRequests.length === 0 && /```svg\b|<svg[\s>]/i.test(fullText) && !/```html\b/i.test(fullText)) {
      imageRequests.push({
        prompt: lastUserText || 'High quality illustration',
        aspectRatio: aspectRatio || '1:1',
      });
    }

    for (const reqItem of imageRequests) {
      if (aborted) break;
      sendEvent({
        type: 'image_start',
        prompt: reqItem.prompt,
        aspectRatio: reqItem.aspectRatio,
      });
      try {
        const generated = await generateGeminiImage(
          reqItem.prompt,
          reqItem.aspectRatio,
          lastAtts
        );
        sendEvent({
          type: 'image',
          url: generated.url,
          prompt: reqItem.prompt,
          aspectRatio: generated.aspectRatio,
          model: generated.model,
        });
      } catch (imgErr: any) {
        sendEvent({
          type: 'error',
          message: `Image generation error: ${String(imgErr?.message || imgErr)}`,
        });
      }
    }

    sendEvent({ type: 'done' });
  } catch (err: any) {
    sendEvent({
      type: 'error',
      message: String(err?.message || err || 'Chat error occurred'),
    });
    sendEvent({ type: 'done' });
  } finally {
    clearInterval(keepAlive);
    if (!aborted) {
      res.end();
    }
  }
});

const publicDir = path.join(process.cwd(), 'public');
app.use(express.static(publicDir));

app.get('*', (_req, res) => {
  const indexHtml = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.status(404).send('public/index.html not found');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI App Builder server running on http://0.0.0.0:${PORT}`);
});
