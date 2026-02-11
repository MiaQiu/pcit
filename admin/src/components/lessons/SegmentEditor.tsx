import { KeyboardEvent } from 'react';
import { Segment } from '../../api/adminApi';

const CONTENT_TYPES = ['TEXT', 'EXAMPLE', 'TIP', 'SCRIPT', 'CALLOUT', 'TEXT_INPUT'];

function handleBoldShortcut(
  e: KeyboardEvent<HTMLTextAreaElement>,
  onChange: (updates: Partial<Segment>) => void
) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault();
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value;
    const selected = text.slice(start, end);

    if (start === end) return; // nothing selected

    // Toggle: if already wrapped in **, remove them; otherwise add them
    const before = text.slice(0, start);
    const after = text.slice(end);
    const alreadyBold =
      before.endsWith('**') && after.startsWith('**');

    let newText: string;
    let newStart: number;
    let newEnd: number;

    if (alreadyBold) {
      newText = before.slice(0, -2) + selected + after.slice(2);
      newStart = start - 2;
      newEnd = end - 2;
    } else {
      newText = before + '**' + selected + '**' + after;
      newStart = start + 2;
      newEnd = end + 2;
    }

    onChange({ bodyText: newText });

    // Restore selection after React re-render
    requestAnimationFrame(() => {
      ta.selectionStart = newStart;
      ta.selectionEnd = newEnd;
    });
  }
}

interface Props {
  segment: Segment;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updates: Partial<Segment>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export default function SegmentEditor({
  segment,
  index,
  isSelected,
  onSelect,
  onChange,
  onRemove,
  canRemove,
}: Props) {
  return (
    <div
      className={`segment-card ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="segment-header">
        <span className="segment-number">Segment {index + 1}</span>
        <span className={`segment-type-badge type-${segment.contentType.toLowerCase()}`}>
          {segment.contentType}
        </span>
        {canRemove && (
          <button
            className="btn-remove"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            &times;
          </button>
        )}
      </div>

      <div className="form-row">
        <div className="form-group" style={{ flex: 1 }}>
          <label>Section Title</label>
          <input
            type="text"
            value={segment.sectionTitle || ''}
            onChange={(e) => onChange({ sectionTitle: e.target.value })}
            placeholder="Section heading"
          />
        </div>
        <div className="form-group" style={{ maxWidth: 160 }}>
          <label>Content Type</label>
          <select
            value={segment.contentType}
            onChange={(e) => onChange({ contentType: e.target.value })}
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label>Body Text</label>
        <textarea
          value={segment.bodyText}
          onChange={(e) => onChange({ bodyText: e.target.value })}
          onKeyDown={(e) => handleBoldShortcut(e, onChange)}
          placeholder="Segment content (supports Ctrl+B for bold, * for bullet points)"
          rows={6}
        />
      </div>

      {segment.contentType === 'TEXT_INPUT' && (
        <>
          <div className="form-group">
            <label>Ideal Answer</label>
            <textarea
              value={segment.idealAnswer || ''}
              onChange={(e) => onChange({ idealAnswer: e.target.value })}
              placeholder="The ideal answer for AI evaluation"
              rows={3}
            />
          </div>
          <div className="form-group">
            <label>AI Check Mode</label>
            <select
              value={segment.aiCheckMode || 'AI-Check'}
              onChange={(e) => onChange({ aiCheckMode: e.target.value })}
            >
              <option value="AI-Check">AI-Check</option>
              <option value="Exact">Exact</option>
            </select>
          </div>
        </>
      )}
    </div>
  );
}
