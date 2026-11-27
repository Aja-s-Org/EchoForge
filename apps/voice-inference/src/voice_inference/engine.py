"""F5-TTS wrapper used by the HTTP app."""

from __future__ import annotations

import logging
import os
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

import numpy as np

from .config import Settings

logger = logging.getLogger(__name__)


class EngineNotReadyError(RuntimeError):
    """Raised when a clone is requested before the model has loaded."""


@dataclass(frozen=True)
class CloneRequest:
    sample_path: Path
    text: str
    sample_transcript: str | None = None
    speed: float = 1.0


@dataclass(frozen=True)
class CloneResult:
    audio: np.ndarray
    sample_rate: int


class Engine(Protocol):
    @property
    def ready(self) -> bool: ...

    def load(self) -> None: ...

    def clone(self, request: CloneRequest) -> CloneResult: ...


def _quiet(*_args: Any, **_kwargs: Any) -> None:
    """F5-TTS prints progress and the reference transcript; keep that out of logs."""


class F5Engine:
    """Loads F5-TTS once on CPU and runs one clone at a time.

    CPU inference uses all available cores and a lot of memory, so requests
    are serialised rather than run in parallel within one instance.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._tts: Any = None
        self._lock = threading.Lock()

    @property
    def ready(self) -> bool:
        return self._tts is not None

    def load(self) -> None:
        settings = self._settings
        for path in (settings.ckpt_file, settings.vocab_file, settings.vocoder_dir):
            if not path.exists():
                raise FileNotFoundError(f"Model file missing: {path}")

        # Whisper (used when a request has no sample transcript) is read from this
        # Hugging Face cache. Set before importing f5_tts, which imports transformers.
        os.environ["HF_HOME"] = str(settings.hf_home)

        from f5_tts.api import F5TTS

        logger.info("Loading %s from %s", settings.f5_model, settings.ckpt_file)
        self._tts = F5TTS(
            model=settings.f5_model,
            ckpt_file=str(settings.ckpt_file),
            vocab_file=str(settings.vocab_file),
            vocoder_local_path=str(settings.vocoder_dir),
            device="cpu",
        )
        logger.info("Model loaded")

    def clone(self, request: CloneRequest) -> CloneResult:
        if self._tts is None:
            raise EngineNotReadyError("Model is still loading")
        with self._lock:
            try:
                audio, sample_rate, _spectrogram = self._tts.infer(
                    ref_file=str(request.sample_path),
                    # An empty transcript makes F5-TTS transcribe the sample with Whisper.
                    ref_text=request.sample_transcript or "",
                    gen_text=request.text,
                    speed=request.speed,
                    show_info=_quiet,
                )
            finally:
                _clear_reference_caches()
        return CloneResult(audio=np.asarray(audio, dtype=np.float32), sample_rate=int(sample_rate))


def _clear_reference_caches() -> None:
    """Drop F5-TTS's per-sample caches after each request.

    f5_tts.infer.utils_infer keeps every processed reference sample (as a temp
    file it never deletes) and every Whisper transcript in module-level dicts.
    Every sample a long-running service sees is new, so those only grow.
    """
    try:
        from f5_tts.infer import utils_infer
    except ImportError:
        return

    audio_cache = getattr(utils_infer, "_ref_audio_cache", None)
    if isinstance(audio_cache, dict):
        for path in audio_cache.values():
            try:
                os.remove(path)
            except (OSError, TypeError):
                pass
        audio_cache.clear()

    text_cache = getattr(utils_infer, "_ref_text_cache", None)
    if isinstance(text_cache, dict):
        text_cache.clear()
