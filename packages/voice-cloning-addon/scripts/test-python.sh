#!/usr/bin/env bash
# Run the Python service tests in a dedicated virtualenv.
# The venv lives in dist/tests/voice-cloning-addon-venv and is reused between runs.
set -euo pipefail

package_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workspace_dir="$(cd "$package_dir/../.." && pwd)"
venv_dir="$workspace_dir/dist/tests/voice-cloning-addon-venv"
requirements="$package_dir/tests/python/requirements.txt"
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

"$venv_dir/bin/python" -m pytest "$package_dir/tests/python" "$@"
