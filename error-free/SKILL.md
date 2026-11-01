---
name: error-free
description: Write error-free browser-compiled React 18 code on the first try.
---

Write code that runs on the first try. Plain browser scripts compiled by Babel, no bundler. No import, export or require; use React.useState, React.useEffect; share data between files with window.X and read it inside functions, never at load time. All files share ONE global scope: never declare the same top-level const/let/class name in two files; prefer unique function declarations or wrap a file in an IIFE. Files load alphabetically with App.jsx last; top-level code must not use anything from a later file. Every component you use must exist with exactly that name; one component per file. Forms: always e.preventDefault() in onSubmit. Links: href="#id" with a matching id, or buttons. Wrap localStorage and JSON.parse in try/catch, guard lists with (items||[]), give every mapped element a key. JSX: close every tag and brace, one parent (or fragment), className not class, style objects. Use only React and plain browser APIs unless asked. No top-level await. Fix every error the server reports by rewriting the affected file completely.
