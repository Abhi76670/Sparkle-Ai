# Chat and Build model routing

- Chat Mode and Build Mode each expose independent Planner Model and Run Model controls.
- Planner choices include Gemini plus all chat-capable NVIDIA Nemotron and DeepSeek model IDs returned by the NVIDIA model catalog.
- Run choices include the available chat-capable NVIDIA catalog models and Gemini.
- NVIDIA model IDs are passed as `nvidia:<provider/model-id>` and the server strips only the UI prefix before calling NVIDIA NIM.
- NVIDIA Planner requests use `NVIDIA_API_KEY` and the NVIDIA OpenAI-compatible `/v1/chat/completions` endpoint; Gemini Planner requests use `GEMINI_API_KEY`.
- Never silently replace a selected NVIDIA Planner or Run model with Gemini. Missing keys, unavailable models, rate limits, and provider errors must be shown clearly.
- Model availability and free endpoint status can change. Use the live NVIDIA catalog where possible and do not label a model free unless the provider currently confirms it.
