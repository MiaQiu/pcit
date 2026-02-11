import { useState, useEffect } from 'react';
import {
  getReportVisibility,
  updateReportVisibility,
  ReportVisibility,
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

  useEffect(() => {
    loadSettings();
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
