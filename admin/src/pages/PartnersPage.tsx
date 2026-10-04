import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getPartners, createPartner, updatePartner, deactivatePartner, regeneratePartnerQrCode, getPartnerUsers,
  uploadPartnerLandingImage, removePartnerLandingImage,
  Partner, PartnerCreatePayload, PartnerUser, PartnerKind, PartnerLandingText,
} from '../api/adminApi';
import { useEnv, PROD_API_URL } from '../context/EnvContext';
import {
  LandingEditor, LandingField, LandingImageState, emptyImageState, emptyLandingText, landingTextOf, inputStyle,
} from '../components/partners/LandingEditor';
import CampaignLinksModal from '../components/partners/CampaignLinksModal';

type KindFilter = 'ALL' | PartnerKind;

const SUBSCRIPTION_STATUS_COLORS: Record<string, string> = {
  TRIAL: '#f59e0b',
  ACTIVE: '#10b981',
  EXPIRED: '#ef4444',
  CANCELLED: '#6b7280',
  NONE: '#9ca3af',
  INACTIVE: '#9ca3af',
};

function subscriptionBadge(status: string) {
  const color = SUBSCRIPTION_STATUS_COLORS[status] ?? '#9ca3af';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: `${color}22`, color, borderRadius: 12,
      padding: '2px 10px', fontSize: 12, fontWeight: 600,
    }}>
      {status}
    </span>
  );
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

// Reserved row (migration 20260828130000) that carries the referral-link trial.
const REFERRAL_PARTNER_SLUG = 'referral';

const emptyForm: PartnerCreatePayload = {
  slug: '', name: '', kind: 'PARTNER', trialDays: 7,
  plans: ['monthly', 'yearly'],
  welcomeMessage: '',
  maxRedemptions: undefined,
  expiresAt: '',
  displayName: '',
  skipSubscription: false,
  accountLast: false,
};

type PlanKey = 'monthly' | 'yearly';
type DiscountDuration = 'once' | 'repeating' | 'forever';

interface DiscountFormState {
  enabled: boolean;
  type: 'percent' | 'amount';
  duration: DiscountDuration;
  percentOff: number;
  amountOff: number;
  currency: string;
  durationMonths: number;
}

const emptyDiscountState = (): DiscountFormState => ({
  enabled: false, type: 'percent', duration: 'forever',
  percentOff: 20, amountOff: 1000, currency: 'sgd', durationMonths: 3,
});

const emptyDiscountStates = (): Record<PlanKey, DiscountFormState> => ({
  monthly: emptyDiscountState(),
  yearly: emptyDiscountState(),
});

export default function PartnersPage() {
  const { env, prodToken } = useEnv();
  const callOpts = env === 'prod' ? { baseUrl: PROD_API_URL, token: prodToken ?? undefined } : undefined;
  const navigate = useNavigate();

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create / edit form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PartnerCreatePayload>(emptyForm);
  const [discountStates, setDiscountStates] = useState<Record<PlanKey, DiscountFormState>>(emptyDiscountStates());
  const [landingText, setLandingText] = useState<PartnerLandingText>(emptyLandingText());
  // Campaign rules behind the create-account consent checkbox (campaigns only).
  const [rules, setRules] = useState({ title: '', content: '' });
  const [imageState, setImageState] = useState<LandingImageState>(emptyImageState());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [kindFilter, setKindFilter] = useState<KindFilter>('ALL');

  const [statusChangingId, setStatusChangingId] = useState<string | null>(null);

  // QR code modal
  const [qrPartner, setQrPartner] = useState<Partner | null>(null);
  const [qrGenerating, setQrGenerating] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  // Messages, link builder & stats modal (holds the id so it follows list updates)
  const [linksPartnerId, setLinksPartnerId] = useState<string | null>(null);
  const linksPartner = partners.find(p => p.id === linksPartnerId) ?? null;

  // Partner users modal
  const [usersPartner, setUsersPartner] = useState<Partner | null>(null);
  const [partnerUsers, setPartnerUsers] = useState<PartnerUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

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

  function openCreate(kind: PartnerKind) {
    setForm({ ...emptyForm, kind });
    setDiscountStates(emptyDiscountStates());
    setLandingText(emptyLandingText());
    setRules({ title: '', content: '' });
    setImageState(emptyImageState());
    setEditingId(null);
    setSaveError(null);
    setShowForm(true);
  }

  // Fills the form from an existing row. `asCopy` = Duplicate: new slug, no id,
  // but keeps the offer, messages and hero image.
  function openFrom(p: Partner, asCopy: boolean) {
    const cfg = p.config;
    setForm({
      slug: asCopy ? '' : p.slug,
      name: asCopy ? `${p.name} (copy)` : p.name,
      kind: p.kind,
      trialDays: cfg.trialDays,
      plans: cfg.plans,
      welcomeMessage: cfg.welcomeMessage ?? '',
      maxRedemptions: cfg.maxRedemptions ?? undefined,
      expiresAt: p.expiresAt ? p.expiresAt.slice(0, 10) : '',
      displayName: cfg.displayName ?? '',
      skipSubscription: cfg.skipSubscription === true,
      accountLast: cfg.accountLast === true,
    });
    const l = cfg.landing;
    setLandingText(landingTextOf(l));
    setRules({ title: cfg.campaignRules?.title ?? '', content: cfg.campaignRules?.content ?? '' });
    setImageState({ currentUrl: p.landingImageUrl, currentKey: l?.imageKey ?? null, pendingFile: null, remove: false });
    const next = emptyDiscountStates();
    (['monthly', 'yearly'] as const).forEach(plan => {
      const d = cfg.discounts?.[plan];
      if (d) {
        next[plan] = {
          enabled: true,
          type: d.percentOff != null ? 'percent' : 'amount',
          duration: d.duration as DiscountDuration,
          percentOff: d.percentOff ?? 20,
          amountOff: d.amountOff ?? 1000,
          currency: d.currency ?? 'sgd',
          durationMonths: d.durationMonths ?? 3,
        };
      }
    });
    setDiscountStates(next);
    setEditingId(asCopy ? null : p.id);
    setSaveError(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function buildDiscounts(): PartnerCreatePayload['discounts'] {
    const build = (s: DiscountFormState) => {
      if (!s.enabled) return null;
      const base = { duration: s.duration, ...(s.duration === 'repeating' ? { durationMonths: s.durationMonths } : {}) };
      return s.type === 'percent'
        ? { ...base, percentOff: s.percentOff }
        : { ...base, amountOff: s.amountOff, currency: s.currency };
    };
    // Only offered plans can carry a discount — a toggle left on for an unticked plan is ignored.
    const offered = (plan: PlanKey) => form.plans?.includes(plan) ?? true;
    return {
      monthly: offered('monthly') ? build(discountStates.monthly) : null,
      yearly: offered('yearly') ? build(discountStates.yearly) : null,
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const landing: PartnerCreatePayload['landing'] = {
        ...landingText,
        // Duplicating: reuse the source's image key unless it was replaced/removed.
        ...(!editingId && imageState.currentKey && !imageState.remove && !imageState.pendingFile
          ? { imageKey: imageState.currentKey }
          : {}),
      };
      const payload: PartnerCreatePayload = {
        ...form,
        discounts: buildDiscounts(),
        // null (not undefined) so clearing a field on edit actually clears it server-side.
        maxRedemptions: form.maxRedemptions || null,
        expiresAt: form.expiresAt || null,
        welcomeMessage: form.welcomeMessage || null,
        displayName: form.displayName || null,
        landing,
        // Only campaigns show the consent checkbox; no content = no rules.
        campaignRules: form.kind === 'CAMPAIGN' && rules.content.trim()
          ? { title: rules.title.trim() || null, content: rules.content }
          : null,
      };
      let saved = editingId
        ? await updatePartner(editingId, payload, callOpts)
        : await createPartner(payload, callOpts);

      // Image changes need the row's id, so they run after the save.
      try {
        if (imageState.pendingFile) {
          saved = await uploadPartnerLandingImage(saved.id, imageState.pendingFile, callOpts);
        } else if (editingId && imageState.remove && imageState.currentKey) {
          saved = await removePartnerLandingImage(saved.id, callOpts);
        }
      } catch (imgErr: unknown) {
        // The row itself is saved — keep the form open on it so the image can be retried.
        setPartners(prev => editingId ? prev.map(p => p.id === saved.id ? saved : p) : [saved, ...prev]);
        openFrom(saved, false);
        setSaveError(`Saved, but the image failed: ${imgErr instanceof Error ? imgErr.message : 'upload error'}`);
        return;
      }

      setPartners(prev => editingId ? prev.map(p => p.id === saved.id ? saved : p) : [saved, ...prev]);
      setShowForm(false);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(partner: Partner) {
    const referralWarning = partner.slug === REFERRAL_PARTNER_SLUG
      ? '\n\nWARNING: this is the reserved referral partner. Deactivating it stops referred users from getting the referral trial.'
      : '';
    if (!window.confirm(`Deactivate partner "${partner.name}"?\n\nNew signups will be blocked. Users who already signed up keep their offer.${referralWarning}`)) return;
    setStatusChangingId(partner.id);
    try {
      await deactivatePartner(partner.id, callOpts);
      setPartners(prev => prev.map(p => p.id === partner.id ? { ...p, status: 'EXPIRED' } : p));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setStatusChangingId(null);
    }
  }

  async function handleReactivate(partner: Partner) {
    if (!window.confirm(`Reactivate partner "${partner.name}"? New signups through its link will be allowed again.`)) return;
    setStatusChangingId(partner.id);
    try {
      const updated = await updatePartner(partner.id, { status: 'ACTIVE' }, callOpts);
      setPartners(prev => prev.map(p => p.id === updated.id ? updated : p));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setStatusChangingId(null);
    }
  }

  function copyUrl(partner: Partner) {
    navigator.clipboard.writeText(partner.signupUrl).catch(() => {});
  }

  function openQr(partner: Partner) {
    setQrError(null);
    setQrPartner(partner);
  }

  async function openUsers(partner: Partner) {
    setUsersError(null);
    setPartnerUsers([]);
    setUsersPartner(partner);
    setUsersLoading(true);
    try {
      setPartnerUsers(await getPartnerUsers(partner.id, callOpts));
    } catch (e: unknown) {
      setUsersError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }

  async function handleGenerateQr() {
    if (!qrPartner) return;
    setQrGenerating(true);
    setQrError(null);
    try {
      const updated = await regeneratePartnerQrCode(qrPartner.id, callOpts);
      setPartners(prev => prev.map(p => p.id === updated.id ? updated : p));
      setQrPartner(updated);
    } catch (e: unknown) {
      setQrError(e instanceof Error ? e.message : 'Failed to generate QR code');
    } finally {
      setQrGenerating(false);
    }
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  const planLabels = (plans: string[]) => plans.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ');

  const isCampaign = form.kind === 'CAMPAIGN';
  const visiblePartners = kindFilter === 'ALL' ? partners : partners.filter(p => p.kind === kindFilter);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Partners &amp; Campaigns</h1>
          <p className="page-subtitle">
            {partners.filter(p => p.status === 'ACTIVE' && p.kind === 'PARTNER').length} active partners
            {' · '}
            {partners.filter(p => p.status === 'ACTIVE' && p.kind === 'CAMPAIGN').length} active campaigns
            {env === 'prod' && <span className="env-badge prod">PROD</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => openCreate('CAMPAIGN')}>+ New Campaign</button>
          <button className="btn btn-primary" onClick={() => openCreate('PARTNER')}>+ New Partner</button>
        </div>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div style={{
          background: '#f9fafb', border: '1px solid #e5e7eb',
          borderRadius: 12, padding: '24px', marginBottom: 32,
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>
            {editingId ? 'Edit' : 'Create'} {isCampaign ? 'Campaign' : 'Partner'}
          </h3>
          <form onSubmit={handleSave}>
            {/* Type */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>Type</span>
              {(['PARTNER', 'CAMPAIGN'] as const).map(k => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio" name="kind" checked={form.kind === k}
                    onChange={() => setForm(f => ({ ...f, kind: k }))}
                  />
                  {k === 'PARTNER' ? 'Partner (clinic, employer…)' : 'Marketing campaign'}
                </label>
              ))}
            </div>
            {/* Basic fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <label style={{ fontSize: 13 }}>
                <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Name *</span>
                <input
                  style={inputStyle}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={isCampaign ? 'Oct FB ad — toddler parents (internal)' : 'SGH Family Medicine'}
                  required
                />
              </label>
              <label style={{ fontSize: 13 }}>
                <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Slug * (URL token)</span>
                <input
                  style={inputStyle}
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                  placeholder={isCampaign ? 'oct-toddlers' : 'sgh-family'}
                  required
                  disabled={!!editingId}
                />
              </label>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13 }}>
                <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                  Public display name (optional)
                </span>
                <input
                  style={inputStyle}
                  value={form.displayName ?? ''}
                  maxLength={80}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  placeholder={isCampaign ? 'Hidden — shows "Special discount" with no name' : `Defaults to the name above`}
                />
                <span style={{ display: 'block', color: '#6b7280', fontSize: 12, marginTop: 4 }}>
                  Shown to users as "Special discount for …" on the subscribe page.
                </span>
              </label>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13 }}>
                <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Welcome message (optional)</span>
                <input
                  style={inputStyle}
                  value={form.welcomeMessage ?? ''}
                  onChange={e => setForm(f => ({ ...f, welcomeMessage: e.target.value }))}
                  placeholder="Welcome, SGH partners! Enjoy your exclusive offer."
                />
              </label>
            </div>
            {/* Skip subscription */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.skipSubscription === true}
                  onChange={e => setForm(f => ({ ...f, skipSubscription: e.target.checked }))}
                />
                <span style={{ fontWeight: 600 }}>Skip the subscription / offer page</span>
              </label>
              <span style={{ display: 'block', color: '#6b7280', fontSize: 12, marginTop: 4, marginLeft: 24 }}>
                Users go straight from onboarding to the "You're all set" download page, with no checkout.
                They get the free trial below (no card needed), then can subscribe in the mobile app at standard pricing.
              </span>
            </div>
            {/* Account at the end */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.accountLast === true}
                  onChange={e => setForm(f => ({ ...f, accountLast: e.target.checked }))}
                />
                <span style={{ fontWeight: 600 }}>Ask for the account at the end of signup</span>
              </label>
              <span style={{ display: 'block', color: '#6b7280', fontSize: 12, marginTop: 4, marginLeft: 24 }}>
                Users answer the onboarding questions first and create their account just before the offer page.
                Anonymous progress (child birth year, concerns, survey score, last screen) is recorded for people who don't finish — see "links &amp; stats".
                {form.skipSubscription && (
                  <strong style={{ display: 'block', color: '#92400e', marginTop: 4 }}>
                    Not recommended with "skip subscription": people who leave early and sign up in the app instead lose this link's free trial.
                  </strong>
                )}
              </span>
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
                  value={form.expiresAt ?? ''}
                  onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                />
              </label>
            </div>

            {/* Plans + discounts — irrelevant when the offer page is skipped */}
            {!form.skipSubscription && (<>
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

            {/* Discounts — configured independently per plan, only for plans currently shown */}
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Discounts</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(['monthly', 'yearly'] as const)
                  .filter(plan => form.plans?.includes(plan))
                  .map(plan => {
                    const s = discountStates[plan];
                    const update = (patch: Partial<DiscountFormState>) =>
                      setDiscountStates(prev => ({ ...prev, [plan]: { ...prev[plan], ...patch } }));
                    return (
                      <div key={plan} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 14 }}>
                        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, marginBottom: s.enabled ? 10 : 0, cursor: 'pointer' }}>
                          <input type="checkbox" checked={s.enabled} onChange={e => update({ enabled: e.target.checked })} />
                          <span style={{ fontWeight: 600 }}>
                            Apply a discount to {plan.charAt(0).toUpperCase() + plan.slice(1)}
                          </span>
                        </label>
                        {s.enabled && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                            <label style={{ fontSize: 13 }}>
                              <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Type</span>
                              <select style={inputStyle} value={s.type} onChange={e => update({ type: e.target.value as 'percent' | 'amount' })}>
                                <option value="percent">Percent off</option>
                                <option value="amount">Amount off</option>
                              </select>
                            </label>
                            {s.type === 'percent' ? (
                              <label style={{ fontSize: 13 }}>
                                <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>% off</span>
                                <input
                                  type="number" min={1} max={100} style={inputStyle}
                                  value={s.percentOff}
                                  onChange={e => update({ percentOff: Number(e.target.value) })}
                                />
                              </label>
                            ) : (
                              <label style={{ fontSize: 13 }}>
                                <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Amount off (cents)</span>
                                <input
                                  type="number" min={1} style={inputStyle}
                                  value={s.amountOff}
                                  placeholder="e.g. 1000 = $10"
                                  onChange={e => update({ amountOff: Number(e.target.value) })}
                                />
                              </label>
                            )}
                            <label style={{ fontSize: 13 }}>
                              <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Duration</span>
                              <select style={inputStyle} value={s.duration} onChange={e => update({ duration: e.target.value as DiscountDuration })}>
                                <option value="forever">Forever</option>
                                <option value="once">First payment only</option>
                                <option value="repeating">N months</option>
                              </select>
                            </label>
                            {s.duration === 'repeating' && (
                              <label style={{ fontSize: 13 }}>
                                <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Months</span>
                                <input
                                  type="number" min={1} style={inputStyle}
                                  value={s.durationMonths}
                                  onChange={e => update({ durationMonths: Number(e.target.value) })}
                                />
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
            </>)}

            {/* Signup screen messages + live preview */}
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 2 }}>Signup screen messages</span>
              <span style={{ display: 'block', color: '#6b7280', fontSize: 12, marginBottom: 10 }}>
                Optional. Leave a field blank to keep the default text (shown greyed out). Line breaks are kept.
                This is the copy for the plain <code>/p/{form.slug || 'slug'}</code> link — to test different messages
                (and get per-channel links), add message variants under <b>Messages &amp; links</b> after saving.
              </span>
              <LandingEditor
                text={landingText} onTextChange={setLandingText}
                image={imageState} onImageChange={setImageState}
              />
            </div>

            {/* Campaign rules — linked from the consent checkbox on the create-account screen */}
            {isCampaign && (
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 2 }}>Campaign rules</span>
                <span style={{ display: 'block', color: '#6b7280', fontSize: 12, marginBottom: 10 }}>
                  Campaign signups must tick a consent checkbox on the create-account screen: "I am the parent or legal
                  guardian of the participating child, and I agree to the <b>{rules.title.trim() || 'Campaign Rules'}</b> and
                  Nora Parenting's standard Terms of Service and Privacy Policy." The rules title opens the content below.
                  Leave the content empty to drop the rules part (the checkbox then covers only the Terms and Privacy Policy).
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <LandingField
                    label="Rules title" multiline={false}
                    value={rules.title} placeholder="21-Day Challenge Campaign Rules" maxLength={120}
                    onChange={v => setRules(r => ({ ...r, title: v }))}
                  />
                  <label style={{ fontSize: 13 }}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: 4 }}>
                      Rules content
                      <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 11 }}>{rules.content.length}/20000</span>
                    </span>
                    <textarea
                      style={{ ...inputStyle, height: 220, padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit' }}
                      value={rules.content} maxLength={20000}
                      placeholder={'1. Eligibility…\n2. How to participate…\n3. Rewards…'}
                      onChange={e => setRules(r => ({ ...r, content: e.target.value }))}
                    />
                  </label>
                </div>
              </div>
            )}

            {saveError && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 10 }}>{saveError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : `Create ${isCampaign ? 'campaign' : 'partner'}`}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="loading-state">Loading…</div>}
      {error && <div className="error-state">{error}</div>}

      {!loading && !error && partners.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {([['ALL', 'All'], ['PARTNER', 'Partners'], ['CAMPAIGN', 'Campaigns']] as const).map(([k, label]) => (
            <button
              key={k}
              className={`btn ${kindFilter === k ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 12, padding: '2px 12px', height: 28 }}
              onClick={() => setKindFilter(k)}
            >
              {label} ({k === 'ALL' ? partners.length : partners.filter(p => p.kind === k).length})
            </button>
          ))}
        </div>
      )}

      {!loading && !error && (
        visiblePartners.length === 0 ? (
          <div className="empty-state">
            {partners.length === 0 ? 'No partners or campaigns yet.' : 'Nothing in this filter yet.'}
          </div>
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
              {visiblePartners.map(p => (
                <tr key={p.id}>
                  <td>
                    <p style={{ fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {p.name}
                      {p.kind === 'CAMPAIGN' && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: '#ede9fe', color: '#6d28d9' }}>
                          CAMPAIGN
                        </span>
                      )}
                    </p>
                    {p.config.landing?.headline && (
                      <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>“{p.config.landing.headline}”</p>
                    )}
                    {p.slug === REFERRAL_PARTNER_SLUG && (
                      <p style={{ fontSize: 12, color: '#92400e', margin: 0 }}>Reserved — powers referral-link trials</p>
                    )}
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
                        onClick={() => copyUrl(p)}
                        title="Copy URL"
                      >
                        Copy
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 11, padding: '2px 8px', height: 24 }}
                        onClick={() => openQr(p)}
                        title="QR code"
                      >
                        QR
                      </button>
                    </div>
                    <button
                      className="link-btn"
                      style={{ color: '#7c3aed', padding: 0, marginTop: 4, font: 'inherit', fontSize: 12, cursor: 'pointer' }}
                      onClick={() => setLinksPartnerId(p.id)}
                    >
                      {p.messages.length > 0
                        ? `${p.messages.filter(m => m.active).length} message${p.messages.filter(m => m.active).length === 1 ? '' : 's'} · links & stats`
                        : 'Messages, links & stats'}
                    </button>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {p.config.skipSubscription ? (
                      <p style={{ margin: '0 0 2px', color: '#6b7280' }}>{p.config.trialDays}d trial · no offer page</p>
                    ) : (
                      <p style={{ margin: '0 0 2px' }}>{p.config.trialDays}d trial · {planLabels(p.config.plans)}</p>
                    )}
                    {!p.config.skipSubscription && p.discountLabels.monthly && (
                      <p style={{ margin: 0, color: '#7c3aed', fontWeight: 600 }}>Monthly: {p.discountLabels.monthly}</p>
                    )}
                    {!p.config.skipSubscription && p.discountLabels.yearly && (
                      <p style={{ margin: 0, color: '#7c3aed', fontWeight: 600 }}>Yearly: {p.discountLabels.yearly}</p>
                    )}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {p.visits} visits
                    <br />
                    {p.redemptions}{p.config.maxRedemptions ? ` / ${p.config.maxRedemptions}` : ''} signups
                    {p.visits > 0 && (
                      <span style={{ color: '#6b7280' }}> ({Math.round((p.redemptions / p.visits) * 100)}%)</span>
                    )}
                    <br />
                    <button
                      className="link-btn"
                      style={{ color: '#6b7280', padding: 0, font: 'inherit', cursor: p.userCount ? 'pointer' : 'default' }}
                      onClick={() => p.userCount && openUsers(p)}
                      disabled={!p.userCount}
                    >
                      {p.userCount} users
                    </button>
                  </td>
                  <td>{statusBadge(p.status)}</td>
                  <td style={{ fontSize: 13, color: '#6b7280' }}>{fmt(p.createdAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: '2px 10px', height: 26 }}
                        onClick={() => openFrom(p, false)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: '2px 10px', height: 26 }}
                        onClick={() => openFrom(p, true)}
                        title="Create a new link with the same offer and messages"
                      >
                        Duplicate
                      </button>
                      {p.status === 'ACTIVE' ? (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: '2px 10px', height: 26 }}
                          disabled={statusChangingId === p.id}
                          onClick={() => handleDeactivate(p)}
                        >
                          {statusChangingId === p.id ? '…' : 'Deactivate'}
                        </button>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: '2px 10px', height: 26 }}
                          disabled={statusChangingId === p.id}
                          onClick={() => handleReactivate(p)}
                        >
                          {statusChangingId === p.id ? '…' : 'Reactivate'}
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

      {qrPartner && (
        <div className="modal-overlay" onClick={() => setQrPartner(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: 360, textAlign: 'center' }}>
            <div className="modal-header">
              <h2>{qrPartner.name}</h2>
              <button className="btn-remove" onClick={() => setQrPartner(null)}>&times;</button>
            </div>
            <code style={{ fontSize: 12, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
              {qrPartner.signupUrl}
            </code>
            <div style={{ margin: '16px 0' }}>
              {qrPartner.qrCodeUrl ? (
                <img
                  src={qrPartner.qrCodeUrl}
                  alt={`QR code for ${qrPartner.name}`}
                  style={{ width: 240, height: 240, border: '1px solid #e5e7eb', borderRadius: 8 }}
                />
              ) : (
                <p style={{ fontSize: 13, color: '#6b7280' }}>No QR code yet for this partner.</p>
              )}
            </div>
            {qrError && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 10 }}>{qrError}</p>}
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              {qrPartner.qrCodeUrl ? (
                <>
                  <a
                    className="btn btn-secondary"
                    href={qrPartner.qrCodeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open in new tab
                  </a>
                  <button className="btn btn-secondary" disabled={qrGenerating} onClick={handleGenerateQr}>
                    {qrGenerating ? 'Regenerating…' : 'Regenerate'}
                  </button>
                </>
              ) : (
                <button className="btn btn-primary" disabled={qrGenerating} onClick={handleGenerateQr}>
                  {qrGenerating ? 'Generating…' : 'Generate QR code'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {linksPartner && (
        <CampaignLinksModal
          partner={linksPartner}
          callOpts={callOpts}
          onUpdated={updated => setPartners(prev => prev.map(p => p.id === updated.id ? updated : p))}
          onClose={() => setLinksPartnerId(null)}
        />
      )}

      {usersPartner && (
        <div className="modal-overlay" onClick={() => setUsersPartner(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: 760 }}>
            <div className="modal-header">
              <h2>{usersPartner.name} — signed-up users</h2>
              <button className="btn-remove" onClick={() => setUsersPartner(null)}>&times;</button>
            </div>
            {usersLoading && <div className="loading-state">Loading…</div>}
            {usersError && <div className="error-state">{usersError}</div>}
            {!usersLoading && !usersError && (
              partnerUsers.length === 0 ? (
                <div className="empty-state">No signed-up users for this partner yet.</div>
              ) : (
                <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Joined</th>
                        <th>Message / channel</th>
                        <th>Subscription</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {partnerUsers.map(u => (
                        <tr key={u.id}>
                          <td>{u.name || '—'}</td>
                          <td style={{ fontSize: 13 }}>{u.email || '—'}</td>
                          <td style={{ fontSize: 13, color: '#6b7280' }}>{fmt(u.createdAt)}</td>
                          <td style={{ fontSize: 12, color: '#6b7280' }}>
                            {u.messageKey ?? 'default'} · {u.signupSource ?? '—'}
                          </td>
                          <td>{subscriptionBadge(u.subscriptionStatus)}</td>
                          <td>
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: 12, padding: '2px 10px', height: 26 }}
                              onClick={() => navigate(`/users/${u.id}`)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
