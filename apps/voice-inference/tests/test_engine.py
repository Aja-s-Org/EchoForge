"""F5Engine tests against a fake f5_tts package."""

from __future__ import annotations

import os
from pathlib import Path

import numpy as np
import pytest

from voice_inference.config import Settings
from voice_inference.engine import CloneRequest, EngineNotReadyError, F5Engine, cpu_limit

from .conftest import FakeF5TTS


@pytest.fixture
def model_settings(tmp_path: Path) -> Settings:
    settings = Settings.from_env({"MODEL_DIR": str(tmp_path)})
    settings.ckpt_file.parent.mkdir(parents=True)
    settings.ckpt_file.write_bytes(b"weights")
    settings.vocab_file.write_text("a\nb\n")
    settings.vocoder_dir.mkdir()
    return settings


def sample(tmp_path: Path) -> Path:
    path = tmp_path / "sample.wav"
    path.write_bytes(b"audio")
    return path


def test_loads_model_from_local_files_on_cpu(model_settings, fake_f5_tts, monkeypatch):
    monkeypatch.delenv("HF_HOME", raising=False)
    engine = F5Engine(model_settings)
    assert not engine.ready

    engine.load()

    assert engine.ready
    assert FakeF5TTS.instances[0].kwargs == {
        "model": "F5TTS_v1_Base",
        "ckpt_file": str(model_settings.ckpt_file),
        "vocab_file": str(model_settings.vocab_file),
        "vocoder_local_path": str(model_settings.vocoder_dir),
        "device": "cpu",
    }
    assert os.environ["HF_HOME"] == str(model_settings.hf_home)


def test_load_fails_clearly_when_files_are_missing(tmp_path, fake_f5_tts):
    engine = F5Engine(Settings.from_env({"MODEL_DIR": str(tmp_path)}))
    with pytest.raises(FileNotFoundError, match="model.safetensors"):
        engine.load()
    assert not engine.ready


def test_clone_before_load_raises(model_settings, tmp_path):
    with pytest.raises(EngineNotReadyError):
        F5Engine(model_settings).clone(CloneRequest(sample_path=sample(tmp_path), text="hi"))


def test_clone_passes_transcript_and_returns_audio(model_settings, fake_f5_tts, tmp_path):
    engine = F5Engine(model_settings)
    engine.load()

    result = engine.clone(
        CloneRequest(sample_path=sample(tmp_path), text="Hello", sample_transcript="My voice.", speed=0.9)
    )

    call = FakeF5TTS.instances[0].calls[0]
    assert call["ref_file"] == str(tmp_path / "sample.wav")
    assert call["ref_text"] == "My voice."
    assert call["gen_text"] == "Hello"
    assert call["speed"] == 0.9
    assert result.sample_rate == 24000
    assert result.audio.dtype == np.float32
    assert len(result.audio) == 4800


def test_missing_transcript_asks_f5_tts_to_transcribe(model_settings, fake_f5_tts, tmp_path):
    engine = F5Engine(model_settings)
    engine.load()

    engine.clone(CloneRequest(sample_path=sample(tmp_path), text="Hello"))

    assert FakeF5TTS.instances[0].calls[0]["ref_text"] == ""


def test_clears_f5_tts_reference_caches_after_each_clone(model_settings, fake_f5_tts, tmp_path):
    engine = F5Engine(model_settings)
    engine.load()

    engine.clone(CloneRequest(sample_path=sample(tmp_path), text="Hello"))

    assert fake_f5_tts._ref_audio_cache == {}
    assert fake_f5_tts._ref_text_cache == {}
    assert not (tmp_path / "sample.processed.wav").exists()


def test_clears_caches_even_when_inference_fails(model_settings, fake_f5_tts, tmp_path, monkeypatch):
    engine = F5Engine(model_settings)
    engine.load()
    fake_f5_tts._ref_text_cache["stale"] = "text"
    monkeypatch.setattr(FakeF5TTS, "infer", lambda self, **kwargs: (_ for _ in ()).throw(RuntimeError("boom")))

    with pytest.raises(RuntimeError, match="boom"):
        engine.clone(CloneRequest(sample_path=sample(tmp_path), text="Hello"))

    assert fake_f5_tts._ref_text_cache == {}


def test_load_sets_torch_threads_to_the_cpu_limit(model_settings, fake_f5_tts, monkeypatch):
    monkeypatch.setenv("TORCH_NUM_THREADS", "3")
    F5Engine(model_settings).load()
    assert fake_f5_tts.torch.threads == [3]


class TestCpuLimit:
    @pytest.fixture(autouse=True)
    def many_cores(self, monkeypatch):
        monkeypatch.delenv("TORCH_NUM_THREADS", raising=False)
        monkeypatch.setattr(os, "cpu_count", lambda: 14)

    def test_reads_cgroup_v2_quota(self, tmp_path):
        (tmp_path / "cpu.max").write_text("400000 100000\n")
        assert cpu_limit(tmp_path) == 4

    def test_unlimited_cgroup_v2_uses_core_count(self, tmp_path):
        (tmp_path / "cpu.max").write_text("max 100000\n")
        assert cpu_limit(tmp_path) == 14

    def test_reads_cgroup_v1_quota(self, tmp_path):
        (tmp_path / "cpu").mkdir()
        (tmp_path / "cpu" / "cpu.cfs_quota_us").write_text("200000\n")
        (tmp_path / "cpu" / "cpu.cfs_period_us").write_text("100000\n")
        assert cpu_limit(tmp_path) == 2

    def test_fractional_quota_rounds_to_at_least_one(self, tmp_path):
        (tmp_path / "cpu.max").write_text("25000 100000\n")
        assert cpu_limit(tmp_path) == 1

    def test_without_cgroup_files_uses_core_count(self, tmp_path):
        assert cpu_limit(tmp_path) == 14

    def test_environment_overrides(self, tmp_path, monkeypatch):
        (tmp_path / "cpu.max").write_text("400000 100000\n")
        monkeypatch.setenv("TORCH_NUM_THREADS", "6")
        assert cpu_limit(tmp_path) == 6


def test_keeps_f5_tts_output_with_request_text_out_of_stdout(model_settings, fake_f5_tts, tmp_path, capsys):
    engine = F5Engine(model_settings)
    engine.load()
    capsys.readouterr()

    engine.clone(CloneRequest(sample_path=sample(tmp_path), text="secret words", sample_transcript="my voice"))

    output = capsys.readouterr()
    assert "secret words" not in output.out + output.err
    assert "my voice" not in output.out + output.err
