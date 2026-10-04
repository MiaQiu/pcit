import { useState, useEffect } from 'react';
import {
  createCampaignMessage, updateCampaignMessage, uploadCampaignMessageImage, removeCampaignMessageImage,
  getCampaignLink, getCampaignStats, getSignupDraftSummary,
  ApiEnvOpts, CampaignMessage, CampaignStats, DraftTally, Partner, PartnerLandingText, SignupDraftSummary,
} from '../../api/adminApi';
import {
  LandingEditor, LandingImageState, emptyImageState, emptyLandingText, landingTextOf, inputStyle,
} from './LandingEditor';

// One campaign = one offer (the Partner row) + N message variants (/p/<slug>/<key>) +
// any number of channels (?src=<channel>, no setup needed). This modal manages the
// messages, builds the message x channel links, and shows stats per message x channel.

type Tab = 'messages' | 'links' | 'stats';

const PRESET_CHANNELS = ['facebook', 'instagram', 'tiktok', 'whatsapp', 'google', 'email'];

// Mirrors server/utils/partnerLanding.cjs normalizeSource().
function normalizeSource(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function buildLink(partner: Partner, messageKey: string, source: string) {
  const path = messageKey ? `${partner.signupUrl}/${messageKey}` : partner.signupUrl;
  return source ? `${path}?src=${encodeURIComponent(source)}` : path;
}

interface MessageForm {
  id: string | null;   // null = new
  key: string;
  name: string;
  text: PartnerLandingText;
  image: LandingImageState;
}

export default function CampaignLinksModal({ partner, callOpts, onUpdated, onClose }: {
  partner: Partner;
  callOpts?: ApiEnvOpts;
  onUpdated: (partner: Partner) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(partner.messages.length ? 'links' : 'messages');
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<SignupDraftSummary | null>(null);

  useEffect(() => {
    loadStats();
  }, [partner.id]);

  async function loadStats() {
    setStatsError(null);
    try {
      const [nextStats, nextDrafts] = await Promise.all([
        getCampaignStats(partner.id, callOpts),
        // Optional extra: an API without the drafts endpoint just hides the drafts section.
        getSignupDraftSummary(partner.id, callOpts).catch(() => null),
      ]);
      setStats(nextStats);
      setDrafts(nextDrafts);
    } catch (e: unknown) {
      setStatsError(e instanceof Error ? e.message : 'Failed to load stats');
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ width: 1080 }}>
        <div className="modal-header">
          <h2>{partner.name} — messages, links &amp; stats</h2>
          <button className="btn-remove" onClick={onClose}>&times;</button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {([['messages', `Messages (${partner.messages.filter(m => m.active).length + 1})`], ['links', 'Link builder'], ['stats', 'Stats']] as const).map(([k, label]) => (
            <button
              key={k}
              className={`btn ${tab === k ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 12, padding: '2px 12px', height: 28 }}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'messages' && (
          <MessagesTab partner={partner} stats={stats} callOpts={callOpts} onUpdated={onUpdated} />
        )}
        {tab === 'links' && <LinksTab partner={partner} callOpts={callOpts} />}
        {tab === 'stats' && <StatsTab partner={partner} stats={stats} drafts={drafts} error={statsError} onRefresh={loadStats} />}
      </div>
    </div>
  );
}

// ---- Messages ----

function MessagesTab({ partner, stats, callOpts, onUpdated }: {
  partner: Partner;
  stats: CampaignStats | null;
  callOpts?: ApiEnvOpts;
  onUpdated: (partner: Partner) => void;
}) {
  const [form, setForm] = useState<MessageForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const campaignText = landingTextOf(partner.config.landing);
  const signupsFor = (key: string) =>
    stats?.rows.filter(r => r.messageKey === key).reduce((sum, r) => sum + r.signups, 0) ?? null;

  function openNew(from?: CampaignMessage) {
    setError(null);
    setForm({
      id: null,
      key: from ? `${from.key}-copy` : '',
      name: from ? `${from.name} (copy)` : '',
      text: from ? landingTextOf(from.landing) : emptyLandingText(),
      image: from
        ? { currentUrl: from.landingImageUrl, currentKey: from.landing?.imageKey ?? null, pendingFile: null, remove: false }
        : emptyImageState(),
    });
  }

  function openEdit(m: CampaignMessage) {
    setError(null);
    setForm({
      id: m.id, key: m.key, name: m.name,
      text: landingTextOf(m.landing),
      image: { currentUrl: m.landingImageUrl, currentKey: m.landing?.imageKey ?? null, pendingFile: null, remove: false },
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      let saved: Partner;
      let messageId = form.id;
      if (form.id) {
        saved = await updateCampaignMessage(partner.id, form.id, { name: form.name, landing: form.text }, callOpts);
      } else {
        // Duplicating: reuse the source's image key unless it was replaced/removed.
        const reuseImage = form.image.currentKey && !form.image.remove && !form.image.pendingFile;
        saved = await createCampaignMessage(partner.id, {
          key: form.key, name: form.name,
          landing: { ...form.text, ...(reuseImage ? { imageKey: form.image.currentKey } : {}) },
        }, callOpts);
        messageId = saved.messages.find(m => m.key === form.key)?.id ?? null;
      }
      onUpdated(saved);

      // Image changes need the message id, so they run after the save.
      if (messageId) {
        try {
          if (form.image.pendingFile) {
            onUpdated(await uploadCampaignMessageImage(partner.id, messageId, form.image.pendingFile, callOpts));
          } else if (form.id && form.image.remove && form.image.currentKey) {
            onUpdated(await removeCampaignMessageImage(partner.id, messageId, callOpts));
          }
        } catch (imgErr: unknown) {
          // The message itself is saved — reopen it so the image can be retried.
          const m = saved.messages.find(x => x.id === messageId);
          if (m) openEdit(m);
          setError(`Saved, but the image failed: ${imgErr instanceof Error ? imgErr.message : 'upload error'}`);
          return;
        }
      }
      setForm(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(m: CampaignMessage) {
    if (m.active && !window.confirm(
      `Archive message "${m.name}"?\n\nIts links keep working but show the campaign's default copy, and new signups through them are no longer attributed to this message.`,
    )) return;
    setBusyId(m.id);
    try {
      onUpdated(await updateCampaignMessage(partner.id, m.id, { active: !m.active }, callOpts));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  }

  if (form) {
    return (
      <form onSubmit={handleSave}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600 }}>{form.id ? 'Edit message' : 'New message'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <label style={{ fontSize: 13 }}>
            <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Name * (internal)</span>
            <input
              style={inputStyle} value={form.name} maxLength={120} required
              placeholder="Tantrums angle"
              onChange={e => setForm(f => f && { ...f, name: e.target.value })}
            />
          </label>
          <label style={{ fontSize: 13 }}>
            <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Key * (in the URL — can't be changed later)</span>
            <input
              style={inputStyle} value={form.key} maxLength={40} required disabled={!!form.id}
              placeholder="tantrums"
              onChange={e => setForm(f => f && { ...f, key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
            />
            <span style={{ display: 'block', color: '#6b7280', fontSize: 12, marginTop: 4 }}>
              {partner.signupUrl}/{form.key || 'key'}
            </span>
          </label>
        </div>
        <span style={{ display: 'block', color: '#6b7280', fontSize: 12, marginBottom: 10 }}>
          Blank fields inherit the campaign's own copy (shown greyed out), so you only fill in what this message changes.
          Edits apply to every channel's link for this message.
        </span>
        <LandingEditor
          text={form.text} onTextChange={text => setForm(f => f && { ...f, text })}
          image={form.image} onImageChange={image => setForm(f => f && { ...f, image })}
          fallback={campaignText}
          fallbackImageUrl={partner.landingImageUrl}
          fallbackImageLabel="Campaign image"
        />
        {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '12px 0 0' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : form.id ? 'Save message' : 'Create message'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          Each message is a variant of the signup copy with its own link. The offer, trial and rules are shared
          (edit them on the campaign). Add channels in the link builder — they need no setup.
        </span>
        <button className="btn btn-primary" style={{ flexShrink: 0, marginLeft: 12 }} onClick={() => openNew()}>+ New message</button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Message</th>
            <th>Link</th>
            <th>Headline</th>
            <th>Signups</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <p style={{ margin: 0, fontWeight: 600 }}>Default</p>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Edit via the campaign form</p>
            </td>
            <td><code style={{ fontSize: 12 }}>/p/{partner.slug}</code></td>
            <td style={{ fontSize: 12, color: '#6b7280' }}>{campaignText.headline ?? '(app default)'}</td>
            <td style={{ fontSize: 13 }}>{signupsFor('') ?? '…'}</td>
            <td></td>
          </tr>
          {partner.messages.map(m => (
            <tr key={m.id} style={m.active ? undefined : { opacity: 0.55 }}>
              <td>
                <p style={{ margin: 0, fontWeight: 600 }}>
                  {m.name}
                  {!m.active && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#6b7280' }}>ARCHIVED</span>}
                </p>
              </td>
              <td><code style={{ fontSize: 12 }}>/p/{partner.slug}/{m.key}</code></td>
              <td style={{ fontSize: 12, color: '#6b7280' }}>
                {m.landing?.headline ?? <i>inherits: {campaignText.headline ?? '(app default)'}</i>}
              </td>
              <td style={{ fontSize: 13 }}>{signupsFor(m.key) ?? '…'}</td>
              <td>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary" style={smallBtn} onClick={() => openEdit(m)}>Edit</button>
                  <button className="btn btn-secondary" style={smallBtn} onClick={() => openNew(m)}>Duplicate</button>
                  <button className="btn btn-secondary" style={smallBtn} disabled={busyId === m.id} onClick={() => toggleActive(m)}>
                    {busyId === m.id ? '…' : m.active ? 'Archive' : 'Restore'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Link builder ----

function LinksTab({ partner, callOpts }: { partner: Partner; callOpts?: ApiEnvOpts }) {
  const messageOptions = [
    { key: '', label: 'Default' },
    ...partner.messages.filter(m => m.active).map(m => ({ key: m.key, label: m.name })),
  ];
  const [selectedMessages, setSelectedMessages] = useState<string[]>(messageOptions.map(o => o.key));
  const [channels, setChannels] = useState<string[]>(['facebook', 'instagram']);
  const [customChannel, setCustomChannel] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [qr, setQr] = useState<{ url: string; label: string; dataUrl: string | null; error?: string } | null>(null);

  const allChannels = [...new Set([...PRESET_CHANNELS, ...channels])];
  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter(v => v !== value) : [...list, value];

  function addCustomChannel() {
    const src = normalizeSource(customChannel);
    if (src && !channels.includes(src)) setChannels([...channels, src]);
    setCustomChannel('');
  }

  const links = selectedMessages.flatMap(messageKey => {
    const label = messageOptions.find(o => o.key === messageKey)?.label ?? messageKey;
    const srcs = channels.length ? channels : [''];
    return srcs.map(source => ({ messageKey, label, source, url: buildLink(partner, messageKey, source) }));
  });

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(c => (c === id ? null : c)), 1500);
  }

  async function showQr(link: typeof links[number]) {
    const label = `${link.label} · ${link.source || 'no channel'}`;
    setQr({ url: link.url, label, dataUrl: null });
    try {
      const res = await getCampaignLink(partner.id, link.messageKey || null, link.source || null, callOpts);
      setQr({ url: res.url, label, dataUrl: res.qrDataUrl });
    } catch (e: unknown) {
      setQr({ url: link.url, label, dataUrl: null, error: e instanceof Error ? e.message : 'Failed to generate QR' });
    }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Messages</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {messageOptions.map(o => (
              <Chip key={o.key || '__default'} active={selectedMessages.includes(o.key)} onClick={() => setSelectedMessages(toggle(selectedMessages, o.key))}>
                {o.label}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Channels (?src=)</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {allChannels.map(c => (
              <Chip key={c} active={channels.includes(c)} onClick={() => setChannels(toggle(channels, c))}>{c}</Chip>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              style={{ ...inputStyle, height: 30 }} value={customChannel} placeholder="Other channel, e.g. newsletter-oct"
              onChange={e => setCustomChannel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomChannel(); } }}
            />
            <button className="btn btn-secondary" style={{ ...smallBtn, height: 30 }} onClick={addCustomChannel}>Add</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{links.length} link{links.length === 1 ? '' : 's'}</span>
        <button
          className="btn btn-secondary" style={smallBtn} disabled={!links.length}
          onClick={() => copy(links.map(l => `${l.label}\t${l.source || '-'}\t${l.url}`).join('\n'), '__all')}
          title="Tab-separated: message, channel, URL — pastes into a spreadsheet"
        >
          {copied === '__all' ? 'Copied!' : 'Copy all'}
        </button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Message</th>
            <th>Channel</th>
            <th>URL</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {links.map(l => {
            const id = `${l.messageKey}|${l.source}`;
            return (
              <tr key={id}>
                <td style={{ fontSize: 13 }}>{l.label}</td>
                <td style={{ fontSize: 13 }}>{l.source || '—'}</td>
                <td><code style={{ fontSize: 12, wordBreak: 'break-all' }}>{l.url}</code></td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary" style={smallBtn} onClick={() => copy(l.url, id)}>
                      {copied === id ? 'Copied!' : 'Copy'}
                    </button>
                    <button className="btn btn-secondary" style={smallBtn} onClick={() => showQr(l)}>QR</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {qr && (
        <div className="modal-overlay" onClick={() => setQr(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ width: 360, textAlign: 'center' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 15 }}>{qr.label}</h2>
              <button className="btn-remove" onClick={() => setQr(null)}>&times;</button>
            </div>
            <code style={{ fontSize: 12, wordBreak: 'break-all' }}>{qr.url}</code>
            <div style={{ margin: '16px 0' }}>
              {qr.error ? <p style={{ color: '#dc2626', fontSize: 13 }}>{qr.error}</p>
                : qr.dataUrl ? (
                  <img src={qr.dataUrl} alt="QR code" style={{ width: 240, height: 240, border: '1px solid #e5e7eb', borderRadius: 8 }} />
                ) : <div className="loading-state">Generating…</div>}
            </div>
            {qr.dataUrl && (
              <a className="btn btn-secondary" href={qr.dataUrl} download={`${partner.slug}-${qr.label.replace(/[^a-z0-9]+/gi, '-')}.png`}>
                Download PNG
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Stats: messages x channels ----

function StatsTab({ partner, stats, drafts, error, onRefresh }: {
  partner: Partner;
  stats: CampaignStats | null;
  drafts: SignupDraftSummary | null;
  error: string | null;
  onRefresh: () => void;
}) {
  if (error) return <div className="error-state">{error}</div>;
  if (!stats) return <div className="loading-state">Loading…</div>;

  const nameOf = (key: string) =>
    key === '' ? 'Default' : partner.messages.find(m => m.key === key)?.name ?? `${key} (deleted)`;
  // Rows: default + every message (even with no traffic yet) + any key only seen in stats.
  const messageKeys = [...new Set(['', ...partner.messages.map(m => m.key), ...stats.rows.map(r => r.messageKey)])];
  const sourceTotals = new Map<string, number>();
  for (const r of stats.rows) sourceTotals.set(r.source, (sourceTotals.get(r.source) ?? 0) + r.visits + r.signups);
  const sources = [...sourceTotals.keys()].sort((a, b) => (sourceTotals.get(b) ?? 0) - (sourceTotals.get(a) ?? 0));

  const cell = (filter: (r: CampaignStats['rows'][number]) => boolean) => {
    const rows = stats.rows.filter(filter);
    return {
      visits: rows.reduce((s, r) => s + r.visits, 0),
      started: rows.reduce((s, r) => s + (r.started ?? 0), 0),
      signups: rows.reduce((s, r) => s + r.signups, 0),
    };
  };
  const trackedVisits = cell(() => true).visits;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          Each cell: signups / visits (conversion){drafts?.started ? ', plus how many started onboarding (account-at-end links)' : ''}.
          "no src" = link opened without a ?src= channel.
        </span>
        <button className="btn btn-secondary" style={smallBtn} onClick={onRefresh}>Refresh</button>
      </div>
      {sources.length === 0 ? (
        <div className="empty-state">No visits or signups yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Message</th>
                {sources.map(s => <th key={s}>{s || 'no src'}</th>)}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {messageKeys.map(key => (
                <tr key={key || '__default'}>
                  <td style={{ fontWeight: 600, fontSize: 13 }}>{nameOf(key)}</td>
                  {sources.map(s => <StatCell key={s} {...cell(r => r.messageKey === key && r.source === s)} />)}
                  <StatCell bold {...cell(r => r.messageKey === key)} />
                </tr>
              ))}
              <tr>
                <td style={{ fontWeight: 700, fontSize: 13 }}>Total</td>
                {sources.map(s => <StatCell key={s} bold {...cell(r => r.source === s)} />)}
                <StatCell bold {...cell(() => true)} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {stats.totalVisits > trackedVisits && (
        <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
          {stats.totalVisits - trackedVisits} earlier visit{stats.totalVisits - trackedVisits === 1 ? '' : 's'} happened before
          per-message/channel tracking and aren't in this breakdown. Signups from before then count as Default / no src.
        </p>
      )}
      {drafts && drafts.started > 0 && <DraftSummary drafts={drafts} />}
    </div>
  );
}

function StatCell({ visits, started, signups, bold }: { visits: number; started: number; signups: number; bold?: boolean }) {
  if (!visits && !signups && !started) return <td style={{ fontSize: 13, color: '#d1d5db' }}>—</td>;
  return (
    <td style={{ fontSize: 13, fontWeight: bold ? 600 : 400, whiteSpace: 'nowrap' }}>
      {signups} / {visits}
      {visits > 0 && <span style={{ color: '#6b7280', fontWeight: 400 }}> ({Math.round((signups / visits) * 100)}%)</span>}
      {started > 0 && <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 400 }}>{started} started</div>}
    </td>
  );
}

// ---- Account-at-end links: anonymous signup drafts ----

function DraftSummary({ drafts }: { drafts: SignupDraftSummary }) {
  const notFinished = drafts.started - drafts.converted;
  return (
    <div style={{ marginTop: 20 }}>
      <h4 style={{ margin: '0 0 4px', fontSize: 14 }}>Started onboarding (account at the end)</h4>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px' }}>
        {drafts.started} started · {drafts.converted} created an account or logged in · {notFinished} didn't finish.
        Anonymous — no names or contact details are recorded.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div>
          <h5 style={draftHeading}>Where they stopped</h5>
          {drafts.dropOff.length === 0 ? (
            <div style={{ fontSize: 12, color: '#6b7280' }}>Everyone who started finished.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Last screen</th><th>People</th></tr></thead>
              <tbody>
                {drafts.dropOff.map(d => (
                  <tr key={d.step}><td style={{ fontSize: 12 }}>{d.step}</td><td style={{ fontSize: 12 }}>{d.count}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <TallyTable title="Child birth year" rows={drafts.birthYears} />
        <TallyTable title="Concerns" rows={drafts.concerns} />
        <TallyTable title="Behavior snapshot" rows={drafts.wacbBands} />
      </div>
    </div>
  );
}

function TallyTable({ title, rows }: { title: string; rows: DraftTally[] }) {
  return (
    <div>
      <h5 style={draftHeading}>{title}</h5>
      <table className="data-table">
        <thead><tr><th></th><th>Started</th><th>Finished</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={String(r.key)}>
              <td style={{ fontSize: 12 }}>{String(r.key).replace(/_/g, ' ')}</td>
              <td style={{ fontSize: 12 }}>{r.started}</td>
              <td style={{ fontSize: 12 }}>{r.converted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const draftHeading: React.CSSProperties = { margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#374151' };

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        fontSize: 12, padding: '3px 10px', borderRadius: 999, cursor: 'pointer',
        border: `1px solid ${active ? '#7c3aed' : '#d1d5db'}`,
        background: active ? '#ede9fe' : '#fff', color: active ? '#6d28d9' : '#374151', fontWeight: active ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}

const smallBtn: React.CSSProperties = { fontSize: 12, padding: '2px 10px', height: 26 };
