"""Fixtures for the voice cloning service tests.

The service imports f5-tts at module load. The real package pulls in PyTorch
and model weights, so these tests stub it out and load the service fresh for
each test with or without the stub in place.
"""

import importlib
import sys
import types
from pathlib import Path

import pytest

SERVICE_DIR = Path(__file__).resolve().parents[2] / "src" / "python"
MODULE_NAME = "voice_cloning_service"


def _load_service(monkeypatch, with_f5_tts):
    monkeypatch.syspath_prepend(str(SERVICE_DIR))
    for name in [MODULE_NAME, "f5_tts", "f5_tts.infer", "f5_tts.infer.cli"]:
        monkeypatch.delitem(sys.modules, name, raising=False)

    if with_f5_tts:
        cli = types.ModuleType("f5_tts.infer.cli")
        cli.infer_tts = lambda *args, **kwargs: None
        infer = types.ModuleType("f5_tts.infer")
        infer.cli = cli
        package = types.ModuleType("f5_tts")
        package.infer = infer
        monkeypatch.setitem(sys.modules, "f5_tts", package)
        monkeypatch.setitem(sys.modules, "f5_tts.infer", infer)
        monkeypatch.setitem(sys.modules, "f5_tts.infer.cli", cli)
    else:
        # A None entry makes "import f5_tts..." raise ImportError.
        monkeypatch.setitem(sys.modules, "f5_tts", None)

    return importlib.import_module(MODULE_NAME)


@pytest.fixture
def service_module(monkeypatch):
    """The service module with a stubbed f5-tts available."""
    return _load_service(monkeypatch, with_f5_tts=True)


@pytest.fixture
def service_module_without_f5_tts(monkeypatch):
    """The service module as it behaves when f5-tts isn't installed."""
    return _load_service(monkeypatch, with_f5_tts=False)


@pytest.fixture
def service(service_module):
    return service_module.VoiceCloningService(model_path="/models/f5-tts")


@pytest.fixture
def initialized_service(service):
    assert service.initialize() is True
    return service
