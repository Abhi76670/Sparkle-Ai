---
name: payment-gateway-integration
description: Integrate payment providers safely with verified contracts, sandbox checkout and webhook validation.
---
# Payment Gateway Integration
Identify provider, official docs/API version, sandbox base URL, currency, checkout, order endpoint, payment verification, webhook events and signature algorithm before coding. Ask for base URL if absent; never infer provider from generic wording. Create orders server-side; calculate amounts server-side; use integer minor currency units; validate currency/amount; verify signatures server-side; make webhook handling idempotent; persist provider IDs and state transitions; never trust frontend success callbacks alone. Keep keys in server env and use test keys in sandbox. Never store raw card data or ask for card details. Never perform live charges in tests. Include pending/success/failure states and reconciliation guidance.
