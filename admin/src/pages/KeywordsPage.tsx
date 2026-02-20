import { useState, useEffect, useCallback } from 'react';
import { getKeywords, createKeyword, updateKeyword, deleteKeyword, Keyword } from '../api/adminApi';

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: 'add' } | { mode: 'edit'; keyword: Keyword } | null>(null);

  const fetchKeywords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getKeywords(search || undefined);
      setKeywords(data);
    } catch (err) {
      console.error('Failed to fetch keywords:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchKeywords, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchKeywords, search]);

  const handleDelete = async (id: string, term: string) => {
    if (!window.confirm(`Delete keyword "${term}"? This cannot be undone.`)) return;
    try {
      await deleteKeyword(id);
      setKeywords((prev) => prev.filter((k) => k.id !== id));
    } catch (err: any) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const handleSaved = () => {
    setModal(null);
    fetchKeywords();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Keywords</h1>
          <p className="page-subtitle">{keywords.length} keywords</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ mode: 'add' })}>
          + Add Keyword
        </button>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search terms or definitions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 280 }}
        />
      </div>

      {loading ? (
        <div className="loading-state">Loading keywords...</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Term</th>
              <th>Definition</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {keywords.map((k) => (
              <tr key={k.id}>
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{k.term}</td>
                <td className="cell-definition">{k.definition}</td>
                <td className="cell-date">{new Date(k.updatedAt).toLocaleDateString()}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="btn-secondary-sm"
                    style={{ marginRight: 6 }}
                    onClick={() => setModal({ mode: 'edit', keyword: k })}
                  >
                    Edit
                  </button>
                  <button className="btn-danger-sm" onClick={() => handleDelete(k.id, k.term)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {keywords.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-state">
                  {search ? 'No keywords match your search.' : 'No keywords yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {modal && (
        <KeywordModal
          mode={modal.mode}
          keyword={modal.mode === 'edit' ? modal.keyword : undefined}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function KeywordModal({
  mode,
  keyword,
  onClose,
  onSaved,
}: {
  mode: 'add' | 'edit';
  keyword?: Keyword;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [term, setTerm] = useState(keyword?.term || '');
  const [definition, setDefinition] = useState(keyword?.definition || '');
  const [saving, setSaving] = useState(false);

  const isEdit = mode === 'edit';

  const handleSubmit = async () => {
    if (!term.trim()) { alert('Term is required'); return; }
    if (!definition.trim()) { alert('Definition is required'); return; }

    setSaving(true);
    try {
      if (isEdit && keyword) {
        await updateKeyword(keyword.id, term, definition);
      } else {
        await createKeyword(term, definition);
      }
      onSaved();
    } catch (err: any) {
      alert(`Failed to ${isEdit ? 'update' : 'create'} keyword: ` + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Keyword' : 'Add Keyword'}</h2>
          <button className="btn-remove" onClick={onClose}>&times;</button>
        </div>

        <div className="form-group">
          <label>Term</label>
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="e.g. Attachment Theory"
            autoFocus
          />
        </div>

        <div className="form-group">
          <label>Definition</label>
          <textarea
            value={definition}
            onChange={(e) => setDefinition(e.target.value)}
            placeholder="Write a clear, parent-friendly definition..."
            rows={6}
          />
          <p className="form-hint">{definition.length} chars — aim for 50–300 words</p>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Keyword'}
          </button>
        </div>
      </div>
    </div>
  );
}
