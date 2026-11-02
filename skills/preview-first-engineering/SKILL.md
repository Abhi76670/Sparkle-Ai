# Preview-first engineering

- Prefer plain HTML, CSS and JavaScript for new apps so the sandbox can render immediately.
- Never show a fake framework warning card as if it were the user's app.
- For Vite projects, start a real isolated preview workspace: write the project files, install dependencies with lifecycle scripts disabled, retry only ERESOLVE with `--legacy-peer-deps`, start Vite on loopback, and expose it through the same-origin preview proxy.
- Wait for the preview server's HTTP response before showing the iframe. Display dependency/startup errors with the actual output; do not report success early.
- Reuse/replace the previous preview for the same project and clean up stale preview processes and temporary folders.
- Keep the preview iframe sandboxed. Do not enable same-origin access for generated project code.
- Preview is not a production deployment. Run the project's real build separately before claiming build success.
