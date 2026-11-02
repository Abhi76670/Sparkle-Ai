---
name: database-engineering
description: Plan and implement reliable database integrations, schemas and migrations.
---
# Database Engineering
Confirm provider/engine, environment, connection URL format, existing schema, relationships, access model and migration strategy. Inspect existing persistence before choosing a database. Design normalized tables/collections, constraints, indexes, timestamps, ownership and retention. Use parameterized queries/safe ORM; validate input; enforce server-side authorization; use transactions; add migrations and rollback guidance. Keep connection strings and service credentials server-side; never expose admin/service-role keys in browser. Do not drop/truncate/overwrite/migrate production data without explicit authorization and backup/rollback plan. Verify against disposable/local/test DB first and report what was tested.
