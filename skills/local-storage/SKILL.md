---
name: local-storage
description: Apps that keep data persist it in localStorage.
---

Apps that keep data persist it in localStorage. Wrap every read/write in try/catch and render correctly when storage is empty. Pattern: lazy useState reading JSON.parse(localStorage.getItem(key)) with fallback, useEffect writing on change. Prefix keys with the app name. Friendly empty state.
