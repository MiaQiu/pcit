import { useEffect, useRef } from 'react';
import PhonePreview from './PhonePreview';
import { Segment } from '../../api/adminApi';
import { normalizeHtml } from '../../utils/htmlNormalizer';

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


function buildHtmlDoc(html: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
    body > :first-child { width: 100% !important; height: 100% !important; max-width: 100% !important; aspect-ratio: auto !important; }
    #__tw-indicator { display: none !important; }
  </style>
</head>
<body>${html}</body>
</html>`;
}

function HtmlPreview({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const blob = new Blob([buildHtmlDoc(html)], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    blobUrlRef.current = url;
    if (iframeRef.current) iframeRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
    />
  );
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

  if (segment.customHtml) {
    return (
      <PhonePreview>
        <HtmlPreview html={normalizeHtml(segment.customHtml)} />
      </PhonePreview>
    );
  }

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
