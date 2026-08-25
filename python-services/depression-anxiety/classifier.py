"""
Depression/anxiety screening via Kintsugi Health's DAM model.
Downloads session audio from S3, converts it to 16 kHz mono WAV, and runs it
through the Whisper-based DAM pipeline to produce depression/anxiety scores.
"""
import os
import sys
import logging
import subprocess
import tempfile

import boto3
import soundfile as sf
import torch

sys.path.insert(0, os.environ.get('LAMBDA_TASK_ROOT', os.path.dirname(__file__)))

from pipeline import Pipeline

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

SAMPLE_RATE = 16000
# Per the model card: shorter clips (post voice-activity-detection) reduce prediction accuracy.
MIN_RECOMMENDED_SECONDS = 30

_pipeline = None


def _load_pipeline() -> Pipeline:
    global _pipeline
    if _pipeline is None:
        logger.info('Loading DAM pipeline (CPU)...')
        _pipeline = Pipeline()
        logger.info('Pipeline loaded.')
    return _pipeline


def _download_audio(s3_bucket: str, s3_key: str) -> bytes:
    s3 = boto3.client('s3')
    return s3.get_object(Bucket=s3_bucket, Key=s3_key)['Body'].read()


def _to_16k_mono_wav(audio_bytes: bytes, ext: str) -> str:
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
    """Return a 1 x num_samples float32 tensor at 16 kHz from a mono WAV file.

    Reads via soundfile rather than DAM's own load_audio()/torchaudio.load(),
    since newer torchaudio versions require the optional torchcodec package
    (and its FFmpeg shared libs) to decode audio — soundfile has no such
    dependency and the file is already 16 kHz mono from the ffmpeg step above.
    """
    data, sr = sf.read(wav_path, dtype='float32')
    if data.ndim > 1:
        data = data.mean(axis=1)
    if sr != SAMPLE_RATE:
        raise ValueError(f'Expected {SAMPLE_RATE} Hz WAV, got {sr} Hz')
    return torch.from_numpy(data).unsqueeze(0)


def run_dam(s3_bucket: str, s3_key: str, quantize: bool = True) -> dict:
    """
    Run the DAM model on session audio stored in S3.

    Returns: {"depression": int|float, "anxiety": int|float}
    """
    pipeline = _load_pipeline()

    ext = s3_key.rsplit('.', 1)[-1].lower() if '.' in s3_key else 'm4a'
    logger.info(f'Downloading {s3_key} from {s3_bucket}...')
    audio_bytes = _download_audio(s3_bucket, s3_key)

    logger.info('Converting to 16 kHz mono WAV...')
    wav_path = _to_16k_mono_wav(audio_bytes, ext)
    try:
        duration = sf.info(wav_path).duration
        if duration < MIN_RECOMMENDED_SECONDS:
            logger.warning(
                f'Audio is only {duration:.1f}s; model card recommends '
                f'>= {MIN_RECOMMENDED_SECONDS}s post-VAD for reliable scores.'
            )
        waveform = _load_waveform(wav_path)
        # Pipeline.run_on_audio() batches every 30s chunk of the clip into one
        # forward pass and never wraps it in no_grad(), so without this the
        # autograd graph retains every intermediate activation for a backward
        # pass that never happens — roughly doubling peak memory for nothing.
        with torch.no_grad():
            result = pipeline.run_on_audio(waveform, quantize=quantize)
    finally:
        os.unlink(wav_path)

    logger.info(f'DAM result: {result}')
    return result
