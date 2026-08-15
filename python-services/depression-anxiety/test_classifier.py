"""
Local smoke test for classifier.py — run before deploying to Lambda.

Checks:
  1. Model code + checkpoint are present in LAMBDA_TASK_ROOT
  2. Pipeline loads (offline, if HF cache is warm and HF_HUB_OFFLINE=1)
  3. Inference returns depression/anxiety scores

Usage (from project root), against S3-hosted session audio:
  LAMBDA_TASK_ROOT=/tmp/dam-test \
  AWS_S3_BUCKET=nora-audio-059364397483-sg \
  AWS_S3_KEY=audio/<userId>/<sessionId>.m4a \
  /tmp/dam-venv/bin/python python-services/depression-anxiety/test_classifier.py

Or against a local audio file, skipping S3 entirely (must already be 16 kHz
mono WAV, e.g. `ffmpeg -i in.m4a -ar 16000 -ac 1 -f wav sample.wav`):
  LAMBDA_TASK_ROOT=/tmp/dam-test \
  LOCAL_AUDIO_FILE=/path/to/sample.wav \
  /tmp/dam-venv/bin/python python-services/depression-anxiety/test_classifier.py
"""
import os, sys, time

LAMBDA_TASK_ROOT = os.environ.get('LAMBDA_TASK_ROOT')
S3_BUCKET        = os.environ.get('AWS_S3_BUCKET')
S3_KEY           = os.environ.get('AWS_S3_KEY')
LOCAL_AUDIO_FILE = os.environ.get('LOCAL_AUDIO_FILE')

if not LAMBDA_TASK_ROOT:
    print('ERROR: set LAMBDA_TASK_ROOT')
    sys.exit(1)
if not LOCAL_AUDIO_FILE and not (S3_BUCKET and S3_KEY):
    print('ERROR: set either LOCAL_AUDIO_FILE, or both AWS_S3_BUCKET and AWS_S3_KEY')
    sys.exit(1)

sys.path.insert(0, LAMBDA_TASK_ROOT)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

PASS = '\033[92m✅\033[0m'
FAIL = '\033[91m❌\033[0m'

# ── Test 1: Model files exist ─────────────────────────────────────────────────
print('[1] Checking model files...')
for name in ('pipeline.py', 'model.py', 'config.py', 'featex.py', 'dam3.1.ckpt'):
    path = os.path.join(LAMBDA_TASK_ROOT, name)
    if os.path.isfile(path):
        print(f'    {PASS} {path}')
    else:
        print(f'    {FAIL} Missing: {path}')
        sys.exit(1)

# ── Test 2: Pipeline loads ────────────────────────────────────────────────────
print('[2] Loading DAM Pipeline...')
t = time.time()
from classifier import _load_pipeline
pipeline = _load_pipeline()
print(f'    {PASS} ({time.time()-t:.1f}s)')

# ── Test 3: Inference ─────────────────────────────────────────────────────────
print('[3] Running inference...')
t = time.time()
if LOCAL_AUDIO_FILE:
    from classifier import _load_waveform
    waveform = _load_waveform(LOCAL_AUDIO_FILE)
    result = pipeline.run_on_audio(waveform, quantize=True)
else:
    from classifier import run_dam
    result = run_dam(S3_BUCKET, S3_KEY, quantize=True)
elapsed = time.time() - t

print(f'    Elapsed: {elapsed:.1f}s')
print()
print('── Result ───────────────────────────────────────────────')
print(f'  depression: {result.get("depression")}   (0=none, 1=mild-moderate, 2=severe)')
print(f'  anxiety:    {result.get("anxiety")}   (0=none, 1=mild, 2=moderate, 3=severe)')
print()
print(f'  {PASS} Smoke test complete — sanity-check these scores against the sample audio.')
