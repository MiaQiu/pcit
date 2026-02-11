import { useState } from 'react';
import { sendNotifications } from '../../api/adminApi';

interface Props {
  selectedIds: Set<string>;
}

export default function NotificationSender({ selectedIds }: Props) {
  const [title, setTitle] = useState('Your Weekly Report is Ready!');
  const [body, setBody] = useState('Check out your progress this week');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  const handleSend = async () => {
    if (selectedIds.size === 0) {
      alert('Select at least one user');
      return;
    }
    if (!window.confirm(`Send notification to ${selectedIds.size} user(s)?`)) return;

    setSending(true);
    setResult(null);
    try {
      const res = await sendNotifications(Array.from(selectedIds), title, body);
      setResult({ sent: res.sent, failed: res.failed });
    } catch (err: any) {
      alert('Failed to send: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="notification-sender">
      <h2>Compose Notification</h2>

      <div className="form-group">
        <label>Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Notification title"
        />
      </div>

      <div className="form-group">
        <label>Body</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Notification message"
          rows={3}
        />
      </div>

      <div className="notification-preview-box">
        <div className="notification-preview-title">{title || 'Title'}</div>
        <div className="notification-preview-body">{body || 'Message body'}</div>
      </div>

      <button
        className="btn-primary"
        onClick={handleSend}
        disabled={sending || selectedIds.size === 0}
        style={{ width: '100%' }}
      >
        {sending
          ? 'Sending...'
          : `Send to ${selectedIds.size} user${selectedIds.size !== 1 ? 's' : ''}`}
      </button>

      {result && (
        <div className={`send-result ${result.failed > 0 ? 'has-failures' : ''}`}>
          Sent: {result.sent} | Failed: {result.failed}
        </div>
      )}
    </div>
  );
}
