"""Shared fixtures. F5-TTS is never imported for real: the HTTP tests use a
fake engine, and the engine tests install a fake f5_tts package."""

from __future__ import annotations

import io
import sys
import threading
import types
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from voice_inference.config import Settings
from voice_inference.engine import CloneRequest, CloneResult


def wav_bytes(seconds: float = 0.5, sample_rate: int = 16000) -> bytes:
    t = np.arange(int(seconds * sample_rate)) / sample_rate
    audio = (0.3 * np.sin(2 * np.pi * 220 * t)).astype(np.float32)
    buffer = io.BytesIO()
    sf.write(buffer, audio, sample_rate, format="WAV", subtype="PCM_16")
    return buffer.getvalue()


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings.from_env({"MODEL_DIR": str(tmp_path / "models"), "MAX_SAMPLE_BYTES": "200000"})


class FakeEngine:
    """Stands in for F5Engine in the HTTP tests."""

    def __init__(self) -> None:
        self.loaded = False
        self.requests: list[CloneRequest] = []
        self.sample_existed: list[bool] = []
        self.error: Exception | None = None
        self.load_error: Exception | None = None
        self.release_load = threading.Event()
        self.release_load.set()

    @property
    def ready(self) -> bool:
        return self.loaded

    def load(self) -> None:
        self.release_load.wait(timeout=5)
        if self.load_error:
            raise self.load_error
        self.loaded = True

    def clone(self, request: CloneRequest) -> CloneResult:
        self.requests.append(request)
        self.sample_existed.append(request.sample_path.exists())
        if self.error:
            raise self.error
        return CloneResult(audio=np.zeros(2400, dtype=np.float32), sample_rate=24000)


@pytest.fixture
def engine() -> FakeEngine:
    return FakeEngine()


class FakeF5TTS:
    """Mimics f5_tts.api.F5TTS: records its arguments and returns silence."""

    instances: list[FakeF5TTS] = []

    def __init__(self, **kwargs: object) -> None:
        self.kwargs = kwargs
        self.calls: list[dict[str, object]] = []
        FakeF5TTS.instances.append(self)

    def infer(self, **kwargs: object):
        # Like F5-TTS, print the request text to stdout.
        print("gen_text", kwargs["gen_text"], "ref_text", kwargs["ref_text"])
        self.calls.append(kwargs)
        # Simulate F5-TTS caching the processed sample as a temp file.
        utils = sys.modules["f5_tts.infer.utils_infer"]
        cached = Path(str(kwargs["ref_file"])).with_suffix(".processed.wav")
        cached.write_bytes(b"processed")
        utils._ref_audio_cache["hash"] = str(cached)
        utils._ref_text_cache["hash"] = "transcribed"
        return np.ones(4800), 24000, None


@pytest.fixture
def fake_f5_tts(monkeypatch: pytest.MonkeyPatch) -> types.ModuleType:
    FakeF5TTS.instances = []
    package = types.ModuleType("f5_tts")
    api = types.ModuleType("f5_tts.api")
    api.F5TTS = FakeF5TTS
    infer = types.ModuleType("f5_tts.infer")
    utils = types.ModuleType("f5_tts.infer.utils_infer")
    utils._ref_audio_cache = {}
    utils._ref_text_cache = {}
    infer.utils_infer = utils
    package.api = api
    package.infer = infer
    torch = types.ModuleType("torch")
    torch.threads = []
    torch.set_num_threads = torch.threads.append
    utils.torch = torch  # lets tests check the thread count
    for name, module in {
        "f5_tts": package,
        "f5_tts.api": api,
        "f5_tts.infer": infer,
        "f5_tts.infer.utils_infer": utils,
        "torch": torch,
    }.items():
        monkeypatch.setitem(sys.modules, name, module)
    return utils
