"""Settings tests."""

from pathlib import Path

from voice_inference.config import Settings


def test_defaults_follow_the_model_dir_layout():
    settings = Settings.from_env({})
    assert settings.model_dir == Path("/models")
    assert settings.model_bucket is None
    assert settings.f5_model == "F5TTS_v1_Base"
    assert settings.ckpt_file == Path("/models/f5-tts/model.safetensors")
    assert settings.vocab_file == Path("/models/f5-tts/vocab.txt")
    assert settings.vocoder_dir == Path("/models/vocos")
    assert settings.hf_home == Path("/models/huggingface")
    assert settings.max_sample_bytes == 10 * 1024 * 1024
    assert settings.max_text_chars == 5000
    assert settings.port == 8080


def test_environment_overrides():
    settings = Settings.from_env(
        {
            "MODEL_DIR": "/data",
            "MODEL_BUCKET": "gs://bucket/models",
            "F5TTS_CKPT_FILE": "/elsewhere/model.pt",
            "MAX_SAMPLE_BYTES": "1024",
            "PORT": "9000",
        }
    )
    assert settings.model_bucket == "gs://bucket/models"
    assert settings.ckpt_file == Path("/elsewhere/model.pt")
    assert settings.vocab_file == Path("/data/f5-tts/vocab.txt")
    assert settings.max_sample_bytes == 1024
    assert settings.port == 9000


def test_empty_bucket_means_no_bucket():
    assert Settings.from_env({"MODEL_BUCKET": ""}).model_bucket is None
