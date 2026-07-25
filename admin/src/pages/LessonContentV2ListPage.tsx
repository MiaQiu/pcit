import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLessons, deleteLesson, getModules, updateModule, LessonSummary, ModuleSummary, getBrandingImages, updateLearnHeader } from '../api/adminApi';
import { CONTENT_V2_MODULES } from '../constants/contentV2Modules';
import { LOCALES } from '../constants/locales';

export default function LessonContentV2ListPage() {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [headerLocale, setHeaderLocale] = useState('en');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [headerLoading, setHeaderLoading] = useState(true);
  const [savingHeader, setSavingHeader] = useState(false);
  const [headerFeedback, setHeaderFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [savingModuleKey, setSavingModuleKey] = useState<string | null>(null);
  const [moduleFeedback, setModuleFeedback] = useState<{ key: string; type: 'success' | 'error'; message: string } | null>(null);

  const loadLessons = () => {
    getLessons()
      .then((data) => setLessons(data.filter((l) => CONTENT_V2_MODULES.includes(l.module))))
      .catch((err) => console.error('Failed to fetch lessons:', err))
      .finally(() => setLoading(false));
  };

  const loadModules = () => {
    getModules()
      .then((data) => setModules(data.filter((m) => CONTENT_V2_MODULES.includes(m.key))))
      .catch((err) => console.error('Failed to fetch modules:', err))
      .finally(() => setModulesLoading(false));
  };

  useEffect(() => {
    loadLessons();
    loadModules();
  }, []);

  useEffect(() => {
    setHeaderLoading(true);
    getBrandingImages(headerLocale)
      .then((data) => {
        setTitle(data.learnTitle || '');
        setSubtitle(data.learnSubtitle || '');
      })
      .catch((err) => console.error('Failed to fetch learn header:', err))
      .finally(() => setHeaderLoading(false));
  }, [headerLocale]);

  const handleSaveHeader = async () => {
    setSavingHeader(true);
    setHeaderFeedback(null);
    try {
      await updateLearnHeader(title, subtitle, headerLocale);
      setHeaderFeedback({ type: 'success', message: 'Saved' });
    } catch (err: any) {
      setHeaderFeedback({ type: 'error', message: err.message || 'Failed to save' });
    } finally {
      setSavingHeader(false);
      setTimeout(() => setHeaderFeedback(null), 2000);
    }
  };

  const handleModuleFieldChange = (key: string, field: keyof ModuleSummary, value: string | number) => {
    setModules((prev) => prev.map((m) => (m.key === key ? { ...m, [field]: value } : m)));
  };

  const handleSaveModule = async (mod: ModuleSummary) => {
    setSavingModuleKey(mod.key);
    setModuleFeedback(null);
    try {
      await updateModule(mod.key, {
        title: mod.title,
        description: mod.description,
        displayOrder: mod.displayOrder,
        backgroundColor: mod.backgroundColor,
      });
      setModuleFeedback({ key: mod.key, type: 'success', message: 'Saved' });
    } catch (err: any) {
      setModuleFeedback({ key: mod.key, type: 'error', message: err.message || 'Failed to save' });
    } finally {
      setSavingModuleKey(null);
      setTimeout(() => setModuleFeedback(null), 2000);
    }
  };

  const handleDeleteLesson = async (e: React.MouseEvent, lesson: LessonSummary) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${lesson.title}" (${lesson.id})? This can't be undone.`)) return;

    setDeletingId(lesson.id);
    try {
      await deleteLesson(lesson.id);
      setLessons((prev) => prev.filter((l) => l.id !== lesson.id));
    } catch (err: any) {
      alert('Failed to delete lesson: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Content V2</h1>
          <p className="page-subtitle">Audio narration + formatted text for the new lesson viewer</p>
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => navigate('/content-v2/new')}>+ New Lesson</button>
        </div>
      </div>

      <div className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Learn Tab Header</h2>
          <select
            value={headerLocale}
            onChange={(e) => setHeaderLocale(e.target.value)}
            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db' }}
          >
            {LOCALES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
        <p className="settings-description">
          Title and subtitle shown in the Learn tab's cover band, next to the cover image, for the selected
          language. Leave blank to fall back to the English copy (or the built-in default if English is blank too).
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

      <div className="settings-section">
        <h2>Modules</h2>
        <p className="settings-description">
          Title, description, color, and order for the four Content V2 modules. Module keys themselves are fixed
          (adding a genuinely new module requires a code change) — this only edits how the existing ones display.
        </p>
        {modulesLoading ? (
          <div className="loading-state">Loading...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {modules.map((mod) => (
              <div key={mod.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', borderBottom: '1px solid #f3f4f6', paddingBottom: 16 }}>
                <div className="form-group" style={{ minWidth: 90 }}>
                  <label>Key</label>
                  <input type="text" value={mod.key} disabled style={{ background: '#f9fafb', color: '#9ca3af' }} />
                </div>
                <div className="form-group" style={{ minWidth: 160 }}>
                  <label>Title</label>
                  <input
                    type="text"
                    value={mod.title}
                    onChange={(e) => handleModuleFieldChange(mod.key, 'title', e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ minWidth: 220, flex: 1 }}>
                  <label>Description</label>
                  <input
                    type="text"
                    value={mod.description}
                    onChange={(e) => handleModuleFieldChange(mod.key, 'description', e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ minWidth: 80 }}>
                  <label>Order</label>
                  <input
                    type="number"
                    value={mod.displayOrder}
                    onChange={(e) => handleModuleFieldChange(mod.key, 'displayOrder', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="form-group" style={{ minWidth: 60 }}>
                  <label>Color</label>
                  <input
                    type="color"
                    value={mod.backgroundColor}
                    onChange={(e) => handleModuleFieldChange(mod.key, 'backgroundColor', e.target.value)}
                    style={{ padding: 2, height: 38 }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
                  <button
                    className="btn-secondary-sm"
                    onClick={() => handleSaveModule(mod)}
                    disabled={savingModuleKey === mod.key}
                  >
                    {savingModuleKey === mod.key ? 'Saving...' : 'Save'}
                  </button>
                  {moduleFeedback?.key === mod.key && (
                    <span style={{ color: moduleFeedback.type === 'success' ? '#16a34a' : '#ef4444', fontSize: 13 }}>
                      {moduleFeedback.message}
                    </span>
                  )}
                </div>
              </div>
            ))}
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
              <th></th>
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
                <td>
                  <button
                    className="btn-danger-sm"
                    onClick={(e) => handleDeleteLesson(e, l)}
                    disabled={deletingId === l.id}
                  >
                    {deletingId === l.id ? 'Deleting...' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
            {lessons.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state">No lessons found</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
