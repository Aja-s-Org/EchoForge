#!/usr/bin/env bash
# Run the voice inference service's tests in a dedicated virtualenv.
# The venv lives in dist/tests/voice-inference-venv and is reused between runs.
set -euo pipefail

app_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workspace_dir="$(cd "$app_dir/../.." && pwd)"
venv_dir="$workspace_dir/dist/tests/voice-inference-venv"
requirements="$app_dir/requirements-test.txt"
python="${PYTHON:-python3}"

if [ ! -x "$venv_dir/bin/python" ]; then
  "$python" -m venv "$venv_dir"
fi

# Reinstall only when the requirements change.
stamp="$venv_dir/.requirements.sha256"
current="$(sha256sum "$requirements" | cut -d' ' -f1)"
if [ ! -f "$stamp" ] || [ "$(cat "$stamp")" != "$current" ]; then
  "$venv_dir/bin/python" -m pip install --quiet --upgrade pip
  "$venv_dir/bin/python" -m pip install --quiet -r "$requirements"
  echo "$current" > "$stamp"
fi

cd "$app_dir"
"$venv_dir/bin/python" -m pytest "$@"
