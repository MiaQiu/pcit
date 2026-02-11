import PhonePreview from './PhonePreview';
import { Segment } from '../../api/adminApi';

interface Props {
  lesson: {
    title: string;
    backgroundColor: string;
    ellipse77Color: string;
    ellipse78Color: string;
  };
  segments: Segment[];
  currentSegmentIndex: number;
}

function formatInlineText(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function formatBodyText(text: string): string {
  const lines = text.split('\n');
  let html = '<div class="preview-body-text">';

  lines.forEach((line) => {
    const bulletMatch = line.match(/^\s*\*\s(.+)$/);
    if (bulletMatch) {
      const content = formatInlineText(bulletMatch[1]);
      html += `<div class="preview-bullet"><span class="preview-bullet-icon">&bull;</span><span class="preview-bullet-text">${content}</span></div>`;
    } else if (line.trim() === '') {
      html += '<div style="height: 8px;"></div>';
    } else {
      html += `<p>${formatInlineText(line)}</p>`;
    }
  });

  html += '</div>';
  return html;
}

function getContentTypeStyle(contentType: string): string {
  switch (contentType) {
    case 'TIP':
      return 'preview-content-tip';
    case 'SCRIPT':
      return 'preview-content-script';
    case 'EXAMPLE':
      return 'preview-content-example';
    case 'CALLOUT':
      return 'preview-content-callout';
    case 'TEXT_INPUT':
      return 'preview-content-text-input';
    default:
      return '';
  }
}

export default function LessonPreview({ lesson, segments, currentSegmentIndex }: Props) {
  const segment = segments[currentSegmentIndex];
  if (!segment) {
    return (
      <PhonePreview>
        <div className="preview-empty">No segments to preview</div>
      </PhonePreview>
    );
  }

  const ellipseColor = lesson.ellipse77Color || '#9BD4DF';

  return (
    <PhonePreview>
      <div className="preview-container">
        {/* Progress bar */}
        <div className="preview-header">
          <div className="preview-close">&times;</div>
          <div className="preview-progress-segments">
            {segments.map((_, i) => (
              <div
                key={i}
                className={`preview-progress-seg ${i <= currentSegmentIndex ? 'active' : ''}`}
              />
            ))}
          </div>
        </div>

        {/* Content area */}
        <div className="preview-content-area">
          {/* Card */}
          <div className="preview-lesson-card">
            <div className="preview-ellipse-container">
              <div className="preview-ellipse-wrapper">
                <div className="preview-ellipse-image" style={{ background: ellipseColor }} />
              </div>
            </div>
            <div className="preview-card-header">
              <h1 className="preview-lesson-title">{lesson.title || 'Lesson Title'}</h1>
            </div>
            <div
              className={`preview-card ${getContentTypeStyle(segment.contentType)}`}
              style={{ backgroundColor: lesson.backgroundColor || '#F8F8FF' }}
            >
              {segment.sectionTitle && (
                <h2 className="preview-section-title">{segment.sectionTitle}</h2>
              )}
              <div
                className="preview-body-container"
                dangerouslySetInnerHTML={{
                  __html: formatBodyText(segment.bodyText || 'Enter content...'),
                }}
              />
              {segment.contentType === 'TEXT_INPUT' && (
                <div className="preview-text-input-placeholder">
                  <div className="preview-input-box">Type your answer here...</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="preview-footer">
          <div className="preview-btn-row">
            <button className="preview-btn-back" disabled={currentSegmentIndex === 0}>
              &larr; Back
            </button>
            <button className="preview-btn-continue">
              {currentSegmentIndex === segments.length - 1 ? 'Complete' : 'Continue'} &rarr;
            </button>
          </div>
        </div>
      </div>
    </PhonePreview>
  );
}
