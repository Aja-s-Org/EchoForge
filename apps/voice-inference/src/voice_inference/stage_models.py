"""Copy the pinned model files from Hugging Face into the models bucket.

    python -m voice_inference.stage_models --bucket gs://BUCKET/models/v1

Reads models.json, downloads each file at its pinned commit, arranges them in
the layout the service loads from (see the README), and uploads them under the
bucket prefix. Files already in the bucket with the same size are skipped, so
re-running is cheap. Needs Google Cloud application default credentials with
write access to the bucket (`gcloud auth application-default login`).
"""

from __future__ import annotations

import argparse
import json
import logging
import shutil
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .model_store import parse_gcs_uri

logger = logging.getLogger(__name__)

DEFAULT_MODELS_FILE = Path(__file__).resolve().parents[2] / "models.json"


@dataclass(frozen=True)
class StagedFile:
    repository: str
    revision: str
    filename: str
    target: str  # path relative to the model directory


def hf_cache_dir(repository: str) -> str:
    """Directory of a repo inside a Hugging Face cache (HF_HOME/hub)."""
    return "huggingface/hub/models--" + repository.replace("/", "--")


def plan(config: dict[str, Any]) -> tuple[list[StagedFile], dict[str, str]]:
    """List the files to stage, plus extra small files (path -> content) to write.

    Models marked huggingface_cache are laid out as a Hugging Face cache
    snapshot with refs/main pointing at the pinned revision, so libraries can
    load them by repo name with HF_HUB_OFFLINE=1.
    """
    files: list[StagedFile] = []
    extras: dict[str, str] = {}
    for model in config["models"]:
        repository, revision = model["repository"], model["revision"]
        if not repository or not revision:
            raise ValueError(f"Model entry needs repository and revision: {model}")
        cached = model.get("huggingface_cache", False)
        for filename, target in model["files"].items():
            if cached:
                target = f"{hf_cache_dir(repository)}/snapshots/{revision}/{filename}"
            elif not target:
                raise ValueError(f"No target path for {repository}/{filename}")
            files.append(StagedFile(repository, revision, filename, target))
        if cached:
            extras[f"{hf_cache_dir(repository)}/refs/main"] = revision
    return files, extras


def build(
    config: dict[str, Any],
    out_dir: Path,
    cache_dir: Path,
    download: Callable[..., str] | None = None,
) -> list[str]:
    """Download the pinned files and lay them out under out_dir. Returns the relative paths."""
    if download is None:
        from huggingface_hub import hf_hub_download  # imported lazily so tests don't need it

        download = hf_hub_download

    files, extras = plan(config)
    written: list[str] = []
    for item in files:
        logger.info("Downloading %s/%s@%s", item.repository, item.filename, item.revision[:7])
        source = download(
            repo_id=item.repository, filename=item.filename, revision=item.revision, cache_dir=str(cache_dir)
        )
        target = out_dir / item.target
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)  # follows the cache's symlinks
        written.append(item.target)
    for relative, content in extras.items():
        target = out_dir / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)
        written.append(relative)
    return written


def upload(out_dir: Path, relative_paths: list[str], uri: str, client: Any = None) -> int:
    """Upload files to gs://bucket/prefix, skipping ones already there with the same size."""
    bucket_name, prefix = parse_gcs_uri(uri)
    if client is None:
        from google.cloud import storage

        client = storage.Client()

    existing = {blob.name: blob.size for blob in client.list_blobs(bucket_name, prefix=prefix)}
    bucket = client.bucket(bucket_name)
    uploaded = 0
    for relative in relative_paths:
        path = out_dir / relative
        name = prefix + relative
        if existing.get(name) == path.stat().st_size:
            logger.info("Already in bucket: %s", relative)
            continue
        logger.info("Uploading %s (%d bytes)", relative, path.stat().st_size)
        bucket.blob(name).upload_from_filename(str(path))
        uploaded += 1
    return uploaded


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--bucket", required=True, help="gs://bucket/prefix to upload to (the service's MODEL_BUCKET)")
    parser.add_argument("--models", type=Path, default=DEFAULT_MODELS_FILE, help="pinned models file")
    parser.add_argument("--work-dir", type=Path, default=Path("dist/models-staging"), help="local staging directory")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    parse_gcs_uri(args.bucket)  # fail early on a bad URI
    config = json.loads(args.models.read_text())
    out_dir = args.work_dir / "models"
    written = build(config, out_dir, cache_dir=args.work_dir / "hf-cache")
    count = upload(out_dir, written, args.bucket)
    logger.info("Uploaded %d of %d files to %s", count, len(written), args.bucket)


if __name__ == "__main__":
    main()
