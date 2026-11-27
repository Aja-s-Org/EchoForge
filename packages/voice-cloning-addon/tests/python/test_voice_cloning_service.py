"""Tests for src/python/voice_cloning_service.py with f5-tts stubbed out."""

import io
import json
import sys

import pytest


class TestWithoutF5TTS:
    def test_reports_f5_tts_unavailable(self, service_module_without_f5_tts):
        assert service_module_without_f5_tts.F5_TTS_AVAILABLE is False

    def test_initialize_fails(self, service_module_without_f5_tts):
        service = service_module_without_f5_tts.VoiceCloningService()
        assert service.initialize() is False
        assert service.initialized is False


class TestInitialize:
    def test_starts_uninitialized(self, service):
        assert service.initialized is False
        assert service.model_path == "/models/f5-tts"

    def test_initialize_succeeds_with_f5_tts(self, service_module, service):
        assert service_module.F5_TTS_AVAILABLE is True
        assert service.initialize() is True
        assert service.initialized is True


class TestExtractVoiceEmbedding:
    def test_requires_initialize(self, service):
        assert service.extract_voice_embedding(b"\x00\x01", 22050) == {"error": "Service not initialized"}

    def test_returns_256_dimension_embedding(self, initialized_service):
        audio = bytes(22050 * 2)  # 1 second of 16-bit mono silence

        result = initialized_service.extract_voice_embedding(audio, 22050)

        assert "error" not in result
        assert len(result["embedding"]) == 256
        assert result["sample_rate"] == 22050
        assert result["duration"] == pytest.approx(1.0)


class TestSynthesizeSpeech:
    def test_requires_initialize(self, service):
        assert service.synthesize_speech([0.0] * 256, "hello") == {"error": "Service not initialized"}

    def test_returns_audio_description(self, initialized_service):
        result = initialized_service.synthesize_speech([0.0] * 256, "hello world", "en")

        assert "error" not in result
        assert set(result) >= {"audio_data", "sample_rate", "duration", "format"}
        assert result["sample_rate"] > 0
        assert result["format"] == "wav"


class TestProcessRequest:
    def test_routes_initialize(self, service):
        assert service.process_request({"type": "initialize"}) == {"success": True}
        assert service.initialized is True

    def test_routes_extract_embedding(self, initialized_service):
        result = initialized_service.process_request(
            {"type": "extract_embedding", "audio_data": [0, 0, 0, 0], "sample_rate": 16000}
        )
        assert len(result["embedding"]) == 256

    def test_routes_synthesize_with_default_language(self, initialized_service):
        result = initialized_service.process_request(
            {"type": "synthesize", "voice_embedding": [0.0] * 256, "text": "hi"}
        )
        assert "error" not in result

    def test_rejects_unknown_type(self, service):
        assert service.process_request({"type": "bogus"}) == {"error": "Unknown request type: bogus"}

    def test_rejects_missing_type(self, service):
        assert service.process_request({}) == {"error": "Unknown request type: None"}


class TestStdinMode:
    def run_main(self, service_module, monkeypatch, capsys, lines):
        monkeypatch.setattr(sys, "argv", ["voice_cloning_service.py"])
        monkeypatch.setattr(sys, "stdin", io.StringIO("".join(line + "\n" for line in lines)))
        service_module.main()
        return [json.loads(line) for line in capsys.readouterr().out.splitlines()]

    def test_answers_one_json_line_per_request(self, service_module, monkeypatch, capsys):
        responses = self.run_main(
            service_module,
            monkeypatch,
            capsys,
            [
                json.dumps({"type": "initialize"}),
                json.dumps({"type": "synthesize", "voice_embedding": [], "text": "hi"}),
            ],
        )

        assert responses[0] == {"success": True}
        assert responses[1]["format"] == "wav"

    def test_reports_invalid_json_and_keeps_going(self, service_module, monkeypatch, capsys):
        responses = self.run_main(
            service_module, monkeypatch, capsys, ["not json", json.dumps({"type": "initialize"})]
        )

        assert responses == [{"error": "Invalid JSON"}, {"success": True}]

    def test_reports_missing_fields_as_processing_error(self, service_module, monkeypatch, capsys):
        responses = self.run_main(
            service_module,
            monkeypatch,
            capsys,
            [json.dumps({"type": "initialize"}), json.dumps({"type": "extract_embedding"})],
        )

        assert responses[1]["error"].startswith("Processing error:")
