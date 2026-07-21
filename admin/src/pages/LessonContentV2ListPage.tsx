import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLessons, LessonSummary, getBrandingImages, updateLearnHeader } from '../api/adminApi';

// Content V2 only applies to the new curriculum modules — older modules author
// content via segments on the existing Lessons page instead.
const CONTENT_V2_MODULES = ['WELCOME', 'POSITIVE_PLAY', 'CALM_DISCIPLINE', 'BIG_FEELINGS_TANTRUMS'];

export default function LessonContentV2ListPage() {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [headerLoading, setHeaderLoading] = useState(true);
  const [savingHeader, setSavingHeader] = useState(false);
  const [headerFeedback, setHeaderFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    getLessons()
      .then((data) => setLessons(data.filter((l) => CONTENT_V2_MODULES.includes(l.module))))
      .catch((err) => console.error('Failed to fetch lessons:', err))
      .finally(() => setLoading(false));

    getBrandingImages()
      .then((data) => {
        setTitle(data.learnTitle || '');
        setSubtitle(data.learnSubtitle || '');
      })
      .catch((err) => console.error('Failed to fetch learn header:', err))
      .finally(() => setHeaderLoading(false));
  }, []);

  const handleSaveHeader = async () => {
    setSavingHeader(true);
    setHeaderFeedback(null);
    try {
      await updateLearnHeader(title, subtitle);
      setHeaderFeedback({ type: 'success', message: 'Saved' });
    } catch (err: any) {
      setHeaderFeedback({ type: 'error', message: err.message || 'Failed to save' });
    } finally {
      setSavingHeader(false);
      setTimeout(() => setHeaderFeedback(null), 2000);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Content V2</h1>
          <p className="page-subtitle">Audio narration + formatted text for the new lesson viewer</p>
        </div>
      </div>

      <div className="settings-section">
        <h2>Learn Tab Header</h2>
        <p className="settings-description">
          Title and subtitle shown in the Learn tab's cover band, next to the cover image. Leave blank to use the default copy.
        </p>
        {headerLoading ? (
          <div className="loading-state">Loading...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nora Foundations"
              />
            </div>
            <div className="form-group">
              <label>Subtitle</label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Professor Yi-Chuen Chen: Ph.D., Clinical Child Psychologist"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn-primary" onClick={handleSaveHeader} disabled={savingHeader}>
                {savingHeader ? 'Saving...' : 'Save'}
              </button>
              {headerFeedback && (
                <span style={{ color: headerFeedback.type === 'success' ? '#16a34a' : '#ef4444', fontSize: 13 }}>
                  {headerFeedback.message}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading-state">Loading lessons...</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Module</th>
              <th>Day</th>
              <th>Title</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {lessons.map((l) => (
              <tr key={l.id} onClick={() => navigate(`/content-v2/${l.id}`)} className="clickable-row">
                <td className="cell-mono">{l.id}</td>
                <td>
                  <span className="module-badge" style={{ backgroundColor: l.backgroundColor }}>
                    {l.module}
                  </span>
                </td>
                <td>{l.dayNumber}</td>
                <td className="cell-title">{l.title}</td>
                <td className="cell-date">{new Date(l.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {lessons.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">No lessons found</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
