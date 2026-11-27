"""HTTP API tests with a fake engine."""

from __future__ import annotations

import io
from pathlib import Path

import pytest
import soundfile as sf
from fastapi.testclient import TestClient

from voice_inference.app import create_app

from .conftest import FakeEngine, wav_bytes


def make_client(settings, engine, sync=None, background=False) -> TestClient:
    app = create_app(settings, engine, sync=sync or (lambda *_: 0), load_in_background=background)
    return TestClient(app)


def post_clone(client: TestClient, sample: bytes | None = None, filename: str = "voice.wav", **form: str):
    data = {"text": "Hello there", **form}
    files = {"voice_sample": (filename, wav_bytes() if sample is None else sample, "audio/wav")}
    return client.post("/v1/clone", data=data, files=files)


class TestHealth:
    def test_ready_after_load(self, settings, engine):
        with make_client(settings, engine) as client:
            response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ready"}

    def test_loading_while_model_loads(self, settings, engine):
        engine.release_load.clear()
        with make_client(settings, engine, background=True) as client:
            response = client.get("/health")
            engine.release_load.set()
        assert response.status_code == 503
        assert response.json() == {"status": "loading"}

    def test_failed_load_is_reported(self, settings, engine):
        engine.load_error = FileNotFoundError("Model file missing: /models/f5-tts/model.safetensors")
        with make_client(settings, engine) as client:
            response = client.get("/health")
        assert response.status_code == 503
        assert response.json()["status"] == "failed"
        assert "model.safetensors" in response.json()["error"]

    def test_syncs_from_bucket_when_configured(self, tmp_path, engine):
        from voice_inference.config import Settings

        settings = Settings.from_env({"MODEL_DIR": str(tmp_path), "MODEL_BUCKET": "gs://models/f5"})
        calls = []
        with make_client(settings, engine, sync=lambda uri, dest: calls.append((uri, dest)) or 3) as client:
            assert client.get("/health").status_code == 200
        assert calls == [("gs://models/f5", tmp_path)]

    def test_skips_sync_without_bucket(self, settings, engine):
        calls = []
        with make_client(settings, engine, sync=lambda *args: calls.append(args) or 0):
            pass
        assert calls == []


class TestClone:
    def test_returns_wav_audio(self, settings, engine):
        with make_client(settings, engine) as client:
            response = post_clone(client, sample_transcript="This is my voice.", speed="1.25")

        assert response.status_code == 200
        assert response.headers["content-type"] == "audio/wav"
        assert response.headers["x-sample-rate"] == "24000"
        audio, sample_rate = sf.read(io.BytesIO(response.content))
        assert sample_rate == 24000
        assert len(audio) == 2400

        request = engine.requests[0]
        assert request.text == "Hello there"
        assert request.sample_transcript == "This is my voice."
        assert request.speed == 1.25

    def test_transcript_is_optional(self, settings, engine):
        with make_client(settings, engine) as client:
            assert post_clone(client).status_code == 200
            assert post_clone(client, sample_transcript="   ").status_code == 200
        assert [r.sample_transcript for r in engine.requests] == [None, None]

    def test_sample_is_on_disk_during_inference_and_removed_after(self, settings, engine):
        with make_client(settings, engine) as client:
            post_clone(client, filename="voice.flac", sample=wav_bytes())
        request = engine.requests[0]
        assert engine.sample_existed == [True]
        assert request.sample_path.suffix == ".flac"
        assert not Path(request.sample_path).exists()

    def test_trims_text(self, settings, engine):
        with make_client(settings, engine) as client:
            post_clone(client, text="  Hello  ")
        assert engine.requests[0].text == "Hello"

    @pytest.mark.parametrize(
        ("form", "status", "message"),
        [
            ({"text": "   "}, 400, "text must not be empty"),
            ({"text": "x" * 5001}, 400, "at most 5000 characters"),
            ({"speed": "0.25"}, 400, "speed must be between"),
            ({"speed": "3"}, 400, "speed must be between"),
        ],
    )
    def test_rejects_invalid_form_values(self, settings, engine, form, status, message):
        with make_client(settings, engine) as client:
            response = post_clone(client, **form)
        assert response.status_code == status
        assert message in response.json()["detail"]
        assert engine.requests == []

    def test_requires_text(self, settings, engine):
        with make_client(settings, engine) as client:
            response = client.post("/v1/clone", files={"voice_sample": ("v.wav", wav_bytes(), "audio/wav")})
        assert response.status_code == 422

    def test_rejects_oversized_sample(self, settings, engine):
        with make_client(settings, engine) as client:
            response = post_clone(client, sample=wav_bytes(seconds=10))
        assert response.status_code == 413
        assert engine.requests == []

    def test_rejects_non_audio_sample(self, settings, engine):
        with make_client(settings, engine) as client:
            response = post_clone(client, sample=b"definitely not audio")
        assert response.status_code == 400
        assert "not a supported audio file" in response.json()["detail"]

    def test_unavailable_until_model_loaded(self, settings, engine):
        engine.load_error = RuntimeError("no model")
        with make_client(settings, engine) as client:
            response = post_clone(client)
        assert response.status_code == 503
        assert response.headers["retry-after"] == "30"

    def test_hides_inference_errors(self, settings, engine):
        engine.error = RuntimeError("tensor exploded while saying Hello there")
        with make_client(settings, engine) as client:
            response = post_clone(client)
        assert response.status_code == 500
        assert response.json() == {"detail": "Voice cloning failed"}
