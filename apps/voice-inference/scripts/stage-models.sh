#!/usr/bin/env bash
# Stage the pinned model files (models.json) into the models bucket.
#
#   MODEL_BUCKET=gs://BUCKET/models/v1 npx nx run voice-inference:stage-models
#
# Needs Google Cloud application default credentials with write access to the
# bucket (`gcloud auth application-default login`). Downloads about 3 GB from
# Hugging Face into dist/models-staging; re-running skips files already there
# and files already in the bucket.
set -euo pipefail

if [ -z "${MODEL_BUCKET:-}" ]; then
  echo "Set MODEL_BUCKET to gs://BUCKET/PREFIX (see 'terraform output voice_inference_model_bucket')" >&2
  exit 1
fi

app_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workspace_dir="$(cd "$app_dir/../.." && pwd)"
venv_dir="$workspace_dir/dist/tools/voice-inference-stage-venv"
python="${PYTHON:-python3}"

if [ ! -x "$venv_dir/bin/python" ]; then
  "$python" -m venv "$venv_dir"
  "$venv_dir/bin/python" -m pip install --quiet --upgrade pip
  "$venv_dir/bin/python" -m pip install --quiet "huggingface_hub>=0.25,<2" "google-cloud-storage>=2.18,<4"
fi

cd "$workspace_dir"
PYTHONPATH="$app_dir/src" "$venv_dir/bin/python" -m voice_inference.stage_models \
  --bucket "$MODEL_BUCKET" \
  --models "$app_dir/models.json" \
  --work-dir "$workspace_dir/dist/models-staging"
