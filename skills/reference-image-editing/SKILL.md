---
name: reference-image-editing
description: Edit the user's uploaded image in place instead of generating an unrelated replacement.
---
# Reference Image Editing
- If an image is attached and the user asks to edit it, use that exact attachment as image-conditioning input to the image model.
- Never silently drop the reference image or route an edit through a text-only image-generation model.
- State the requested change and preserve everything else: original subject count, identity, face, expression, pose, clothes, framing, camera angle, background and lighting unless explicitly changed.
- Interpret quantities literally. “Add one girl” means exactly one new girl, not two; do not duplicate existing people.
- If the user asks to analyse, describe, read or solve something from the image, do not generate a new image.
- If the reference image cannot be passed to an editing-capable model, stop and explain the limitation instead of returning an unrelated new image.
