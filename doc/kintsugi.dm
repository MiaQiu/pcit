# Kintsugi DAM (Depression/Anxiety Model)

## Why

Evaluated Kintsugi Health's DAM model (https://huggingface.co/KintsugiHealth/dam) — a Whisper-Small-based classifier that screens for depression/anxiety severity from raw speech audio, no transcription needed. Set it up as a standalone Lambda-based service, mirroring the existing `python-services/diarization/` pattern, and verified it end-to-end against a real session recording. Not wired into the production pipeline yet — see [Status](#status) below.

Code: `python-services/depression-anxiety/`

---

## Model

- **Base**: `openai/whisper-small.en`, fine-tuned with a multi-task head (depression + anxiety) via LoRA
- **Language**: English only. `.en` is the English-only Whisper variant (not multilingual `whisper-small`), and the model card states it's intended only for a single voice speaking English, trained predominantly on American English speech. The mobile app supports `zh-CN`/`zh-TW` locales too — this model isn't usable for non-English sessions without retraining or swapping the backbone.
- **Input**: single-speaker audio, 16 kHz mono, 30s+ recommended (post voice-activity-detection) for reliable scores
- **Output** (quantized): `{"depression": 0-2, "anxiety": 0-3}`
  - depression: 0 = none (PHQ-9 ≤ 9), 1 = mild-moderate (10–14), 2 = severe (≥ 15)
  - anxiety: 0 = none (GAD-7 ≤ 4), 1 = mild (5–9), 2 = moderate (10–14), 3 = severe (≥ 15)
- License: Apache 2.0. No hosted inference API — model + code only, run it yourself.

**Important constraint**: the model was trained on single-speaker audio. PCIT session recordings have both parent and child talking. Running DAM on raw session audio (as the smoke test below did) only proves the pipeline works — the resulting score is not clinically meaningful. A real integration needs parent-only speech, isolated via the existing diarization output, as input.

---

## Architecture

Same shape as `python-services/diarization/`: a Docker image built on `public.ecr.aws/lambda/python:3.10`, deployed as an AWS Lambda (container image), invoked with `{s3_bucket, s3_key}` and returning the score dict directly.

- `Dockerfile` — installs a static ffmpeg binary (decodes m4a/aac from mobile recordings), pulls `pipeline.py` / `model.py` / `config.py` / `featex.py` / `dam3.1.ckpt` from the `KintsugiHealth/dam` HF repo at build time, and pre-warms an offline HF cache with the `openai/whisper-small.en` backbone (`HF_HOME` baked into the image, `HF_HUB_OFFLINE=1` at runtime) so the Lambda never needs network access or a writable cache dir.
- `classifier.py` — downloads session audio from S3, converts to 16 kHz mono WAV via ffmpeg, runs the DAM pipeline.
- `handler.py` — thin Lambda entrypoint wrapping `classifier.run_dam()`.
- `deploy.sh` — builds, pushes to ECR (`nora-depression-anxiety`), creates/updates the Lambda. Same AWS account/region as diarization (`059364397483` / `ap-southeast-1`); the existing `nora-diarization-role` IAM role works as-is (S3 read-only is all that's needed).
- `test_classifier.py` — local smoke test, no Docker required. Supports either an S3 key or a local WAV file.

Sizing vs. diarization: 8192MB memory / 900s timeout (vs. 4096MB/300s) — `whisper-small` is a bigger encoder than diarization's tiny/base combo, and DAM processes audio in serial 30s chunks, so longer PCIT sessions take longer on CPU.

---

## Gotchas found while testing

1. **Python 3.10+ required.** `model.py` uses PEP 604 union-type syntax (`list[int] | torch.Tensor`) evaluated eagerly at import time — fails on Python 3.9. The Lambda base image is already 3.10, so no fix needed there; only mattered for local venv testing (had to use Python 3.11, not the macOS default 3.9.6).

2. **`torchaudio.load()` needs `torchcodec`.** DAM's own `featex.py::load_audio()` calls `torchaudio.load(source)`, which in `torchaudio` 2.7+ requires the separate `torchcodec` package (and its FFmpeg shared libs) to decode. Rather than add that dependency to the Lambda image, `classifier.py` bypasses `pipeline.run_on_file()` entirely: it reads the already-ffmpeg-converted 16 kHz mono WAV via `soundfile` (same as `python-services/diarization/classifier.py` already does) and calls `pipeline.run_on_audio()` directly with the resulting tensor.

---

## Local testing

```bash
python3.11 -m venv dam-venv
dam-venv/bin/pip install torch torchaudio transformers peft soundfile boto3 huggingface_hub

# Pull model code + checkpoint
dam-venv/bin/python3 -c "
from huggingface_hub import snapshot_download
snapshot_download(repo_id='KintsugiHealth/dam', local_dir='/tmp/dam-task',
    allow_patterns=['pipeline.py', 'model.py', 'config.py', 'featex.py', 'dam3.1.ckpt'])
"

# Against S3-hosted session audio
LAMBDA_TASK_ROOT=/tmp/dam-task \
AWS_S3_BUCKET=nora-audio-059364397483-sg \
AWS_S3_KEY=audio/<userId>/<sessionId>.m4a \
dam-venv/bin/python3 python-services/depression-anxiety/test_classifier.py

# Or against a local WAV (must be 16kHz mono already)
LAMBDA_TASK_ROOT=/tmp/dam-task \
LOCAL_AUDIO_FILE=/path/to/sample.wav \
dam-venv/bin/python3 python-services/depression-anxiety/test_classifier.py
```

First run downloads `openai/whisper-small.en` (~1GB) into the default HF cache; subsequent runs are fast (pipeline load ~3s, inference ~18s for a 5-minute clip on CPU).

### Verified run (2026-08-11)

Ran against a real 5-minute session recording pulled from `nora-audio-059364397483-sg`: pipeline loaded, ran inference, returned `{"depression": 0, "anxiety": 1}` in ~18s on CPU. Confirms the S3 → ffmpeg → DAM pipeline → scores plumbing works. Score itself is not clinically meaningful for this input — see the single-speaker constraint above.

---

## Deploying

```bash
LAMBDA_ROLE_ARN=arn:aws:iam::059364397483:role/nora-diarization-role \
python-services/depression-anxiety/deploy.sh
```

Then grant App Runner invoke permission (printed by `deploy.sh` on first create) and add `DAM_LAMBDA_NAME=nora-depression-anxiety` to App Runner env vars.

---

## Status

**Not integrated into the production pipeline.** This is a standalone, tested Lambda service only. Before wiring it to `pcitAnalysisService.cjs` / real user audio, still need:

- **Speaker isolation**: feed DAM parent-only audio (via existing diarization segments), not raw session audio.
- **Where results land**: `pcitAnalysisService.cjs` has no existing hook for ML-based risk output today. The only risk detection in the codebase is the keyword-based `detectRisk` in `server/routes/sessions.cjs`, feeding `RiskAuditLog` / `Session.flaggedForReview`. Depression/anxiety scores need a deliberate decision on where they land in that flow.
- **Escalation + consent**: no crisis-escalation or user-consent flow currently exists for ML-derived mental health risk signals. This needs clinical/legal sign-off before it touches real users — a false negative on a safety-relevant signal, or an unexplained false positive shown to a parent, is a safety incident, not a bug.
