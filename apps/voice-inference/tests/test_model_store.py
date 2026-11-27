"""Bucket sync tests with a fake storage client."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pytest

from voice_inference.model_store import parse_gcs_uri, sync_from_gcs


@dataclass
class FakeBlob:
    name: str
    content: bytes = b""

    @property
    def size(self) -> int:
        return len(self.content)

    def download_to_filename(self, filename: str) -> None:
        Path(filename).write_bytes(self.content)


class FakeClient:
    def __init__(self, blobs: list[FakeBlob]) -> None:
        self.blobs = blobs
        self.listed: list[tuple[str, str]] = []

    def list_blobs(self, bucket: str, prefix: str):
        self.listed.append((bucket, prefix))
        return [blob for blob in self.blobs if blob.name.startswith(prefix)]


@pytest.mark.parametrize(
    ("uri", "expected"),
    [
        ("gs://models", ("models", "")),
        ("gs://models/", ("models", "")),
        ("gs://models/f5-tts/v1", ("models", "f5-tts/v1/")),
        ("gs://models/f5-tts/v1/", ("models", "f5-tts/v1/")),
    ],
)
def test_parses_gcs_uris(uri, expected):
    assert parse_gcs_uri(uri) == expected


@pytest.mark.parametrize("uri", ["s3://models/x", "/models", "gs://", "gs:///prefix"])
def test_rejects_non_gcs_uris(uri):
    with pytest.raises(ValueError):
        parse_gcs_uri(uri)


def test_downloads_objects_under_prefix_keeping_layout(tmp_path):
    client = FakeClient(
        [
            FakeBlob("v1/f5-tts/model.safetensors", b"weights"),
            FakeBlob("v1/vocos/config.yaml", b"cfg"),
            FakeBlob("v1/vocos/", b""),  # directory placeholder
            FakeBlob("other/file", b"ignored"),
        ]
    )

    count = sync_from_gcs("gs://models/v1", tmp_path, client=client)

    assert count == 2
    assert client.listed == [("models", "v1/")]
    assert (tmp_path / "f5-tts" / "model.safetensors").read_bytes() == b"weights"
    assert (tmp_path / "vocos" / "config.yaml").read_bytes() == b"cfg"
    assert not (tmp_path / "file").exists()


def test_skips_files_already_present_with_same_size(tmp_path):
    (tmp_path / "f5-tts").mkdir()
    (tmp_path / "f5-tts" / "model.safetensors").write_bytes(b"weights")
    (tmp_path / "f5-tts" / "vocab.txt").write_bytes(b"old")
    client = FakeClient(
        [FakeBlob("f5-tts/model.safetensors", b"weights"), FakeBlob("f5-tts/vocab.txt", b"newer vocab")]
    )

    count = sync_from_gcs("gs://models", tmp_path, client=client)

    assert count == 1
    assert (tmp_path / "f5-tts" / "vocab.txt").read_bytes() == b"newer vocab"


@pytest.mark.parametrize("name", ["v1/../escape.txt", "v1/a/../../escape.txt"])
def test_refuses_object_names_that_escape_the_model_dir(tmp_path, name):
    client = FakeClient([FakeBlob(name, b"x")])
    with pytest.raises(ValueError, match="unsafe"):
        sync_from_gcs("gs://models/v1", tmp_path / "models", client=client)
    assert not (tmp_path / "escape.txt").exists()
