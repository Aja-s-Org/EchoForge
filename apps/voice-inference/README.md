# voice-inference

A small Python service that runs [F5-TTS](https://github.com/SWivid/F5-TTS) voice cloning on CPU behind an HTTP API. `backend-api` sends it clone jobs; it isn't meant to be public.

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | `200 {"status": "ready"}` once the model is loaded; `503` with `loading` or `failed` (and an `error`) before that. Use it as the startup probe. |
| `POST` | `/v1/clone` | Multipart form, returns the generated speech as a 16-bit WAV (`audio/wav`, sample rate in `X-Sample-Rate`). |

`/v1/clone` form fields:

| Field | Required | Description |
|---|---|---|
| `voice_sample` | yes | Audio file of the voice to clone (WAV, FLAC, OGG or MP3), at most `MAX_SAMPLE_BYTES`. F5-TTS uses up to about 12 seconds of it. |
| `text` | yes | Text to speak, at most `MAX_TEXT_CHARS` characters. |
| `sample_transcript` | no | What is said in `voice_sample`. Without it, F5-TTS transcribes the sample with Whisper, which is slower. |
| `speed` | no | Speaking speed, `0.5` to `2.0` (default `1.0`). |

Errors: `400` for invalid input, `413` for an oversized sample, `422` for missing fields, `503` (with `Retry-After`) while the model loads, `500` if inference fails. Request text is never logged.

One instance runs one clone at a time; CPU inference already uses every core.

## Model files

At startup the service copies everything under `MODEL_BUCKET` into `MODEL_DIR` (skipping files that are already there with the same size), then loads the model. Nothing is downloaded from Hugging Face at runtime (`HF_HUB_OFFLINE=1` in the image), so the bucket must contain:

```
f5-tts/model.safetensors   F5-TTS checkpoint
f5-tts/vocab.txt           F5-TTS vocabulary
vocos/config.yaml          Vocos vocoder
vocos/pytorch_model.bin
huggingface/               Hugging Face cache with openai/whisper-large-v3-turbo,
                           used when a request has no sample_transcript
```

## Configuration

| Variable | Default | |
|---|---|---|
| `MODEL_BUCKET` | none | `gs://bucket/prefix` to copy model files from. Unset to use files already in `MODEL_DIR`. |
| `MODEL_DIR` | `/models` | Local model directory. |
| `F5TTS_MODEL` | `F5TTS_v1_Base` | F5-TTS model config name. |
| `F5TTS_CKPT_FILE`, `F5TTS_VOCAB_FILE`, `VOCODER_DIR`, `HF_HOME` | under `MODEL_DIR` | Override individual paths. |
| `MAX_SAMPLE_BYTES` | `10485760` | Largest accepted voice sample. |
| `MAX_TEXT_CHARS` | `5000` | Longest accepted text. |
| `PORT` | `8080` | HTTP port (Cloud Run sets this). |

## Development

```bash
# Tests (F5-TTS is stubbed; needs python3-venv)
npx nx run voice-inference:test-python

# Image (builds the pinned f5-tts wheel first)
npx nx run voice-inference:docker-build -c gcp
```

To run it locally with real weights, put them in a directory with the layout above and start the image with that directory mounted at `/models` and `MODEL_BUCKET` unset.
