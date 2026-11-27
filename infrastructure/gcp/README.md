# EchoForge on GCP

Terraform for the GCP deployment:

| Resource | Purpose |
|---|---|
| `google_cloud_run_v2_service.api` (`modules/gcp_backend`) | `backend-api`, public |
| `google_cloud_run_v2_service.inference` (`modules/gcp_voice_inference`) | `voice-inference` (F5-TTS on CPU), private: only the API's service account can call it |
| `google_storage_bucket.samples` | Uploaded voice samples and generated audio (deleted after 1 day) |
| `google_storage_bucket.models` | Model files the inference service copies at startup |

## Model licences

The F5-TTS checkpoint (`SWivid/F5-TTS`, `F5TTS_v1_Base`) is licensed **CC-BY-NC-4.0 (non-commercial)**. The Vocos vocoder and Whisper turbo are MIT. Check that non-commercial use is acceptable before deploying these weights; see `apps/voice-inference/models.json` for the pinned sources.

## First deployment

The inference service fails its startup check until the models bucket holds the model files, so on the first deployment create and fill the bucket before the services:

```bash
cd infrastructure/gcp
terraform init

# 1. Create the models bucket
terraform apply -target=google_storage_bucket.models

# 2. Stage the pinned model files (about 3 GB from Hugging Face; needs
#    `gcloud auth application-default login` with write access to the bucket)
cd ../..
MODEL_BUCKET="$(terraform -chdir=infrastructure/gcp output -raw voice_inference_model_bucket)" \
  npx nx run voice-inference:stage-models

# 3. Build and push both images, then apply everything
npx nx run backend-api:deploy -c gcp
```

After that, `npx nx run backend-api:deploy -c gcp` builds and pushes both images and applies the Terraform. Re-run `stage-models` only when `apps/voice-inference/models.json` changes; to switch model versions without touching the running service, stage under a new `voice_inference_model_prefix` and then change the variable.

## Sizing and scaling

- **voice-inference:** 4 vCPU and 8 GiB per instance by default (`voice_inference_cpu`, `voice_inference_memory`), one clone at a time per instance, scaling from 0 to 2 instances, with a 60-minute request timeout (Cloud Run's maximum); the API waits as long. Scaling to zero means the first request after an idle period waits for a cold start: copying the models from the bucket (about 3 GB) and loading them (12–19 s locally). Set `voice_inference_min_instances = 1` to keep one warm, at the cost of paying for it continuously.

  Measured locally with the real models, generating 16 s of speech from a 5 s sample:

  | | 4 vCPU | 8 vCPU |
  |---|---|---|
  | Clone with a sample transcript | 318 s | 229 s |
  | Clone without one (Whisper transcribes the sample) | 343 s | 250 s |
  | Peak memory | 5.6 GiB | 5.6 GiB |

  CPU inference runs at roughly 20× real time on 4 vCPU (14× on 8), so a one-hour request covers about 3 minutes of generated speech. Longer texts will time out; a GPU (Cloud Run supports NVIDIA L4) would be the way to go much faster.
- **backend-api:** exactly one instance with CPU always allocated. Jobs live in memory and are processed in the background, so a second instance wouldn't see them, and background work would be throttled between requests. This stays until jobs move to a database and a queue.
