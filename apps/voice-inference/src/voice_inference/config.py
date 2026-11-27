"""Service settings, read from environment variables."""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    """Where the model files live and how requests are limited.

    The model directory mirrors the layout of the models bucket:

        <model_dir>/f5-tts/model.safetensors   F5-TTS checkpoint
        <model_dir>/f5-tts/vocab.txt           F5-TTS vocabulary
        <model_dir>/vocos/                     Vocos vocoder (config.yaml, pytorch_model.bin)
        <model_dir>/huggingface/               Hugging Face cache holding Whisper, used
                                               when a request has no sample transcript
    """

    model_dir: Path
    model_bucket: str | None
    f5_model: str
    ckpt_file: Path
    vocab_file: Path
    vocoder_dir: Path
    hf_home: Path
    max_sample_bytes: int
    max_text_chars: int
    port: int

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> Settings:
        env = os.environ if env is None else env
        model_dir = Path(env.get("MODEL_DIR", "/models"))
        return cls(
            model_dir=model_dir,
            model_bucket=env.get("MODEL_BUCKET") or None,
            f5_model=env.get("F5TTS_MODEL", "F5TTS_v1_Base"),
            ckpt_file=Path(env.get("F5TTS_CKPT_FILE", model_dir / "f5-tts" / "model.safetensors")),
            vocab_file=Path(env.get("F5TTS_VOCAB_FILE", model_dir / "f5-tts" / "vocab.txt")),
            vocoder_dir=Path(env.get("VOCODER_DIR", model_dir / "vocos")),
            hf_home=Path(env.get("HF_HOME", model_dir / "huggingface")),
            max_sample_bytes=int(env.get("MAX_SAMPLE_BYTES", 10 * 1024 * 1024)),
            max_text_chars=int(env.get("MAX_TEXT_CHARS", 5000)),
            port=int(env.get("PORT", 8080)),
        )
