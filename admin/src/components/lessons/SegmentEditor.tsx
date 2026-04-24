import { KeyboardEvent } from 'react';
import { Segment } from '../../api/adminApi';
import { normalizeHtml } from '../../utils/htmlNormalizer';

function adjustTopPadding(html: string, delta: number): string {
  // Walk tags in order; skip elements that are absolute-positioned (decorative backgrounds)
  const tagRegex = /<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
  let m: RegExpExecArray | null;

  while ((m = tagRegex.exec(html)) !== null) {
    const [fullTag, , attrs] = m;
    if (/\babsolute\b/.test(attrs)) continue;

    // Try pt-[Npx]
    const ptArb = attrs.match(/\bpt-\[(\d+)px\]/);
    if (ptArb) {
      const next = Math.max(0, parseInt(ptArb[1]) + delta);
      const newTag = fullTag.replace(/\bpt-\[\d+px\]/, `pt-[${next}px]`);
      return html.slice(0, m.index) + newTag + html.slice(m.index + fullTag.length);
    }

    // Try pt-N (Tailwind units → px)
    const ptUnit = attrs.match(/\bpt-(\d+)\b/);
    if (ptUnit) {
      const next = Math.max(0, parseInt(ptUnit[1]) * 4 + delta);
      const newTag = fullTag.replace(/\bpt-\d+\b/, `pt-[${next}px]`);
      return html.slice(0, m.index) + newTag + html.slice(m.index + fullTag.length);
    }

    // Try py-N — split into pt- and pb- so we can adjust top independently
    const pyUnit = attrs.match(/\bpy-(\d+)\b/);
    if (pyUnit) {
      const origPx = parseInt(pyUnit[1]) * 4;
      const nextPt = Math.max(0, origPx + delta);
      const newTag = fullTag.replace(/\bpy-\d+\b/, `pt-[${nextPt}px] pb-[${origPx}px]`);
      return html.slice(0, m.index) + newTag + html.slice(m.index + fullTag.length);
    }
  }

  // No padding found — add pt- to the first non-absolute element
  return html.replace(/(<(?:div|section|main|article)\b[^>]*class=")(?![^"]*\babsolute\b)/, `$1pt-[${Math.max(0, delta)}px] `);
}

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

      <div className="form-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <label style={{ marginBottom: 0 }}>Custom HTML</label>
          {segment.customHtml && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn-secondary-sm"
                onClick={(e) => { e.stopPropagation(); onChange({ customHtml: adjustTopPadding(segment.customHtml!, -10) }); }}
                title="Move content up 10px"
              >▲ Up</button>
              <button
                className="btn-secondary-sm"
                onClick={(e) => { e.stopPropagation(); onChange({ customHtml: adjustTopPadding(segment.customHtml!, 10) }); }}
                title="Move content down 10px"
              >▼ Down</button>
              <button
                className="btn-secondary-sm"
                onClick={(e) => { e.stopPropagation(); onChange({ customHtml: normalizeHtml(segment.customHtml!) }); }}
              >Fix HTML</button>
            </div>
          )}
        </div>
        <textarea
          value={segment.customHtml || ''}
          onChange={(e) => onChange({ customHtml: e.target.value || null })}
          onBlur={(e) => {
            const val = e.target.value;
            if (val) onChange({ customHtml: normalizeHtml(val) });
          }}
          placeholder="Raw HTML for this segment. If set, overrides Body Text on mobile."
          rows={8}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
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
