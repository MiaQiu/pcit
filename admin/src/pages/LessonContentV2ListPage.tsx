import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLessons, LessonSummary } from '../api/adminApi';

// Content V2 only applies to the new curriculum modules — older modules author
// content via segments on the existing Lessons page instead.
const CONTENT_V2_MODULES = ['WELCOME', 'POSITIVE_PLAY', 'CALM_DISCIPLINE', 'BIG_FEELINGS_TANTRUMS'];

export default function LessonContentV2ListPage() {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLessons()
      .then((data) => setLessons(data.filter((l) => CONTENT_V2_MODULES.includes(l.module))))
      .catch((err) => console.error('Failed to fetch lessons:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Content V2</h1>
          <p className="page-subtitle">Audio narration + formatted text for the new lesson viewer</p>
        </div>
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
