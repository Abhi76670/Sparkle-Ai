# Framework Live Preview

- Prefer plain HTML/CSS/JS for new projects when the user did not request a framework.
- If an existing or explicitly requested project uses Vite, install its dependencies in an isolated project directory, start the real Vite dev server, wait for HTTP readiness, and render the returned preview URL in the app iframe.
- Never show a fake framework-required card as if it were a working preview.
- Show install/startup errors verbatim in a readable error state and keep source files available.
- Clean up old preview processes and temporary workspaces when a project preview is replaced or expires.
- Do not claim preview success until the server responds successfully.
