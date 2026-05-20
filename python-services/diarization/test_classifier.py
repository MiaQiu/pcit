"""
Local smoke test for classifier.py — run before deploying to Lambda.

Checks:
  1. HF_HOME is writable (Lambda home dir is read-only)
  2. WhisperWrapper loads without hitting the network
  3. classify_speakers returns correct adult/child roles

Usage (from project root):
  LAMBDA_TASK_ROOT=/tmp/diarization-test \
  HF_HOME=/tmp/diarization-test/.hf_cache \
  AWS_S3_BUCKET=nora-audio-059364397483-sg \
  /tmp/diarization-venv/bin/python python-services/diarization/test_classifier.py
"""
import os, sys, time

LAMBDA_TASK_ROOT = os.environ.get('LAMBDA_TASK_ROOT')
S3_BUCKET        = os.environ.get('AWS_S3_BUCKET')

missing = [k for k, v in [('LAMBDA_TASK_ROOT', LAMBDA_TASK_ROOT), ('AWS_S3_BUCKET', S3_BUCKET)] if not v]
if missing:
    print(f'ERROR: set {", ".join(missing)}')
    sys.exit(1)

sys.path.insert(0, LAMBDA_TASK_ROOT)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

PASS = '\033[92m✅\033[0m'
FAIL = '\033[91m❌\033[0m'

# ── Test 1: Local model dirs exist ────────────────────────────────────────────
print('[1] Checking local model dirs...')
for name in ('whisper-tiny-local', 'whisper-base-local'):
    path = os.path.join(LAMBDA_TASK_ROOT, name)
    if os.path.isdir(path):
        print(f'    {PASS} {path}')
    else:
        print(f'    {FAIL} Missing: {path}')
        sys.exit(1)

# ── Test 2: Model loads ───────────────────────────────────────────────────────
print('[2] Loading WhisperWrapper model...')
t = time.time()
from classifier import _load_model
_load_model()
print(f'    {PASS} ({time.time()-t:.1f}s)')

# ── Test 3: classify_speakers ─────────────────────────────────────────────────
S3_KEY = 'audio/01a50a36-cd18-4311-ab2e-897d088dec02/807db5e6-74ad-423c-ba20-b3ead3b58aac.m4a'
SPEAKERS = [
    {'id': 'speaker_0', 'segments': [
        {'start': 11.48, 'end': 14.18},
        {'start': 31.78, 'end': 38.84},
        {'start': 38.86, 'end': 44.16},
        {'start': 63.68, 'end': 65.08},
        {'start': 65.04, 'end': 67.86},
        {'start': 67.86, 'end': 70.38},
        {'start': 73.26, 'end': 78.60},
        {'start': 78.60, 'end': 82.34},
    ]},
    {'id': 'speaker_1', 'segments': [
        {'start': 25.82, 'end': 27.60},
        {'start': 52.26, 'end': 63.68},
        {'start': 97.60, 'end': 103.17},
        {'start': 103.96, 'end': 106.10},
        {'start': 108.64, 'end': 110.90},
    ]},
]

print(f'[3] classify_speakers (session 807db5e6)...')
t = time.time()
from classifier import classify_speakers
results = classify_speakers(S3_BUCKET, S3_KEY, SPEAKERS)
elapsed = time.time() - t

print(f'    Elapsed: {elapsed:.1f}s')
print()
print('── Results ─────────────────────────────────────────────')
EXPECTED = {'speaker_0': 'adult', 'speaker_1': 'child'}
all_pass = True
for spk, info in results.items():
    bar  = '█' * int(info['confidence'] * 20)
    exp  = EXPECTED.get(spk, '?')
    ok   = info['role'] == exp
    if not ok: all_pass = False
    icon = PASS if ok else FAIL
    print(f'  {icon} {spk}: {info["role"].upper():<6}  conf={info["confidence"]:.2f}  {bar}')
    if not ok:
        print(f'       expected: {exp}')

print()
print('── Summary ─────────────────────────────────────────────')
print(f'  {PASS if all_pass else FAIL} {"All checks passed" if all_pass else "Some checks FAILED"}')
sys.exit(0 if all_pass else 1)
