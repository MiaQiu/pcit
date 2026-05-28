import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getCodingReviewDetail,
  saveUtteranceComment,
  submitCodingReview,
  CodingReviewDetail,
  ReviewUtterance,
} from '../api/adminApi';
import { useEnv, PROD_API_URL } from '../context/EnvContext';

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

function CommentCell({
  utterance,
  sessionId,
  opts,
  onSaved,
}: {
  utterance: ReviewUtterance;
  sessionId: string;
  opts: { baseUrl?: string; token?: string } | undefined;
  onSaved: (uttId: string, comment: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(utterance.adminComment ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await saveUtteranceComment(sessionId, utterance.id, value.trim(), opts);
      onSaved(utterance.id, value.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          rows={3}
          style={{ width: '100%', fontSize: 13, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', resize: 'vertical' }}
          autoFocus
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className="btn btn-sm" onClick={() => { setValue(utterance.adminComment ?? ''); setEditing(false); }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      {utterance.adminComment && (
        <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{utterance.adminComment}</span>
      )}
      <button
        className="btn btn-sm"
        style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        onClick={() => setEditing(true)}
      >
        {utterance.adminComment ? 'Edit' : '+ Comment'}
      </button>
    </div>
  );
}

export default function CodingReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { env, prodToken } = useEnv();
  const opts = env === 'prod' ? { baseUrl: PROD_API_URL, token: prodToken ?? undefined } : undefined;

  const [detail, setDetail] = useState<CodingReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getCodingReviewDetail(id, opts)
      .then(setDetail)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id, env, prodToken]);

  const handleCommentSaved = useCallback((uttId: string, comment: string) => {
    setDetail(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        utterances: prev.utterances.map(u => u.id === uttId ? { ...u, adminComment: comment || null } : u),
      };
    });
  }, []);

  async function handleSubmit() {
    if (!id) return;
    if (!window.confirm('Mark this session as reviewed?')) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitCodingReview(id, opts);
      navigate('/coding-review');
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  const session = detail?.session;
  const utterances = detail?.utterances ?? [];

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'flex-start' }}>
        <button className="btn btn-sm" onClick={() => navigate('/coding-review')}>← Back</button>
        <div>
          <h1 className="page-title" style={{ marginBottom: 2 }}>
            Coding Review
            {session && <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-light)', marginLeft: 12 }}>{session.id}</span>}
          </h1>
          {session && (
            <div style={{ fontSize: 13, color: 'var(--text-light)', display: 'flex', gap: 16 }}>
              <span className="mode-badge">{session.mode}</span>
              <span>{new Date(session.createdAt).toLocaleString()}</span>
              {session.codingReviewedAt && (
                <span className="badge badge-green">Reviewed {new Date(session.codingReviewedAt).toLocaleDateString()}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {loading && <div className="loading-state">Loading…</div>}
      {error && <div className="error-state">{error}</div>}

      {!loading && !error && detail && (
        <>
          <div className="table-container">
            <table className="data-table coding-review-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>#</th>
                  <th style={{ width: 90 }}>Speaker</th>
                  <th>Utterance</th>
                  <th style={{ width: 70 }}>Code</th>
                  <th style={{ width: 220 }}>Feedback</th>
                  <th style={{ width: 260 }}>Reference</th>
                  <th style={{ width: 200 }}>Assumption</th>
                  <th style={{ width: 240 }}>Comment</th>
                </tr>
              </thead>
              <tbody>
                {utterances.map(u => {
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
                      <td>{u.coding?.code ? <CodeBadge code={u.coding.code} /> : <span style={{ color: 'var(--text-light)' }}>—</span>}</td>
                      <td style={{ fontSize: 13 }}>{u.coding?.feedback || <span style={{ color: 'var(--text-light)' }}>—</span>}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-light)' }}>{u.coding?.reference || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-light)', fontStyle: u.coding?.assumption ? 'normal' : 'italic' }}>
                        {u.coding?.assumption || '—'}
                      </td>
                      <td>
                        {isAdult && (
                          <CommentCell
                            utterance={u}
                            sessionId={detail.session.id}
                            opts={opts}
                            onSaved={handleCommentSaved}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
            {session?.codingReviewedAt ? (
              <div className="badge badge-green" style={{ fontSize: 14, padding: '8px 16px' }}>
                Reviewed on {new Date(session.codingReviewedAt).toLocaleString()}
              </div>
            ) : (
              <button
                className="btn btn-primary"
                style={{ padding: '10px 28px', fontSize: 15 }}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Submitting…' : 'Submit Review'}
              </button>
            )}
            {submitError && <span style={{ color: 'var(--danger)', fontSize: 13 }}>{submitError}</span>}
          </div>
        </>
      )}
    </div>
  );
}
