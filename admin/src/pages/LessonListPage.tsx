import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLessons, getModules, deleteLesson, createModule, updateModule, LessonSummary, ModuleSummary } from '../api/adminApi';

const LESSON_MODULES = [
  'FOUNDATION', 'EMOTIONS', 'COOPERATION', 'SIBLINGS', 'RELOCATION',
  'DIVORCE', 'DEVELOPMENT', 'PROCRASTINATION', 'PATIENCE', 'RESPONSIBILITY',
  'MEALS', 'AGGRESSION', 'CONFLICT', 'FOCUS', 'DEFIANCE', 'SAFETY',
  'SCREENS', 'SEPARATION', 'SPECIAL',
];

export default function LessonListPage() {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [loading, setLoading] = useState(true);
  const [moduleModal, setModuleModal] = useState<{ mode: 'add' } | { mode: 'edit'; module: ModuleSummary } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [lessonData, moduleData] = await Promise.all([
        getLessons(selectedModule || undefined),
        getModules(),
      ]);
      setLessons(lessonData);
      setModules(moduleData);
    } catch (err) {
      console.error('Failed to fetch lessons:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedModule]);

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await deleteLesson(id);
      setLessons((prev) => prev.filter((l) => l.id !== id));
    } catch (err: any) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const handleModuleSaved = () => {
    setModuleModal(null);
    fetchData();
  };

  const existingKeys = new Set(modules.map((m) => m.key));

  // Find the currently selected module object for the edit button
  const selectedModuleObj = modules.find((m) => m.key === selectedModule);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Lessons</h1>
          <p className="page-subtitle">{lessons.length} lessons total</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => setModuleModal({ mode: 'add' })}>
            + Add Module
          </button>
          <button className="btn-primary" onClick={() => navigate('/lessons/new')}>
            + New Lesson
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <select
          value={selectedModule}
          onChange={(e) => setSelectedModule(e.target.value)}
        >
          <option value="">All Modules</option>
          {modules.map((m) => (
            <option key={m.key} value={m.key}>
              {m.title} ({m.lessonCount})
            </option>
          ))}
        </select>
        {selectedModuleObj && (
          <button
            className="btn-secondary-sm"
            style={{ marginLeft: 8 }}
            onClick={() => setModuleModal({ mode: 'edit', module: selectedModuleObj })}
          >
            Edit Module
          </button>
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
              <th>Segments</th>
              <th>Quiz</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lessons.map((l) => (
              <tr key={l.id} onClick={() => navigate(`/lessons/${l.id}`)} className="clickable-row">
                <td className="cell-mono">{l.id}</td>
                <td>
                  <span className="module-badge" style={{ backgroundColor: l.backgroundColor }}>
                    {l.module}
                  </span>
                </td>
                <td>{l.dayNumber}</td>
                <td className="cell-title">{l.title}</td>
                <td>{l.segmentCount}</td>
                <td>{l.hasQuiz ? 'Yes' : 'No'}</td>
                <td className="cell-date">{new Date(l.updatedAt).toLocaleDateString()}</td>
                <td>
                  <button
                    className="btn-danger-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(l.id, l.title);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {lessons.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-state">No lessons found</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {moduleModal && (
        <ModuleModal
          mode={moduleModal.mode}
          module={moduleModal.mode === 'edit' ? moduleModal.module : undefined}
          existingKeys={existingKeys}
          onClose={() => setModuleModal(null)}
          onSaved={handleModuleSaved}
        />
      )}
    </div>
  );
}

function ModuleModal({
  mode,
  module: editModule,
  existingKeys,
  onClose,
  onSaved,
}: {
  mode: 'add' | 'edit';
  module?: ModuleSummary;
  existingKeys: Set<string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [key, setKey] = useState(editModule?.key || '');
  const [title, setTitle] = useState(editModule?.title || '');
  const [shortName, setShortName] = useState(editModule?.shortName || '');
  const [description, setDescription] = useState('');
  const [displayOrder, setDisplayOrder] = useState(editModule?.displayOrder ?? '');
  const [backgroundColor, setBackgroundColor] = useState(editModule?.backgroundColor || '#E4E4FF');
  const [saving, setSaving] = useState(false);

  const isEdit = mode === 'edit';
  const availableKeys = LESSON_MODULES.filter((k) => !existingKeys.has(k));

  const handleSubmit = async () => {
    if (!isEdit && !key) { alert('Select a module key'); return; }
    if (!title.trim()) { alert('Title is required'); return; }
    if (!shortName.trim()) { alert('Short name is required'); return; }

    setSaving(true);
    try {
      if (isEdit) {
        await updateModule(key, {
          title,
          shortName,
          description,
          displayOrder: displayOrder !== '' ? Number(displayOrder) : undefined,
          backgroundColor,
        });
      } else {
        await createModule({
          key,
          title,
          shortName,
          description,
          displayOrder: displayOrder !== '' ? Number(displayOrder) : undefined,
          backgroundColor,
        });
      }
      onSaved();
    } catch (err: any) {
      alert(`Failed to ${isEdit ? 'update' : 'create'} module: ` + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Module' : 'Add Module'}</h2>
          <button className="btn-remove" onClick={onClose}>&times;</button>
        </div>

        <div className="form-group">
          <label>Module Key</label>
          {isEdit ? (
            <input type="text" value={key} disabled />
          ) : availableKeys.length > 0 ? (
            <select value={key} onChange={(e) => {
              const v = e.target.value;
              setKey(v);
              if (v && !title) {
                const auto = v.charAt(0) + v.slice(1).toLowerCase();
                setTitle(auto);
                setShortName(auto);
              }
            }}>
              <option value="">Select a key...</option>
              {availableKeys.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          ) : (
            <p className="form-hint">All module keys already have records.</p>
          )}
        </div>

        <div className="form-group">
          <label>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Managing Emotions"
          />
        </div>

        <div className="form-group">
          <label>Short Name</label>
          <input
            type="text"
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            placeholder="e.g. Emotions"
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Module description"
            rows={3}
          />
        </div>

        <div className="form-row">
          <div className="form-group" style={{ maxWidth: 120 }}>
            <label>Display Order</label>
            <input
              type="number"
              min={1}
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              placeholder="Auto"
            />
          </div>
          <div className="form-group">
            <label>Background Color</label>
            <div className="color-input">
              <input
                type="color"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
              />
              <input
                type="text"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving || (!isEdit && !key)}>
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Module'}
          </button>
        </div>
      </div>
    </div>
  );
}
