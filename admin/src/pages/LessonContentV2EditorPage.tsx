import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLessonWithTranslation, updateLessonContentV2, uploadLessonAudio, uploadLessonContentImage, uploadLessonContentVideo } from '../api/adminApi';
import { handleBoldShortcut, insertTextareaMarker } from '../utils/textFormatting';

// Content locales this editor supports authoring for, beyond the always-present English source.
const LOCALES: { value: string; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh-TW', label: '繁體中文 (zh-TW)' },
  { value: 'zh-CN', label: '简体中文 (zh-CN)' },
];

export default function LessonContentV2EditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [locale, setLocale] = useState('en');
  const [contentV2, setContentV2] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getLessonWithTranslation(id, locale)
      .then(({ lesson, contentV2Translation }) => {
        setTitle(lesson.title);
        if (locale === 'en') {
          setContentV2(lesson.contentV2 || '');
          setAudioUrl(lesson.audioUrl);
        } else {
          setContentV2(contentV2Translation?.contentV2 || '');
          setAudioUrl(contentV2Translation?.audioUrl || null);
        }
      })
      .catch((err) => {
        alert('Failed to load lesson: ' + err.message);
        navigate('/content-v2');
      })
      .finally(() => setLoading(false));
  }, [id, locale]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateLessonContentV2(id, { contentV2 }, locale);
    } catch (err: any) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAudioChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setUploadError(null);
    setUploading(true);
    try {
      const { audioUrl: newUrl, transcriptText, transcriptionError } = await uploadLessonAudio(id, file, locale);
      setAudioUrl(newUrl);

      if (transcriptionError) {
        setUploadError(`Audio saved, but transcription failed: ${transcriptionError}`);
      } else if (transcriptText) {
        const replace = !contentV2.trim() || window.confirm(
          'Replace Lesson Content with the new transcript? (Your current text will be lost — copy it first if you want to keep it.)'
        );
        if (replace) setContentV2(transcriptText);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAudio = async () => {
    if (!id) return;
    try {
      await updateLessonContentV2(id, { audioUrl: null, wordTimings: null }, locale);
      setAudioUrl(null);
    } catch (err: any) {
      alert('Failed to remove audio: ' + err.message);
    }
  };

  const applyMarker = (opts: { before: string; after?: string; linePrefix?: boolean }) => {
    if (!textareaRef.current) return;
    insertTextareaMarker(textareaRef.current, setContentV2, opts);
  };

  const handleImageInsert = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setImageUploadError(null);
    setUploadingImage(true);
    try {
      const { marker } = await uploadLessonContentImage(id, file);
      applyMarker({ before: `\n\n${marker}\n\n` });
    } catch (err: any) {
      setImageUploadError(err.message || 'Image upload failed');
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleVideoInsert = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setVideoUploadError(null);
    setUploadingVideo(true);
    try {
      const { marker } = await uploadLessonContentVideo(id, file);
      applyMarker({ before: `\n\n${marker}\n\n` });
    } catch (err: any) {
      setVideoUploadError(err.message || 'Video upload failed');
    } finally {
      setUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  if (loading) {
    return <div className="page"><div className="loading-state">Loading lesson...</div></div>;
  }

  return (
    <div className="page editor-page">
      <div className="page-header">
        <div>
          <h1>Content V2: {title}</h1>
          <p className="page-subtitle">ID: {id}</p>
        </div>
        <div className="header-actions">
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}
          >
            {LOCALES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <button className="btn-secondary" onClick={() => navigate('/content-v2')}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Content'}
          </button>
        </div>
      </div>

      {locale !== 'en' && (
        <p style={{ fontSize: 13, color: '#6b7280', margin: '-8px 0 16px' }}>
          Editing the <strong>{LOCALES.find((l) => l.value === locale)?.label}</strong> translation. Title/subtitle
          shown in the lesson list stay English here — this page only edits the narration/script for this locale.
          The English source is always kept separately; switch back to English above to view or edit it.
        </p>
      )}

      <div className="editor-section">
        <h2>Audio Narration</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {audioUrl && !audioUrl.startsWith('mock://') && (
            <audio controls src={audioUrl} style={{ maxWidth: 320 }} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              style={{ display: 'none' }}
              onChange={handleAudioChange}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading & transcribing…' : audioUrl ? 'Replace Audio' : 'Upload Audio'}
            </button>
            {audioUrl && !uploading && (
              <button type="button" className="btn-danger-sm" onClick={handleRemoveAudio}>
                Remove
              </button>
            )}
            {uploadError && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{uploadError}</p>}
            {audioUrl && (
              <p style={{ fontSize: 12, color: '#9ca3af', margin: 0, wordBreak: 'break-all', maxWidth: 320 }}>
                {audioUrl}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="editor-section">
        <h2>Lesson Content</h2>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
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
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageInsert}
          />
          <button
            type="button"
            className="btn-secondary-sm"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploadingImage}
          >
            {uploadingImage ? 'Uploading image…' : 'Insert Image'}
          </button>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={handleVideoInsert}
          />
          <button
            type="button"
            className="btn-secondary-sm"
            onClick={() => videoInputRef.current?.click()}
            disabled={uploadingVideo}
          >
            {uploadingVideo ? 'Uploading video…' : 'Insert Video'}
          </button>
        </div>
        {imageUploadError && <p style={{ color: '#ef4444', fontSize: 13, margin: '0 0 8px' }}>{imageUploadError}</p>}
        {videoUploadError && <p style={{ color: '#ef4444', fontSize: 13, margin: '0 0 8px' }}>{videoUploadError}</p>}
        <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 8px' }}>
          Inserts an image/video marker at the cursor, on its own paragraph. Move the <code>![](...)</code> / <code>![video](...)</code> line to reposition it.
        </p>
        <div className="form-group">
          <textarea
            ref={textareaRef}
            value={contentV2}
            onChange={(e) => setContentV2(e.target.value)}
            onKeyDown={(e) => handleBoldShortcut(e, setContentV2)}
            placeholder="Lesson content (supports Ctrl+B for bold, * for bullet points, blank lines for paragraphs)"
            rows={20}
          />
        </div>
      </div>
    </div>
  );
}
