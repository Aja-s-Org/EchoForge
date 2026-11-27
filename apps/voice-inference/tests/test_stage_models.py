"""Model staging tests with fake Hugging Face downloads and a fake bucket."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

import pytest

from voice_inference.config import Settings
from voice_inference.stage_models import DEFAULT_MODELS_FILE, build, plan, upload

CONFIG = {
    "models": [
        {
            "repository": "SWivid/F5-TTS",
            "revision": "a" * 40,
            "files": {"F5TTS_v1_Base/model_1250000.safetensors": "f5-tts/model.safetensors"},
        },
        {
            "repository": "openai/whisper-large-v3-turbo",
            "revision": "b" * 40,
            "huggingface_cache": True,
            "files": {"config.json": None, "model.safetensors": None},
        },
    ]
}


def fake_download(tmp_path: Path):
    """Mimic hf_hub_download: a blob file plus a symlink in snapshots/."""
    calls = []

    def download(repo_id: str, filename: str, revision: str, cache_dir: str) -> str:
        calls.append((repo_id, filename, revision))
        blob = Path(cache_dir) / "blobs" / f"{repo_id.replace('/', '-')}-{filename.replace('/', '-')}"
        blob.parent.mkdir(parents=True, exist_ok=True)
        blob.write_text(f"{repo_id}:{filename}")
        link = Path(cache_dir) / "snapshots" / revision / filename
        link.parent.mkdir(parents=True, exist_ok=True)
        if not link.exists():
            os.symlink(blob, link)
        return str(link)

    return download, calls


def test_plan_lays_out_cached_models_as_a_hugging_face_snapshot():
    files, extras = plan(CONFIG)

    targets = [f.target for f in files]
    assert targets == [
        "f5-tts/model.safetensors",
        f"huggingface/hub/models--openai--whisper-large-v3-turbo/snapshots/{'b' * 40}/config.json",
        f"huggingface/hub/models--openai--whisper-large-v3-turbo/snapshots/{'b' * 40}/model.safetensors",
    ]
    assert extras == {"huggingface/hub/models--openai--whisper-large-v3-turbo/refs/main": "b" * 40}


def test_plan_requires_a_target_for_plain_files():
    config = {"models": [{"repository": "x/y", "revision": "c" * 40, "files": {"a.bin": None}}]}
    with pytest.raises(ValueError, match="No target path"):
        plan(config)


def test_build_downloads_pinned_revisions_and_copies_real_files(tmp_path):
    download, calls = fake_download(tmp_path)
    out_dir = tmp_path / "out"

    written = build(CONFIG, out_dir, cache_dir=tmp_path / "cache", download=download)

    assert ("SWivid/F5-TTS", "F5TTS_v1_Base/model_1250000.safetensors", "a" * 40) in calls
    checkpoint = out_dir / "f5-tts" / "model.safetensors"
    assert checkpoint.read_text() == "SWivid/F5-TTS:F5TTS_v1_Base/model_1250000.safetensors"
    assert not checkpoint.is_symlink()
    snapshot = out_dir / f"huggingface/hub/models--openai--whisper-large-v3-turbo/snapshots/{'b' * 40}"
    assert (snapshot / "model.safetensors").read_text() == "openai/whisper-large-v3-turbo:model.safetensors"
    refs = out_dir / "huggingface/hub/models--openai--whisper-large-v3-turbo/refs/main"
    assert refs.read_text() == "b" * 40
    assert len(written) == 4


def test_layout_matches_what_the_service_loads(tmp_path):
    """The staged F5-TTS and Vocos paths must be the service's default paths."""
    files, _ = plan(json.loads(DEFAULT_MODELS_FILE.read_text()))
    targets = {f.target for f in files}
    settings = Settings.from_env({"MODEL_DIR": "/models"})
    for path in (settings.ckpt_file, settings.vocab_file):
        assert str(path.relative_to("/models")) in targets
    vocoder = str(settings.vocoder_dir.relative_to("/models"))
    assert {f"{vocoder}/config.yaml", f"{vocoder}/pytorch_model.bin"} <= targets
    hf_home = str(settings.hf_home.relative_to("/models"))
    assert any(t.startswith(f"{hf_home}/hub/models--openai--whisper-large-v3-turbo/snapshots/") for t in targets)


def test_pinned_models_use_full_commit_hashes():
    for model in json.loads(DEFAULT_MODELS_FILE.read_text())["models"]:
        assert len(model["revision"]) == 40, model["repository"]


@dataclass
class FakeBlob:
    name: str
    size: int
    uploaded_from: list[str] = field(default_factory=list)

    def upload_from_filename(self, filename: str) -> None:
        self.uploaded_from.append(filename)


class FakeBucketClient:
    def __init__(self, existing: dict[str, int]) -> None:
        self.existing = existing
        self.created: dict[str, FakeBlob] = {}

    def list_blobs(self, bucket: str, prefix: str):
        return [FakeBlob(name, size) for name, size in self.existing.items() if name.startswith(prefix)]

    def bucket(self, name: str):
        client = self

        class Bucket:
            def blob(self, blob_name: str) -> FakeBlob:
                return client.created.setdefault(blob_name, FakeBlob(blob_name, 0))

        return Bucket()


def test_upload_skips_files_already_in_the_bucket(tmp_path):
    (tmp_path / "f5-tts").mkdir()
    (tmp_path / "f5-tts" / "model.safetensors").write_bytes(b"12345")
    (tmp_path / "f5-tts" / "vocab.txt").write_bytes(b"abc")
    client = FakeBucketClient({"models/v1/f5-tts/model.safetensors": 5, "models/v1/f5-tts/vocab.txt": 1})

    count = upload(
        tmp_path, ["f5-tts/model.safetensors", "f5-tts/vocab.txt"], "gs://echoforge-models/models/v1", client=client
    )

    assert count == 1
    assert list(client.created) == ["models/v1/f5-tts/vocab.txt"]
    assert client.created["models/v1/f5-tts/vocab.txt"].uploaded_from == [str(tmp_path / "f5-tts" / "vocab.txt")]
