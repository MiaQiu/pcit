import { useState, useEffect } from 'react';
import {
  getPartners, createPartner, updatePartner, deactivatePartner,
  Partner, PartnerCreatePayload,
} from '../api/adminApi';
import { useEnv, PROD_API_URL } from '../context/EnvContext';

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://hinora.co';

function partnerUrl(slug: string) {
  return `${BASE_URL}/p/${slug}`;
}

function statusBadge(status: Partner['status']) {
  const styles: Record<string, string> = {
    ACTIVE: 'background:#d1fae5;color:#065f46',
    PAUSED: 'background:#fef3c7;color:#92400e',
    EXPIRED: 'background:#fee2e2;color:#991b1b',
  };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
      ...Object.fromEntries((styles[status] ?? '').split(';').filter(Boolean).map(p => p.split(':'))),
    }}>
      {status}
    </span>
  );
}

const emptyForm: PartnerCreatePayload = {
  slug: '', name: '', trialDays: 7,
  plans: ['monthly', 'yearly'],
  welcomeMessage: '',
  maxRedemptions: undefined,
  expiresAt: '',
  discount: undefined,
};

type DiscountDuration = 'once' | 'repeating' | 'forever';

export default function PartnersPage() {
  const { env, prodToken } = useEnv();
  const callOpts = env === 'prod' ? { baseUrl: PROD_API_URL, token: prodToken ?? undefined } : undefined;

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create / edit form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PartnerCreatePayload>(emptyForm);
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountDuration, setDiscountDuration] = useState<DiscountDuration>('forever');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [env, prodToken]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setPartners(await getPartners(callOpts));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm(emptyForm);
    setHasDiscount(false);
    setDiscountType('percent');
    setDiscountDuration('forever');
    setEditingId(null);
    setSaveError(null);
    setShowForm(true);
  }

  function openEdit(p: Partner) {
    const cfg = p.config;
    setForm({
      slug: p.slug,
      name: p.name,
      trialDays: cfg.trialDays,
      plans: cfg.plans,
      welcomeMessage: cfg.welcomeMessage ?? '',
      maxRedemptions: cfg.maxRedemptions ?? undefined,
      expiresAt: p.expiresAt ? p.expiresAt.slice(0, 10) : '',
    });
    if (cfg.discount) {
      setHasDiscount(true);
      setDiscountType(cfg.discount.percentOff != null ? 'percent' : 'amount');
      setDiscountDuration(cfg.discount.duration as DiscountDuration);
    } else {
      setHasDiscount(false);
    }
    setEditingId(p.id);
    setSaveError(null);
    setShowForm(true);
  }

  function buildDiscount() {
    if (!hasDiscount) return undefined;
    const base = {
      duration: discountDuration,
      ...(discountDuration === 'repeating' ? { durationMonths: form.discount?.durationMonths ?? 3 } : {}),
    };
    if (discountType === 'percent') {
      return { ...base, percentOff: form.discount?.percentOff ?? 20 };
    }
    return { ...base, amountOff: form.discount?.amountOff ?? 1000, currency: form.discount?.currency ?? 'sgd' };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const payload: PartnerCreatePayload = {
        ...form,
        discount: buildDiscount(),
        maxRedemptions: form.maxRedemptions || undefined,
        expiresAt: form.expiresAt || undefined,
        welcomeMessage: form.welcomeMessage || undefined,
      };
      if (editingId) {
        const updated = await updatePartner(editingId, payload, callOpts);
        setPartners(prev => prev.map(p => p.id === updated.id ? updated : p));
      } else {
        const created = await createPartner(payload, callOpts);
        setPartners(prev => [created, ...prev]);
      }
      setShowForm(false);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(partner: Partner) {
    if (!window.confirm(`Deactivate partner "${partner.name}"?\n\nNew signups will be blocked. Existing users keep access.`)) return;
    setDeactivatingId(partner.id);
    try {
      await deactivatePartner(partner.id, callOpts);
      setPartners(prev => prev.map(p => p.id === partner.id ? { ...p, status: 'EXPIRED' } : p));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setDeactivatingId(null);
    }
  }

  function copyUrl(slug: string) {
    navigator.clipboard.writeText(partnerUrl(slug)).catch(() => {});
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  const planLabels = (plans: string[]) => plans.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ');

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Partners</h1>
          <p className="page-subtitle">
            {partners.filter(p => p.status === 'ACTIVE').length} active
            {env === 'prod' && <span className="env-badge prod">PROD</span>}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ New Partner</button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div style={{
          background: '#f9fafb', border: '1px solid #e5e7eb',
          borderRadius: 12, padding: '24px', marginBottom: 32,
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>
            {editingId ? 'Edit Partner' : 'Create Partner'}
          </h3>
          <form onSubmit={handleSave}>
            {/* Basic fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <label style={{ fontSize: 13 }}>
                <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Name *</span>
                <input
                  style={inputStyle}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="SGH Family Medicine"
                  required
                />
              </label>
              <label style={{ fontSize: 13 }}>
                <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Slug * (URL token)</span>
                <input
                  style={inputStyle}
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                  placeholder="sgh-family"
                  required
                  disabled={!!editingId}
                />
              </label>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13 }}>
                <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Welcome message (optional)</span>
                <input
                  style={inputStyle}
                  value={form.welcomeMessage}
                  onChange={e => setForm(f => ({ ...f, welcomeMessage: e.target.value }))}
                  placeholder="Welcome, SGH partners! Enjoy your exclusive offer."
                />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <label style={{ fontSize: 13 }}>
                <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Trial days</span>
                <input
                  type="number" min={1} max={365} style={inputStyle}
                  value={form.trialDays}
                  onChange={e => setForm(f => ({ ...f, trialDays: Number(e.target.value) }))}
                />
              </label>
              <label style={{ fontSize: 13 }}>
                <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Max redemptions</span>
                <input
                  type="number" min={1} style={inputStyle}
                  value={form.maxRedemptions ?? ''}
                  placeholder="unlimited"
                  onChange={e => setForm(f => ({ ...f, maxRedemptions: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </label>
              <label style={{ fontSize: 13 }}>
                <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Expires</span>
                <input
                  type="date" style={inputStyle}
                  value={form.expiresAt}
                  onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                />
              </label>
            </div>

            {/* Plans */}
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Available plans</span>
              <div style={{ display: 'flex', gap: 16 }}>
                {(['monthly', 'yearly'] as const).map(plan => (
                  <label key={plan} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.plans?.includes(plan) ?? true}
                      onChange={e => setForm(f => ({
                        ...f,
                        plans: e.target.checked
                          ? [...(f.plans ?? []), plan]
                          : (f.plans ?? []).filter(p => p !== plan),
                      }))}
                    />
                    {plan.charAt(0).toUpperCase() + plan.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            {/* Discount */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={hasDiscount} onChange={e => setHasDiscount(e.target.checked)} />
                <span style={{ fontWeight: 600 }}>Apply a discount</span>
              </label>
              {hasDiscount && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <label style={{ fontSize: 13 }}>
                      <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Type</span>
                      <select style={inputStyle} value={discountType} onChange={e => setDiscountType(e.target.value as 'percent' | 'amount')}>
                        <option value="percent">Percent off</option>
                        <option value="amount">Amount off</option>
                      </select>
                    </label>
                    {discountType === 'percent' ? (
                      <label style={{ fontSize: 13 }}>
                        <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>% off</span>
                        <input
                          type="number" min={1} max={100} style={inputStyle}
                          value={form.discount?.percentOff ?? 20}
                          onChange={e => setForm(f => ({ ...f, discount: { ...f.discount, percentOff: Number(e.target.value), duration: discountDuration } }))}
                        />
                      </label>
                    ) : (
                      <label style={{ fontSize: 13 }}>
                        <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Amount off (cents)</span>
                        <input
                          type="number" min={1} style={inputStyle}
                          value={form.discount?.amountOff ?? 1000}
                          placeholder="e.g. 1000 = $10"
                          onChange={e => setForm(f => ({ ...f, discount: { ...f.discount, amountOff: Number(e.target.value), duration: discountDuration } }))}
                        />
                      </label>
                    )}
                    <label style={{ fontSize: 13 }}>
                      <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Duration</span>
                      <select style={inputStyle} value={discountDuration} onChange={e => setDiscountDuration(e.target.value as DiscountDuration)}>
                        <option value="forever">Forever</option>
                        <option value="once">First payment only</option>
                        <option value="repeating">N months</option>
                      </select>
                    </label>
                    {discountDuration === 'repeating' && (
                      <label style={{ fontSize: 13 }}>
                        <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Months</span>
                        <input
                          type="number" min={1} style={inputStyle}
                          value={form.discount?.durationMonths ?? 3}
                          onChange={e => setForm(f => ({ ...f, discount: { ...f.discount, durationMonths: Number(e.target.value), duration: 'repeating' } }))}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>

            {saveError && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 10 }}>{saveError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create partner'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="loading-state">Loading…</div>}
      {error && <div className="error-state">{error}</div>}

      {!loading && !error && (
        partners.length === 0 ? (
          <div className="empty-state">No partners yet. Click "+ New Partner" to create one.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Partner</th>
                <th>URL / Slug</th>
                <th>Offer</th>
                <th>Usage</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {partners.map(p => (
                <tr key={p.id}>
                  <td>
                    <p style={{ fontWeight: 600, margin: 0 }}>{p.name}</p>
                    {p.config.welcomeMessage && (
                      <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{p.config.welcomeMessage}</p>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <code style={{ fontSize: 12, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
                        /p/{p.slug}
                      </code>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 11, padding: '2px 8px', height: 24 }}
                        onClick={() => copyUrl(p.slug)}
                        title="Copy URL"
                      >
                        Copy
                      </button>
                    </div>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    <p style={{ margin: '0 0 2px' }}>{p.config.trialDays}d trial · {planLabels(p.config.plans)}</p>
                    {p.discountLabel && <p style={{ margin: 0, color: '#7c3aed', fontWeight: 600 }}>{p.discountLabel}</p>}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {p.redemptions}{p.config.maxRedemptions ? ` / ${p.config.maxRedemptions}` : ''} signups
                    <br />
                    <span style={{ color: '#6b7280' }}>{p.userCount} users</span>
                  </td>
                  <td>{statusBadge(p.status)}</td>
                  <td style={{ fontSize: 13, color: '#6b7280' }}>{fmt(p.createdAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: '2px 10px', height: 26 }}
                        onClick={() => openEdit(p)}
                      >
                        Edit
                      </button>
                      {p.status === 'ACTIVE' && (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: '2px 10px', height: 26 }}
                          disabled={deactivatingId === p.id}
                          onClick={() => handleDeactivate(p)}
                        >
                          {deactivatingId === p.id ? '…' : 'Deactivate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 36, borderRadius: 8,
  border: '1px solid #d1d5db', padding: '0 10px', fontSize: 13,
  boxSizing: 'border-box',
};
