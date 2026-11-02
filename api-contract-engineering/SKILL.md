---
name: api-contract-engineering
description: Implement integrations from verified API contracts with safe server-side clients.
---
# API Contract Engineering
Read official docs, OpenAPI schemas or supplied examples. Confirm method, exact path, headers, auth, content type, required fields, response shape, pagination, errors, timeouts, retries, idempotency and webhook verification. Create a typed/validated server-side client with centralized base URL, auth, timeout and error handling. Validate untrusted inputs; normalize responses; avoid leaking tokens, personal data or raw provider errors. Privileged operations and secrets stay server-side, never in frontend bundles/localStorage/public config. Document required env vars in .env.example and README. Add tests for success, validation failure, provider error, timeout and malformed responses where practical. Never invent endpoints or silently substitute providers.
