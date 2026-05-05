"""
Child-adult speaker classifier.
Wraps the USC SAIL whisper-based model to classify each speaker_X
as 'adult' or 'child' given a 10-second audio window.
"""
import os
import sys
import logging
import subprocess
import tempfile

import boto3
import numpy as np
import soundfile as sf
import torch
import torchaudio

sys.path.insert(0, os.environ.get('LAMBDA_TASK_ROOT', os.path.dirname(__file__)))

from models.whisper import WhisperWrapper
from scripts.convert_output import get_timestamps, majority_filter

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

SAMPLE_RATE = 16000
WINDOW_SECONDS = 10
MODEL_PATH = os.path.join(
    os.environ.get('LAMBDA_TASK_ROOT', os.path.dirname(__file__)),
    'whisper-base_rank8_pretrained_50k.pt'
)

_model = None


def _load_model():
    global _model
    if _model is None:
        logger.info('Loading WhisperWrapper (CPU)...')
        m = WhisperWrapper()
        m.backbone_model.encoder.embed_positions = (
            m.backbone_model.encoder.embed_positions.from_pretrained(
                m.embed_positions[:500]
            )
        )
        m.load_state_dict(torch.load(MODEL_PATH, map_location='cpu'))
        m.eval()
        _model = m
        logger.info('Model loaded.')
    return _model


def _download_audio(s3_bucket: str, s3_key: str) -> bytes:
    s3 = boto3.client('s3')
    resp = s3.get_object(Bucket=s3_bucket, Key=s3_key)
    return resp['Body'].read()


def _to_16k_wav(audio_bytes: bytes, ext: str) -> str:
    """Convert arbitrary audio bytes to 16 kHz mono WAV via ffmpeg.
    Returns the path to the temporary WAV file — caller must delete it."""
    with tempfile.NamedTemporaryFile(suffix=f'.{ext}', delete=False) as src:
        src.write(audio_bytes)
        src_path = src.name
    dst_path = src_path.replace(f'.{ext}', '_16k.wav')
    try:
        subprocess.run(
            ['ffmpeg', '-y', '-i', src_path,
             '-ar', str(SAMPLE_RATE), '-ac', '1', '-f', 'wav', dst_path],
            check=True, capture_output=True
        )
    finally:
        os.unlink(src_path)
    return dst_path


def _load_waveform(wav_path: str) -> torch.Tensor:
    """Return [1, N] float32 tensor at 16 kHz from a WAV file path."""
    data, sr = sf.read(wav_path, dtype='float32')
    waveform = torch.from_numpy(data).unsqueeze(0) if data.ndim == 1 else torch.from_numpy(data.T)
    if sr != SAMPLE_RATE:
        waveform = torchaudio.functional.resample(waveform, sr, SAMPLE_RATE)
    if waveform.size(0) > 1:
        waveform = torch.mean(waveform, dim=0, keepdim=True)
    return waveform.float()


def _best_window_start(segments: list, audio_duration: float) -> float:
    """Return start of 10s window with maximum speech coverage for these segments."""
    best_start = max(0.0, segments[0]['start'] - 0.5) if segments else 0.0
    best_coverage = 0.0

    for seg in segments:
        w_start = max(0.0, seg['start'] - 0.5)
        w_end = w_start + WINDOW_SECONDS
        if w_end > audio_duration:
            w_start = max(0.0, audio_duration - WINDOW_SECONDS)
            w_end = audio_duration

        coverage = 0.0
        for s in segments:
            ov = min(s['end'], w_end) - max(s['start'], w_start)
            if ov > 0:
                coverage += ov

        if coverage > best_coverage:
            best_coverage = coverage
            best_start = w_start

    return best_start


def _classify_window(
    waveform: torch.Tensor,
    window_start: float,
    speaker_segments: list,
    model: WhisperWrapper,
) -> tuple:
    """
    Extract 10s clip, run model, intersect output with speaker's utterances.
    Returns ('adult'|'child'|'unknown', confidence 0-1).
    """
    sr = SAMPLE_RATE
    s0 = int(window_start * sr)
    s1 = int((window_start + WINDOW_SECONDS) * sr)
    window = waveform[:, s0:s1]

    # Whisper's feature extractor always expects 30s (480000 samples) of input.
    # Pad with silence so the encoder sees 30s; only the first 10s carries real speech.
    target_len = 30 * sr
    if window.size(1) < target_len:
        pad = torch.zeros(1, target_len - window.size(1))
        window = torch.cat([window, pad], dim=1)

    with torch.no_grad():
        pred = model.forward_eval(window)
    pred = majority_filter(pred)
    child_segs, adult_segs, _ = get_timestamps(pred)

    # Intersect model output with this speaker's utterances inside the window
    child_t = 0.0
    adult_t = 0.0
    for utt in speaker_segments:
        rel_s = max(0.0, utt['start'] - window_start)
        rel_e = min(float(WINDOW_SECONDS), utt['end'] - window_start)
        if rel_e <= rel_s:
            continue
        for cs, ce in child_segs:
            ov = min(rel_e, ce) - max(rel_s, cs)
            if ov > 0:
                child_t += ov
        for as_, ae in adult_segs:
            ov = min(rel_e, ae) - max(rel_s, as_)
            if ov > 0:
                adult_t += ov

    # Fallback: use dominant label in the full window
    if child_t + adult_t < 0.05:
        tc = sum(e - s for s, e in child_segs)
        ta = sum(e - s for s, e in adult_segs)
        if tc + ta < 0.05:
            return 'unknown', 0.0
        child_t, adult_t = tc, ta

    total = child_t + adult_t
    if child_t > adult_t:
        return 'child', round(child_t / total, 3)
    return 'adult', round(adult_t / total, 3)


def classify_speakers(s3_bucket: str, s3_key: str, speakers: list) -> dict:
    """
    Classify each speaker as 'adult' or 'child' using acoustic features.

    speakers: [{"id": "speaker_0", "segments": [{"start": 1.2, "end": 3.5}, ...]}, ...]
    Returns: {"speaker_0": {"role": "adult", "confidence": 0.88}, ...}
    """
    model = _load_model()

    ext = s3_key.rsplit('.', 1)[-1].lower() if '.' in s3_key else 'm4a'
    logger.info(f'Downloading {s3_key} from {s3_bucket}...')
    audio_bytes = _download_audio(s3_bucket, s3_key)

    logger.info('Converting to 16 kHz WAV...')
    wav_path = _to_16k_wav(audio_bytes, ext)
    try:
        waveform = _load_waveform(wav_path)
    finally:
        if os.path.exists(wav_path):
            os.unlink(wav_path)
    duration = waveform.size(1) / SAMPLE_RATE
    logger.info(f'Audio duration: {duration:.1f}s')

    results = {}
    for speaker in speakers:
        sid = speaker['id']
        segs = speaker.get('segments', [])
        if not segs:
            results[sid] = {'role': 'unknown', 'confidence': 0.0}
            continue
        w_start = _best_window_start(segs, duration)
        role, conf = _classify_window(waveform, w_start, segs, model)
        results[sid] = {'role': role, 'confidence': conf}
        logger.info(f'  {sid}: {role} (conf={conf:.2f}, window_start={w_start:.1f}s)')

    return results
