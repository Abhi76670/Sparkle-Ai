---
name: terminal-integration-verification
description: Verify integrations from the terminal using safe, contract-based checks and curl.
---
# Terminal Integration Verification
Use terminal to inspect files, dependencies, env-variable NAMES (never values), routes, build output and tests. Verify in layers: syntax/typecheck, unit tests, local server health, configured API base URL reachability, documented health/status endpoint (only if it exists), then provider sandbox operations. Use curl with exact documented method/path/headers/JSON schema. For order creation use sandbox credentials, clearly named test order, non-chargeable test flow where supported and idempotency key; verify returned order ID/status and fetch it back only if documented. Never run live payment/capture/refund or destructive DB commands without explicit authorization.
If base URL/credentials are missing, do not fabricate curl commands or claim success. Ask for base URL and have credentials set in server env; show a redacted command template and state what's unverified. Never echo secrets in output/logs/final response. Distinguish DNS, TLS, connection, 401/403, 404, 429 and 5xx. Retry only safe/idempotent requests with bounded attempts. Report exact checks and results.
