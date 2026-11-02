---
name: integration-discovery
description: Discover exact prerequisites before integrating payments, databases, authentication, storage or third-party APIs.
---
# Integration Discovery
Treat integrate/connect/configure/payment gateway/database/auth/webhook/API as requirements discovery before implementation. Identify provider/product, environment (sandbox/staging/production), API version, official docs/OpenAPI spec, base URL, auth method/scopes, request/response schema, webhook events/signing, allowed origins, rate limits, idempotency, data ownership and success criteria.
Ask for API base URL when absent. Ask for provider/docs or OpenAPI file if the URL alone cannot establish the contract. Secrets must be configured as server-side environment variables; never request secrets in chat, hard-code, expose in browser code, commit or print them. Use placeholders in .env.example. Payment integrations also need currency, amount source, order lifecycle, capture/refund behavior, test credentials and sandbox. Database integrations need engine/provider, connection method, schema/migrations, access rules, backups and least-privilege credentials.
If essential info is missing, ask one focused question or request minimum setup details; meanwhile implement only provider-neutral UI/interfaces or a clearly marked adapter scaffold. Never create live charges/refunds/production orders or destructive DB changes during verification without explicit authorization. Prefer sandbox and idempotent test data.
