import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createLesson, getLessons, LessonSummary } from '../api/adminApi';
import { CONTENT_V2_MODULES } from '../constants/contentV2Modules';

// Lightweight creation form — just enough to get a lesson ID assigned.
// Content/audio/images/video are added afterward in the Content V2 editor.
export default function LessonContentV2NewPage() {
  const navigate = useNavigate();

  const [module, setModule] = useState(CONTENT_V2_MODULES[0]);
  const [dayNumber, setDayNumber] = useState(1);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [allLessons, setAllLessons] = useState<LessonSummary[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLessons().then(setAllLessons).catch(console.error);
  }, []);

  // Auto-suggest the next open day number when the module changes.
  useEffect(() => {
    if (allLessons.length === 0) return;
    const maxDay = allLessons
      .filter((l) => l.module === module)
      .reduce((max, l) => Math.max(max, l.dayNumber), 0);
    setDayNumber(maxDay + 1);
  }, [allLessons, module]);

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const created = await createLesson(
        { module, dayNumber, title: title.trim(), subtitle: subtitle.trim() || undefined, shortDescription: '', objectives: [] },
        [],
        null
      );
      navigate(`/content-v2/${created.id}`, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to create lesson');
      setSaving(false);
    }
  };

  return (
    <div className="page editor-page">
      <div className="page-header">
        <div>
          <h1>New Content V2 Lesson</h1>
          <p className="page-subtitle">Creates the lesson record — add narration, script text, and media next.</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => navigate('/content-v2')}>Cancel</button>
          <button className="btn-primary" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating...' : 'Create & Continue'}
          </button>
        </div>
      </div>

      {error && <p style={{ color: '#ef4444', fontSize: 13, margin: '0 0 16px' }}>{error}</p>}

      <div className="editor-section">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
          <div className="form-group">
            <label>Module</label>
            <select value={module} onChange={(e) => setModule(e.target.value)}>
              {CONTENT_V2_MODULES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Day Number</label>
            <input
              type="number"
              min={1}
              value={dayNumber}
              onChange={(e) => setDayNumber(parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="form-group">
            <label>Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lesson title" />
          </div>
          <div className="form-group">
            <label>Subtitle (optional)</label>
            <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}
