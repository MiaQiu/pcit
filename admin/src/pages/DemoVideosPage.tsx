import { useState, useEffect, useCallback, useRef, RefObject } from 'react';
import {
  getDemoVideos,
  createDemoVideo,
  updateDemoVideo,
  deleteDemoVideo,
  uploadDemoVideoFile,
  uploadDemoVideoThumbnailFile,
  getLessons,
  DemoVideo,
  DemoVideoInput,
  LessonSummary,
} from '../api/adminApi';
import { handleBoldShortcut, insertTextareaMarker } from '../utils/textFormatting';

export default function DemoVideosPage() {
  const [demoVideos, setDemoVideos] = useState<DemoVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: 'add' } | { mode: 'edit'; video: DemoVideo } | null>(null);

  const fetchDemoVideos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDemoVideos();
      setDemoVideos(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load demo videos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDemoVideos();
  }, [fetchDemoVideos]);

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete video "${title}"? This cannot be undone.`)) return;
    try {
      await deleteDemoVideo(id);
      setDemoVideos((prev) => prev.filter((v) => v.id !== id));
    } catch (err: any) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const handleToggleActive = async (video: DemoVideo) => {
    const prevVideos = demoVideos;
    setDemoVideos((prev) => prev.map((v) => (v.id === video.id ? { ...v, isActive: !v.isActive } : v)));
    try {
      await updateDemoVideo(video.id, { isActive: !video.isActive });
    } catch (err: any) {
      setDemoVideos(prevVideos);
      alert('Failed to update: ' + err.message);
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= demoVideos.length) return;

    const a = demoVideos[index];
    const b = demoVideos[target];
    const reordered = [...demoVideos];
    reordered[index] = b;
    reordered[target] = a;
    setDemoVideos(reordered);

    try {
      await Promise.all([
        updateDemoVideo(a.id, { displayOrder: b.displayOrder }),
        updateDemoVideo(b.id, { displayOrder: a.displayOrder }),
      ]);
      fetchDemoVideos();
    } catch (err: any) {
      alert('Failed to reorder: ' + err.message);
      fetchDemoVideos();
    }
  };

  const handleSaved = () => {
    setModal(null);
    fetchDemoVideos();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Demo Videos</h1>
          <p className="page-subtitle">
            Videos shown in the "Demo Videos" section of the mobile Learn tab
          </p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ mode: 'add' })}>
          + Add Video
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading demo videos...</div>
      ) : error ? (
        <div className="error-state">{error}</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th></th>
              <th>Preview</th>
              <th>Title</th>
              <th>Video</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {demoVideos.map((video, index) => (
              <tr key={video.id}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="btn-secondary-sm"
                    style={{ marginRight: 4 }}
                    disabled={index === 0}
                    onClick={() => handleMove(index, -1)}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    className="btn-secondary-sm"
                    disabled={index === demoVideos.length - 1}
                    onClick={() => handleMove(index, 1)}
                    title="Move down"
                  >
                    ↓
                  </button>
                </td>
                <td>
                  {video.thumbnailUrl ? (
                    <img src={video.thumbnailUrl} style={{ width: 80, height: 45, objectFit: 'cover', borderRadius: 4, background: '#000' }} />
                  ) : video.videoUrl ? (
                    <video src={video.videoUrl} style={{ width: 80, height: 45, objectFit: 'cover', borderRadius: 4, background: '#000' }} muted />
                  ) : (
                    <div style={{ width: 80, height: 45, borderRadius: 4, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#9CA3AF' }}>
                      No video
                    </div>
                  )}
                </td>
                <td className="cell-definition">{video.title}</td>
                <td style={{ whiteSpace: 'nowrap', fontSize: 13, color: video.videoUrl ? '#10B981' : '#9CA3AF' }}>
                  {video.videoUrl ? '✓ Uploaded' : '— None'}
                </td>
                <td>
                  <button
                    className={`settings-toggle ${video.isActive ? 'active' : ''}`}
                    onClick={() => handleToggleActive(video)}
                    title={video.isActive ? 'Active — shown on mobile' : 'Inactive — hidden from mobile'}
                  >
                    <span className="settings-toggle-knob" />
                  </button>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="btn-secondary-sm"
                    style={{ marginRight: 6 }}
                    onClick={() => setModal({ mode: 'edit', video })}
                  >
                    Edit
                  </button>
                  <button className="btn-danger-sm" onClick={() => handleDelete(video.id, video.title)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {demoVideos.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state">
                  No demo videos yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {modal && (
        <DemoVideoModal
          mode={modal.mode}
          video={modal.mode === 'edit' ? modal.video : undefined}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function DemoVideoModal({
  mode,
  video,
  onClose,
  onSaved,
}: {
  mode: 'add' | 'edit';
  video?: DemoVideo;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(video?.title || '');
  const [description, setDescription] = useState(video?.description || '');
  const [additionalText, setAdditionalText] = useState(video?.additionalText || '');
  const [lessonId, setLessonId] = useState(video?.lessonId || '');
  const [isActive, setIsActive] = useState(video?.isActive ?? true);
  const [file, setFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const additionalTextRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getLessons().then(setLessons).catch(() => setLessons([]));
  }, []);

  const isEdit = mode === 'edit';

  const handleSubmit = async () => {
    if (!title.trim()) { alert('Title is required'); return; }

    setSaving(true);
    try {
      const input: DemoVideoInput = { title, description, additionalText, lessonId: lessonId || null, isActive };
      let id = video?.id;
      if (isEdit && id) {
        await updateDemoVideo(id, input);
      } else {
        const created = await createDemoVideo(input);
        id = created.id;
      }

      if (file && id) {
        setUploading(true);
        await uploadDemoVideoFile(id, file);
        setUploading(false);
      }

      if (thumbnailFile && id) {
        setUploadingThumbnail(true);
        await uploadDemoVideoThumbnailFile(id, thumbnailFile);
        setUploadingThumbnail(false);
      }

      onSaved();
    } catch (err: any) {
      alert(`Failed to ${isEdit ? 'update' : 'create'} demo video: ` + err.message);
    } finally {
      setSaving(false);
      setUploading(false);
      setUploadingThumbnail(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Demo Video' : 'Add Demo Video'}</h2>
          <button className="btn-remove" onClick={onClose}>&times;</button>
        </div>

        <div className="form-group">
          <label>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. How to Start a Play Session"
            autoFocus
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <FormattingToolbar textareaRef={descriptionRef} onChange={setDescription} />
          <textarea
            ref={descriptionRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => handleBoldShortcut(e, setDescription)}
            placeholder="Short description shown above the video on mobile"
            rows={3}
          />
          <p className="form-hint">Select text and click Bold (or Ctrl/Cmd+B), or Bullet to prefix a line.</p>
        </div>

        <div className="form-group">
          <label>Additional text</label>
          <FormattingToolbar textareaRef={additionalTextRef} onChange={setAdditionalText} showFold />
          <textarea
            ref={additionalTextRef}
            value={additionalText}
            onChange={(e) => setAdditionalText(e.target.value)}
            onKeyDown={(e) => handleBoldShortcut(e, setAdditionalText)}
            placeholder="Longer notes shown below the video on mobile"
            rows={5}
          />
          <p className="form-hint">
            Select text and click Bold (or Ctrl/Cmd+B) or Bullet to prefix a line. For an FAQ-style card: on a
            line, type the question, select the answer, then click Fold — the question shows with a +/− toggle
            and the answer only appears when tapped, on mobile.
          </p>
        </div>

        <div className="form-group">
          <label>Linked lesson (optional)</label>
          <select value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
            <option value="">— None —</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.module} · Day {l.dayNumber}: {l.title}
              </option>
            ))}
          </select>
          <p className="form-hint">Shown as a "View the Lesson" link at the end of the video on mobile.</p>
        </div>

        <div className="form-group">
          <label>Video file{isEdit && video?.videoUrl ? ' (uploading a new file replaces the current one)' : ''}</label>
          {isEdit && video?.videoUrl && !file && (
            <video src={video.videoUrl} controls style={{ width: '100%', maxHeight: 200, borderRadius: 6, marginBottom: 8, background: '#000' }} />
          )}
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <p className="form-hint">MP4, MOV, or WebM. Up to 200 MB.</p>
        </div>

        <div className="form-group">
          <label>Preview image{isEdit && video?.thumbnailUrl ? ' (uploading a new file replaces the current one)' : ''}</label>
          {isEdit && video?.thumbnailUrl && !thumbnailFile && (
            <img src={video.thumbnailUrl} style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 6, marginBottom: 8, background: '#000' }} />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
          />
          <p className="form-hint">
            Shown while the video is loading on mobile, so the card/screen doesn't have to wait on the video
            itself to render something. JPG, PNG, or WebP.
          </p>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className={`settings-toggle ${isActive ? 'active' : ''}`}
              onClick={() => setIsActive((v) => !v)}
            >
              <span className="settings-toggle-knob" />
            </button>
            Active (shown on mobile Learn tab)
          </label>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {uploading
              ? 'Uploading video...'
              : uploadingThumbnail
              ? 'Uploading preview image...'
              : saving
              ? 'Saving...'
              : isEdit
              ? 'Save Changes'
              : 'Add Video'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormattingToolbar({
  textareaRef,
  onChange,
  showFold,
}: {
  textareaRef: RefObject<HTMLTextAreaElement>;
  onChange: (newValue: string) => void;
  showFold?: boolean;
}) {
  const applyMarker = (opts: { before: string; after?: string; linePrefix?: boolean }) => {
    if (!textareaRef.current) return;
    insertTextareaMarker(textareaRef.current, onChange, opts);
  };

  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
      <button
        type="button"
        className="btn-secondary-sm"
        onClick={() => applyMarker({ before: '**', after: '**' })}
      >
        Bold
      </button>
      <button
        type="button"
        className="btn-secondary-sm"
        onClick={() => applyMarker({ before: '* ', linePrefix: true })}
      >
        Bullet
      </button>
      {showFold && (
        <button
          type="button"
          className="btn-secondary-sm"
          title="Wraps the selected text in ||...|| — text on the same line before it becomes an FAQ question, the wrapped text becomes its answer, shown behind a +/- toggle on mobile"
          onClick={() => applyMarker({ before: '||', after: '||' })}
        >
          Fold
        </button>
      )}
    </div>
  );
}
