"""HTTP API for voice cloning.

GET  /health     200 once the model is loaded, 503 while loading or after a failed load
POST /v1/clone   multipart form: voice_sample (audio file), text, optional
                 sample_transcript, optional speed. Returns the generated speech
                 as a 16-bit WAV file.
"""

from __future__ import annotations

import io
import logging
import tempfile
import threading
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from pathlib import Path

import soundfile as sf
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse, Response

from .config import Settings
from .engine import CloneRequest, Engine, EngineNotReadyError, F5Engine
from .model_store import sync_from_gcs

logger = logging.getLogger(__name__)

MIN_SPEED = 0.5
MAX_SPEED = 2.0


class ModelState:
    """Tracks background model loading so /health can report it."""

    def __init__(self) -> None:
        self.status = "loading"
        self.error: str | None = None


def _load_models(settings: Settings, engine: Engine, state: ModelState, sync: Callable[[str, Path], int]) -> None:
    try:
        if settings.model_bucket:
            count = sync(settings.model_bucket, settings.model_dir)
            logger.info("Synced %d model files from %s", count, settings.model_bucket)
        engine.load()
        state.status = "ready"
    except Exception as error:  # report any failure through /health
        logger.exception("Model loading failed")
        state.status = "failed"
        state.error = str(error)


def create_app(
    settings: Settings | None = None,
    engine: Engine | None = None,
    sync: Callable[[str, Path], int] = sync_from_gcs,
    load_in_background: bool = True,
) -> FastAPI:
    settings = settings or Settings.from_env()
    engine = engine or F5Engine(settings)
    state = ModelState()

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        # Load in the background so the server answers health checks (503) while
        # the model is copied and loaded, instead of failing to start.
        if load_in_background:
            threading.Thread(target=_load_models, args=(settings, engine, state, sync), daemon=True).start()
        else:
            _load_models(settings, engine, state, sync)
        yield

    app = FastAPI(title="EchoForge voice inference", lifespan=lifespan)

    @app.get("/health")
    def health() -> JSONResponse:
        body: dict[str, str] = {"status": state.status}
        if state.error:
            body["error"] = state.error
        return JSONResponse(body, status_code=200 if state.status == "ready" else 503)

    @app.post("/v1/clone")
    async def clone(
        voice_sample: UploadFile = File(...),
        text: str = Form(...),
        sample_transcript: str | None = Form(None),
        speed: float = Form(1.0),
    ) -> Response:
        if not engine.ready:
            raise HTTPException(status_code=503, detail="Model is still loading", headers={"Retry-After": "30"})

        text = text.strip()
        if not text:
            raise HTTPException(status_code=400, detail="text must not be empty")
        if len(text) > settings.max_text_chars:
            raise HTTPException(status_code=400, detail=f"text must be at most {settings.max_text_chars} characters")
        if not MIN_SPEED <= speed <= MAX_SPEED:
            raise HTTPException(status_code=400, detail=f"speed must be between {MIN_SPEED} and {MAX_SPEED}")
        transcript = (sample_transcript or "").strip() or None

        sample = await voice_sample.read(settings.max_sample_bytes + 1)
        if len(sample) > settings.max_sample_bytes:
            raise HTTPException(
                status_code=413, detail=f"voice_sample must be at most {settings.max_sample_bytes} bytes"
            )
        try:
            sf.info(io.BytesIO(sample))
        except Exception:
            raise HTTPException(status_code=400, detail="voice_sample is not a supported audio file") from None

        suffix = Path(voice_sample.filename or "").suffix.lower() or ".wav"
        with tempfile.TemporaryDirectory(prefix="voice-sample-") as work_dir:
            sample_path = Path(work_dir) / f"sample{suffix}"
            sample_path.write_bytes(sample)
            request = CloneRequest(sample_path=sample_path, text=text, sample_transcript=transcript, speed=speed)
            try:
                result = await run_in_threadpool(engine.clone, request)
            except EngineNotReadyError:
                raise HTTPException(status_code=503, detail="Model is still loading", headers={"Retry-After": "30"}) from None
            except Exception:
                # Log the failure, not the request text.
                logger.exception("Voice cloning failed")
                raise HTTPException(status_code=500, detail="Voice cloning failed") from None

        output = io.BytesIO()
        sf.write(output, result.audio, result.sample_rate, format="WAV", subtype="PCM_16")
        return Response(
            content=output.getvalue(),
            media_type="audio/wav",
            headers={"X-Sample-Rate": str(result.sample_rate)},
        )

    return app
