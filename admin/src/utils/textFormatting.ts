import { KeyboardEvent } from 'react';

/**
 * Ctrl/Cmd+B toggles **bold** markers around the current textarea selection.
 * Shared by SegmentEditor and LessonContentV2EditorPage so both author the
 * same markdown-like syntax the mobile app parses.
 */
export function handleBoldShortcut(
  e: KeyboardEvent<HTMLTextAreaElement>,
  onChange: (newValue: string) => void
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

    onChange(newText);

    // Restore selection after React re-render
    requestAnimationFrame(() => {
      ta.selectionStart = newStart;
      ta.selectionEnd = newEnd;
    });
  }
}

/**
 * Inserts a marker (e.g. '**' or '* ') at the cursor/selection in a textarea,
 * used by toolbar buttons that aren't tied to a keyboard shortcut.
 */
export function insertTextareaMarker(
  ta: HTMLTextAreaElement,
  onChange: (newValue: string) => void,
  opts: { before: string; after?: string; linePrefix?: boolean }
) {
  const { before, after = '', linePrefix = false } = opts;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const text = ta.value;
  const selected = text.slice(start, end);

  let newText: string;
  let newStart: number;
  let newEnd: number;

  if (linePrefix) {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    newText = text.slice(0, lineStart) + before + text.slice(lineStart);
    newStart = start + before.length;
    newEnd = end + before.length;
  } else {
    newText = text.slice(0, start) + before + selected + after + text.slice(end);
    newStart = start + before.length;
    newEnd = end + before.length + selected.length;
  }

  onChange(newText);

  requestAnimationFrame(() => {
    ta.selectionStart = newStart;
    ta.selectionEnd = newEnd;
    ta.focus();
  });
}
