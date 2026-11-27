# syntax=docker/dockerfile:1
# Build from the repository root after `nx run voice-inference:docker-build`'s
# dependency has built the f5-tts wheel into dist/third_party/f5-tts/wheel.

FROM docker.io/python:3.12-slim-bookworm

# FFmpeg is used by pydub and torchcodec to decode samples; libsndfile by soundfile.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg libsndfile1 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first so code changes don't reinstall PyTorch. PyTorch comes from
# the CPU-only index (Cloud Run and Fargate have no GPU), which also keeps the
# CUDA libraries out of the image. The wheel is bind-mounted, not copied.
COPY apps/voice-inference/requirements.txt ./
RUN --mount=type=bind,source=dist/third_party/f5-tts/wheel,target=/tmp/f5-tts-wheel \
  pip install --no-cache-dir \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    -r requirements.txt /tmp/f5-tts-wheel/*.whl

COPY apps/voice-inference/src ./src

# Model files are copied from MODEL_BUCKET into MODEL_DIR at startup; nothing
# is downloaded from Hugging Face at runtime.
RUN useradd --system --uid 10001 --create-home app \
  && mkdir -p /models \
  && chown app /models
ENV PYTHONPATH=/app/src \
  PYTHONUNBUFFERED=1 \
  MODEL_DIR=/models \
  HF_HUB_OFFLINE=1 \
  PORT=8080
USER app

EXPOSE 8080
CMD ["python", "-m", "voice_inference"]
