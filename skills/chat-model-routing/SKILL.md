# Chat and Build Model Routing

- Keep Planner and Run/Executor model choices separate and persist both selections.
- Gemini is the default planner and default executor. The planner currently supports Gemini models only; do not display NVIDIA models as planner choices unless an NVIDIA-compatible planner implementation is actually enabled.
- The executor may use Gemini or an explicitly selected NVIDIA NIM model. Pass the selected model unchanged from the UI to the server.
- Never silently replace a selected NVIDIA executor with Gemini. If NVIDIA_API_KEY is missing, return a clear configuration error. If the chosen NVIDIA model fails, report the provider/model error and allow the user to choose another model.
- Use model IDs returned by the NVIDIA model catalog. Do not label a model free unless the provider explicitly confirms its free-tier availability for the user's account.
- Display the active Planner and Run model in both Chat Mode and Build Mode.
