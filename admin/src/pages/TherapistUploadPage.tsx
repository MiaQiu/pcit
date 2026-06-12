import { useState, useRef, useCallback } from 'react';
import { uploadTherapistSession, getTherapistSession, TherapistSessionStatus, ReviewUtterance } from '../api/adminApi';

const CODE_COLORS: Record<string, string> = {
  LP1: '#10b981', LP2: '#10b981', LP3: '#10b981', LP4: '#10b981', LP: '#10b981',
  BD: '#3b82f6',
  RF: '#8b5cf6', RQ: '#8b5cf6',
  DC: '#f59e0b', IC: '#f59e0b',
  Q: '#f59e0b',
  NTA: '#ef4444',
  UP: '#f97316',
  AK: '#9ca3af', ID: '#9ca3af', TC: '#9ca3af',
};

function CodeBadge({ code }: { code: string }) {
  const color = CODE_COLORS[code] ?? '#6b7280';
  return (
    <span style={{
      display: 'inline-block',
      background: color + '22',
      color,
      border: `1px solid ${color}55`,
      borderRadius: 4,
      padding: '1px 7px',
      fontWeight: 700,
      fontSize: 12,
      fontFamily: 'monospace',
      whiteSpace: 'nowrap',
    }}>
      {code}
    </span>
  );
}

type Step = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

export default function TherapistUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'CDI' | 'PDI'>('CDI');
  const [step, setStep] = useState<Step>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<TherapistSessionStatus | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const handleFileChange = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setStep('idle');
    setErrorMsg(null);
    setResult(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileChange(dropped);
  }, []);

  const handleAnalyze = async () => {
    if (!file) return;
    stopPolling();
    setStep('uploading');
    setErrorMsg(null);
    setResult(null);

    try {
      const { sessionId } = await uploadTherapistSession(file, mode, 300);
      setStep('processing');

      pollRef.current = setInterval(async () => {
        try {
          const data = await getTherapistSession(sessionId);
          if (data.analysisStatus === 'COMPLETED') {
            stopPolling();
            setResult(data);
            setStep('done');
          } else if (data.analysisStatus === 'FAILED') {
            stopPolling();
            setErrorMsg(data.analysisError || 'Analysis failed. Please try again.');
            setStep('error');
          }
        } catch (err: any) {
          stopPolling();
          setErrorMsg(err.message || 'Failed to check status');
          setStep('error');
        }
      }, 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Upload failed');
      setStep('error');
    }
  };

  const handleReset = () => {
    stopPolling();
    setFile(null);
    setStep('idle');
    setErrorMsg(null);
    setResult(null);
  };

  const utterances: ReviewUtterance[] = result?.utterances ?? [];

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Upload & Analyze</h1>
          <p className="page-subtitle">Upload a parent-child play session recording to get PCIT coding results</p>
        </div>
      </div>

      {/* Upload form — hidden once we have results */}
      {step !== 'done' && (
        <div style={{ maxWidth: 600, marginBottom: 32 }}>
          {/* Drop zone */}
          <div
            className={`upload-dropzone${dragging ? ' dragging' : ''}${file ? ' has-file' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*"
              style={{ display: 'none' }}
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎙️</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{file.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 4 }}>
                  {(file.size / 1024 / 1024).toFixed(1)} MB · Click to change
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-light)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Drop audio or video file here</div>
                <div style={{ fontSize: 13 }}>or click to browse · MP3, M4A, MP4, MOV, WAV, WebM</div>
              </div>
            )}
          </div>

          {/* Mode selector */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-light)' }}>Session mode:</span>
            {(['CDI', 'PDI'] as const).map(m => (
              <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
                <input
                  type="radio"
                  name="mode"
                  value={m}
                  checked={mode === m}
                  onChange={() => setMode(m)}
                />
                {m}
              </label>
            ))}
          </div>

          {/* Status / action */}
          {step === 'idle' && (
            <button
              className="btn btn-primary"
              style={{ marginTop: 20 }}
              onClick={handleAnalyze}
              disabled={!file}
            >
              Analyze Recording
            </button>
          )}

          {step === 'uploading' && (
            <div className="loading-state" style={{ marginTop: 20 }}>Uploading file…</div>
          )}

          {step === 'processing' && (
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="loading-spinner" />
              <span style={{ fontSize: 14, color: 'var(--text-light)' }}>
                Transcribing and coding — this typically takes 2–5 minutes…
              </span>
            </div>
          )}

          {step === 'error' && (
            <div style={{ marginTop: 20 }}>
              <div className="error-state">{errorMsg}</div>
              <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={handleReset}>
                Try Again
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {step === 'done' && result && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div>
              <span className="badge badge-green">Analysis Complete</span>
              <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--text-light)' }}>
                {result.session.mode} · {new Date(result.session.createdAt).toLocaleString()}
              </span>
            </div>
            <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={handleReset}>
              ← New Upload
            </button>
          </div>

          <div className="table-container">
            <table className="data-table coding-review-table">
              <thead>
                <tr>
                  <th style={{ width: 50 }}>#</th>
                  <th style={{ width: 90 }}>Speaker</th>
                  <th>Utterance</th>
                  <th style={{ width: 70 }}>Code</th>
                  <th style={{ width: 220 }}>Feedback</th>
                  <th style={{ width: 260 }}>Reference</th>
                  <th style={{ width: 200 }}>Assumption</th>
                </tr>
              </thead>
              <tbody>
                {utterances.map((u) => {
                  const isAdult = u.role === 'adult';
                  return (
                    <tr key={u.id} className={isAdult ? '' : 'child-row'}>
                      <td style={{ color: 'var(--text-light)', fontSize: 12 }}>{u.order + 1}</td>
                      <td>
                        <span className={`speaker-badge ${isAdult ? 'speaker-adult' : 'speaker-child'}`}>
                          {isAdult ? 'Parent' : 'Child'}
                        </span>
                      </td>
                      <td style={{ fontSize: 14 }}>{u.text}</td>
                      <td>
                        {u.coding?.code
                          ? <CodeBadge code={u.coding.code} />
                          : <span style={{ color: 'var(--text-light)' }}>—</span>}
                      </td>
                      <td style={{ fontSize: 13 }}>{u.coding?.feedback || <span style={{ color: 'var(--text-light)' }}>—</span>}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-light)' }}>{u.coding?.reference || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-light)', fontStyle: u.coding?.assumption ? 'normal' : 'italic' }}>
                        {u.coding?.assumption || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
