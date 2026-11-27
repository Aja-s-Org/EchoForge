"""Checks the F5-TTS release pin that build-f5-tts downloads and builds."""

import json
import re
from pathlib import Path

PIN = Path(__file__).resolve().parents[1] / "f5-tts.json"


def test_pins_a_release_by_tag_commit_and_checksum():
    pin = json.loads(PIN.read_text())
    assert pin["repository"] == "SWivid/F5-TTS"
    assert re.fullmatch(r"\d+\.\d+\.\d+", pin["version"])
    assert re.fullmatch(r"[0-9a-f]{40}", pin["commit"])
    assert re.fullmatch(r"[0-9a-f]{64}", pin["sha256"])
