---
name: dependency-recovery
description: Diagnose and recover from dependency installation and package resolution failures.
---
# Dependency Recovery
1. Read the complete npm/yarn/pnpm error output before changing dependencies.
2. Identify the exact package, requested version, peer dependency or platform constraint causing the failure.
3. Check the current package.json and lockfile; preserve unrelated dependencies and scripts.
4. For ERESOLVE, try `npm install --legacy-peer-deps` only after identifying the peer conflict.
5. For ETARGET/404, replace the unavailable version with a known compatible version; do not guess a package name.
6. For native postinstall/build failures, determine whether the package is required; use a browser-compatible alternative when possible.
7. Retry installation after the correction. Do not proceed to build or claim success while install is still failing.
8. After successful installation run the actual build, typecheck and tests. Fix every reported error and rerun.
9. Never delete package.json or remove a feature/dependency merely to make the install command pass.
