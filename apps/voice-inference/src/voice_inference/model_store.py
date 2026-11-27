"""Copy model files from a Google Cloud Storage bucket to local disk."""

from __future__ import annotations

import logging
from pathlib import Path, PurePosixPath
from typing import Any

logger = logging.getLogger(__name__)


def parse_gcs_uri(uri: str) -> tuple[str, str]:
    """Split gs://bucket/some/prefix into ("bucket", "some/prefix/")."""
    if not uri.startswith("gs://"):
        raise ValueError(f"Expected a gs:// URI, got {uri!r}")
    bucket, _, prefix = uri[len("gs://") :].partition("/")
    if not bucket:
        raise ValueError(f"No bucket name in {uri!r}")
    prefix = prefix.strip("/")
    return bucket, f"{prefix}/" if prefix else ""


def _local_path(dest: Path, relative: str) -> Path:
    """Resolve a bucket-relative name under dest, refusing names that escape it."""
    parts = PurePosixPath(relative).parts
    if not parts or any(part in ("..", "") for part in parts) or PurePosixPath(relative).is_absolute():
        raise ValueError(f"Refusing unsafe object name {relative!r}")
    return dest.joinpath(*parts)


def sync_from_gcs(uri: str, dest: Path, client: Any = None) -> int:
    """Download every object under the URI's prefix into dest.

    Files that already exist locally with the same size are skipped, so a
    restarted instance with a warm disk doesn't download them again.
    Returns the number of files downloaded.
    """
    bucket_name, prefix = parse_gcs_uri(uri)
    if client is None:
        from google.cloud import storage  # imported lazily so tests don't need it

        client = storage.Client()

    downloaded = 0
    for blob in client.list_blobs(bucket_name, prefix=prefix):
        relative = blob.name[len(prefix) :]
        if not relative or relative.endswith("/"):
            continue  # the prefix itself or a "directory" placeholder
        target = _local_path(dest, relative)
        if target.exists() and target.stat().st_size == blob.size:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        blob.download_to_filename(str(target))
        downloaded += 1
        logger.info("Downloaded %s (%d bytes)", relative, blob.size)
    return downloaded
