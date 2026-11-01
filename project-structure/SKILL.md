---
name: project-structure
description: Clean project folder and component organization.
---

Every folder has one purpose. src/ app code: App.jsx root (loaded last), src/components/, src/hooks/, src/utils/, src/data/, src/styles.css. public/ static assets. make/ extra Makefile parts. Root: package.json, metadata.json, README.md, Makefile, requirements.md, memory.md. One component per file named after the component; split App.jsx once it passes about 150 lines. Record the structure in memory.md.
