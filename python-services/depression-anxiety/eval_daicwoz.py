"""
Evaluate the Kintsugi DAM model against the DAIC-WOZ benchmark.

For each participant, isolates participant-only speech using the DAIC-WOZ
transcript's own speaker labels (the dataset ships ground-truth turn
boundaries, so no diarization step is needed here — unlike real PCIT
sessions, see classifier.py), runs it through the DAM pipeline, and compares
the predicted depression severity against the dataset's PHQ-8 ground truth.

Setup (same local pipeline as test_classifier.py, plus eval-only deps):
  python3.11 -m venv dam-venv
  dam-venv/bin/pip install torch torchaudio transformers peft soundfile \
      pandas scikit-learn boto3 huggingface_hub

  dam-venv/bin/python3 -c "
  from huggingface_hub import snapshot_download
  snapshot_download(repo_id='KintsugiHealth/dam', local_dir='/tmp/dam-task',
      allow_patterns=['pipeline.py', 'model.py', 'config.py', 'featex.py', 'dam3.1.ckpt'])
  "

Expected DAIC-WOZ layout (as extracted from the official <id>_P.zip files):
  <data-dir>/<id>_P/<id>_AUDIO.wav
  <data-dir>/<id>_P/<id>_TRANSCRIPT.csv   (columns: start_time, stop_time, speaker, value)

Labels: point --labels at one or more of the AVEC2017 split CSVs
(train_split_Depression_AVEC2017.csv, dev_split_Depression_AVEC2017.csv,
full_test_split.csv). Column names differ slightly between splits
(PHQ8_Binary/PHQ8_Score vs PHQ_Binary/PHQ_Score) — both are handled.

Usage:
  LAMBDA_TASK_ROOT=/tmp/dam-task dam-venv/bin/python3 \
    python-services/depression-anxiety/eval_daicwoz.py \
    --data-dir /path/to/daic-woz \
    --labels train_split_Depression_AVEC2017.csv dev_split_Depression_AVEC2017.csv \
    --out results.csv

Re-running with the same --out resumes: participants already present in that
file are skipped, and each new result is flushed to disk immediately so a
crash mid-run only costs the in-flight participant.
"""
import argparse
import csv
import os
import sys
import time

import numpy as np
import pandas as pd
import soundfile as sf
import torch
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

LAMBDA_TASK_ROOT = os.environ.get('LAMBDA_TASK_ROOT')
if not LAMBDA_TASK_ROOT:
    print('ERROR: set LAMBDA_TASK_ROOT (see this script\'s docstring for setup)')
    sys.exit(1)
sys.path.insert(0, LAMBDA_TASK_ROOT)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from classifier import _load_pipeline, SAMPLE_RATE  # noqa: E402

PID_COLUMNS = ('Participant_ID', 'participant_ID', 'participant_id')
BINARY_COLUMNS = ('PHQ8_Binary', 'PHQ_Binary')
SCORE_COLUMNS = ('PHQ8_Score', 'PHQ_Score')


def _first_present(columns, candidates):
    for c in candidates:
        if c in columns:
            return c
    raise ValueError(f'None of {candidates} found in columns {list(columns)}')


def load_labels(label_paths):
    """Merge one or more AVEC2017 split CSVs into {participant_id: {phq_binary, phq_score}}."""
    labels = {}
    for path in label_paths:
        df = pd.read_csv(path)
        pid_col = _first_present(df.columns, PID_COLUMNS)
        bin_col = _first_present(df.columns, BINARY_COLUMNS)
        score_col = _first_present(df.columns, SCORE_COLUMNS)
        for _, row in df.iterrows():
            pid = str(int(row[pid_col]))
            labels[pid] = {
                'phq_binary': int(row[bin_col]),
                'phq_score': int(row[score_col]),
            }
    return labels


def find_participant_dir(data_dir, pid):
    for candidate in (f'{pid}_P', pid):
        path = os.path.join(data_dir, candidate)
        if os.path.isdir(path):
            return path
    return None


def extract_participant_audio(participant_dir, pid):
    """Concatenate only the 'Participant' turns from the transcript into one waveform.

    Returns (1 x num_samples float32 tensor, duration_seconds) or None if the
    audio/transcript files are missing or no participant turns are found —
    a handful of DAIC-WOZ IDs are known to have unusable session files.
    """
    audio_path = os.path.join(participant_dir, f'{pid}_AUDIO.wav')
    transcript_path = os.path.join(participant_dir, f'{pid}_TRANSCRIPT.csv')
    if not os.path.isfile(audio_path) or not os.path.isfile(transcript_path):
        return None

    transcript = pd.read_csv(transcript_path, sep='\t' if _is_tsv(transcript_path) else ',')
    transcript.columns = [c.strip().lower() for c in transcript.columns]
    if 'speaker' not in transcript.columns:
        return None
    participant_turns = transcript[transcript['speaker'].astype(str).str.strip().str.lower() == 'participant']
    if participant_turns.empty:
        return None

    data, sr = sf.read(audio_path, dtype='float32')
    if data.ndim > 1:
        data = data.mean(axis=1)
    if sr != SAMPLE_RATE:
        raise ValueError(f'{audio_path}: expected {SAMPLE_RATE} Hz, got {sr} Hz')

    chunks = []
    for _, turn in participant_turns.iterrows():
        start = int(float(turn['start_time']) * sr)
        stop = int(float(turn['stop_time']) * sr)
        if stop > start:
            chunks.append(data[start:stop])
    if not chunks:
        return None

    waveform = torch.from_numpy(np.concatenate(chunks))
    duration = waveform.shape[-1] / sr
    return waveform.unsqueeze(0), duration


def _is_tsv(path):
    with open(path, 'r') as f:
        first_line = f.readline()
    return '\t' in first_line


def depression_to_binary(dam_depression):
    """DAM class 0 = none; 1/2 = mild-moderate/severe -> treat as PHQ8_Binary-positive.

    Approximate: DAM's buckets are PHQ-9 thresholds (9-item scale) but DAIC-WOZ
    ground truth is PHQ-8 (8-item, excludes the suicidal-ideation item), so the
    cutoffs don't line up exactly. Close enough for a screening-accuracy check.
    """
    return 1 if dam_depression >= 1 else 0


def load_done_ids(out_path):
    if not os.path.isfile(out_path):
        return set()
    with open(out_path, 'r') as f:
        return {row['participant_id'] for row in csv.DictReader(f)}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--data-dir', required=True, help='Directory containing <id>_P/ participant folders')
    parser.add_argument('--labels', nargs='+', required=True, help='One or more AVEC2017 split label CSVs')
    parser.add_argument('--out', default='daicwoz_eval_results.csv', help='Per-participant results CSV (resumable)')
    parser.add_argument('--limit', type=int, default=None, help='Stop after N participants (for a quick smoke run)')
    args = parser.parse_args()

    labels = load_labels(args.labels)
    print(f'Loaded {len(labels)} labeled participants from {len(args.labels)} split file(s).')

    done_ids = load_done_ids(args.out)
    if done_ids:
        print(f'Resuming: {len(done_ids)} participants already in {args.out}, skipping those.')

    pipeline = _load_pipeline()

    fieldnames = ['participant_id', 'phq8_score', 'phq8_binary', 'dam_depression',
                  'dam_depression_binary', 'dam_anxiety', 'duration_sec', 'correct']
    write_header = not os.path.isfile(args.out)
    out_f = open(args.out, 'a', newline='')
    writer = csv.DictWriter(out_f, fieldnames=fieldnames)
    if write_header:
        writer.writeheader()

    pending = [pid for pid in sorted(labels, key=int) if pid not in done_ids]
    if args.limit:
        pending = pending[:args.limit]

    for i, pid in enumerate(pending, 1):
        participant_dir = find_participant_dir(args.data_dir, pid)
        if participant_dir is None:
            print(f'[{i}/{len(pending)}] {pid}: SKIP (no directory found)')
            continue

        try:
            extracted = extract_participant_audio(participant_dir, pid)
        except Exception as e:
            print(f'[{i}/{len(pending)}] {pid}: SKIP (extraction failed: {e})')
            continue
        if extracted is None:
            print(f'[{i}/{len(pending)}] {pid}: SKIP (no participant-only audio)')
            continue
        waveform, duration = extracted

        t = time.time()
        result = pipeline.run_on_audio(waveform, quantize=True)
        elapsed = time.time() - t

        dam_depression = result.get('depression')
        dam_binary = depression_to_binary(dam_depression)
        truth = labels[pid]
        correct = int(dam_binary == truth['phq_binary'])

        writer.writerow({
            'participant_id': pid,
            'phq8_score': truth['phq_score'],
            'phq8_binary': truth['phq_binary'],
            'dam_depression': dam_depression,
            'dam_depression_binary': dam_binary,
            'dam_anxiety': result.get('anxiety'),
            'duration_sec': round(duration, 1),
            'correct': correct,
        })
        out_f.flush()

        mark = '✅' if correct else '❌'
        print(f'[{i}/{len(pending)}] {pid}: dam={dam_depression} (bin={dam_binary}) '
              f'truth_bin={truth["phq_binary"]} {mark}  ({duration:.0f}s audio, {elapsed:.1f}s inference)')

    out_f.close()
    print(f'\nDone. Results written to {args.out}')
    _print_summary(args.out)


def _print_summary(out_path):
    df = pd.read_csv(out_path)
    if df.empty:
        print('No results to summarize.')
        return
    y_true = df['phq8_binary']
    y_pred = df['dam_depression_binary']
    print('\n── Summary (depression, binary) ──────────────────────────')
    print(f'  N = {len(df)}')
    print(f'  Accuracy: {accuracy_score(y_true, y_pred):.3f}')
    print('\n  Confusion matrix [rows=truth, cols=predicted], labels=[0,1]:')
    print(' ', confusion_matrix(y_true, y_pred, labels=[0, 1]))
    print('\n', classification_report(y_true, y_pred, labels=[0, 1], target_names=['not depressed', 'depressed']))


if __name__ == '__main__':
    main()
