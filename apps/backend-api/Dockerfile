# syntax=docker/dockerfile:1

# 1. Node base image on Debian. f5-tts needs Python and PyTorch, which don't
#    install on Alpine (musl), so this is bookworm-slim rather than alpine.
FROM docker.io/node:24-bookworm-slim

# 2. Python runtime for f5-tts, plus the shared libraries its audio stack
#    loads at runtime (libsndfile for soundfile, FFmpeg for torchcodec)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv libsndfile1 ffmpeg \
  && rm -rf /var/lib/apt/lists/*

# 3. Install the f5-tts wheel that `nx run @echoforge/voice-cloning-addon:build-f5-tts`
#    builds into dist/ (backend-api:build depends on it, and docker-build on that).
#    Cloud Run and Fargate have no GPU, so PyTorch comes from the CPU-only index,
#    which also keeps the CUDA libraries out of the image.
ENV F5_TTS_VENV=/opt/f5-tts
RUN --mount=type=bind,source=dist/third_party/f5-tts/wheel,target=/tmp/f5-tts-wheel \
  python3 -m venv "$F5_TTS_VENV" \
  && "$F5_TTS_VENV/bin/pip" install --no-cache-dir \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    /tmp/f5-tts-wheel/*.whl
ENV PATH="$F5_TTS_VENV/bin:$PATH" \
  PYTHON="$F5_TTS_VENV/bin/python"

# 4. Set the working directory inside the container
WORKDIR /app

# 5. Copy the package.json that Nx auto-generates during the build
# This specific package.json only contains your production dependencies!
COPY dist/apps/backend-api/package*.json ./

# 6. Install only production dependencies to keep the image lean and secure
RUN npm ci --omit=dev

# 7. Copy the compiled NestJS application code
COPY dist/packages/storage-utils ./node_modules/@echoforge/storage-utils
COPY dist/apps/backend-api .

# 8. Expose the standard NestJS port
EXPOSE 3000

# 9. Start the API
CMD ["node", "src/main.js"]
