import { useState, useEffect, useRef } from 'react';
import {
  getReportVisibility,
  updateReportVisibility,
  ReportVisibility,
  getBrandingImages,
  uploadBrandingImage,
  BrandingImages,
  BrandingImageSlot,
} from '../api/adminApi';

export default function SettingsPage() {
  const [visibility, setVisibility] = useState<ReportVisibility>({
    daily: false,
    weekly: false,
    monthly: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [branding, setBranding] = useState<BrandingImages>({
    learnCoverUrl: null,
    lessonViewerUrl: null,
    learnTitle: null,
    learnSubtitle: null,
  });
  const [uploadingSlot, setUploadingSlot] = useState<BrandingImageSlot | null>(null);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const learnCoverInputRef = useRef<HTMLInputElement>(null);
  const lessonViewerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSettings();
    loadBranding();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getReportVisibility();
      setVisibility(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadBranding = async () => {
    try {
      setBranding(await getBrandingImages());
    } catch (err) {
      console.error('Failed to load branding images:', err);
    }
  };

  const handleBrandingUpload = async (slot: BrandingImageSlot, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBrandingError(null);
    setUploadingSlot(slot);
    try {
      setBranding(await uploadBrandingImage(slot, file));
    } catch (err: any) {
      setBrandingError(err.message || 'Upload failed');
    } finally {
      setUploadingSlot(null);
      const ref = slot === 'learn-cover' ? learnCoverInputRef : lessonViewerInputRef;
      if (ref.current) ref.current.value = '';
    }
  };

  const handleToggle = async (key: keyof ReportVisibility) => {
    const updated = { ...visibility, [key]: !visibility[key] };
    setVisibility(updated);
    setSaving(true);
    setFeedback(null);

    try {
      await updateReportVisibility(updated);
      setFeedback({ type: 'success', message: 'Settings saved' });
    } catch (err) {
      // Revert on failure
      setVisibility(visibility);
      setFeedback({ type: 'error', message: 'Failed to save settings' });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 2000);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="loading-state">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="page-subtitle">Configure app-wide settings</p>
        </div>
      </div>

      <div className="settings-section">
        <h2>Branding Images</h2>
        <p className="settings-description">
          Images shown in the mobile app's Learn tab cover band and the lesson viewer's identity row. Leave unset to use the bundled default.
        </p>

        {brandingError && <p style={{ color: '#ef4444', fontSize: 13, margin: '0 0 12px' }}>{brandingError}</p>}

        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          {([
            { slot: 'learn-cover' as const, label: 'Learn Tab Cover Image', url: branding.learnCoverUrl, ref: learnCoverInputRef },
            { slot: 'lesson-viewer' as const, label: 'Lesson Viewer Identity Image', url: branding.lessonViewerUrl, ref: lessonViewerInputRef },
          ]).map(({ slot, label, url, ref }) => (
            <div key={slot} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="settings-toggle-label">{label}</span>
              {url && !url.startsWith('mock://') && (
                <img src={url} alt={label} style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 12 }} />
              )}
              <input
                ref={ref}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleBrandingUpload(slot, e)}
              />
              <button
                type="button"
                className="btn-secondary-sm"
                onClick={() => ref.current?.click()}
                disabled={uploadingSlot === slot}
              >
                {uploadingSlot === slot ? 'Uploading…' : url ? 'Replace' : 'Upload'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h2>Report Visibility</h2>
        <p className="settings-description">
          Control which report types are visible to users in the mobile app's Progress tab.
        </p>

        <div className="settings-toggles">
          {([
            { key: 'daily' as const, label: 'Daily Reports', description: 'Show recent session reports with date, mode, and score' },
            { key: 'weekly' as const, label: 'Weekly Reports', description: 'Show weekly summary report card' },
            { key: 'monthly' as const, label: 'Monthly Reports', description: 'Show monthly summary with session count and average score' },
          ]).map(({ key, label, description }) => (
            <div key={key} className="settings-toggle-row">
              <div className="settings-toggle-info">
                <span className="settings-toggle-label">{label}</span>
                <span className="settings-toggle-description">{description}</span>
              </div>
              <button
                className={`settings-toggle ${visibility[key] ? 'active' : ''}`}
                onClick={() => handleToggle(key)}
                disabled={saving}
                aria-label={`Toggle ${label}`}
              >
                <span className="settings-toggle-knob" />
              </button>
            </div>
          ))}
        </div>

        {feedback && (
          <div className={`settings-feedback ${feedback.type}`}>
            {feedback.message}
          </div>
        )}
      </div>
    </div>
  );
}
