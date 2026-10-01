import { useState, useEffect } from 'react';
import type { PartnerLandingText } from '../../api/adminApi';
import defaultSignupImage from '../../assets/signup-default.jpg';

// Default copy of the customisable web signup screens (web/src/screens/LandingScreen.tsx,
// CreateAccountScreen.tsx, SuccessScreen.tsx) — shown as placeholders and in the preview.
export const DEFAULT_LANDING: Record<keyof PartnerLandingText, string> = {
  headline: 'Raise confident, happy kids — with just 5 minutes a day',
  subtext: 'Science-backed parenting coaching, personalized for your child',
  ctaText: 'Get Started',
  accountTitle: 'Create your account',
  accountSubtitle: 'Join thousands of parents raising happier, more confident kids.',
  successTitle: "You're all set!",
  successSubtitle: 'Your account is ready. Download the Nora app to start your first play session. Log in with your email and password in the Nora mobile app.',
};

// Mirrors server/utils/partnerLanding.cjs LANDING_LIMITS.
export const LANDING_LIMITS: Record<keyof PartnerLandingText, number> = {
  headline: 120, subtext: 300, ctaText: 40, accountTitle: 80, accountSubtitle: 300,
  successTitle: 80, successSubtitle: 300,
};

export const emptyLandingText = (): PartnerLandingText => ({
  headline: null, subtext: null, ctaText: null, accountTitle: null, accountSubtitle: null,
  successTitle: null, successSubtitle: null,
});

export function landingTextOf(l: Partial<PartnerLandingText> | null | undefined): PartnerLandingText {
  return {
    headline: l?.headline ?? null,
    subtext: l?.subtext ?? null,
    ctaText: l?.ctaText ?? null,
    accountTitle: l?.accountTitle ?? null,
    accountSubtitle: l?.accountSubtitle ?? null,
    successTitle: l?.successTitle ?? null,
    successSubtitle: l?.successSubtitle ?? null,
  };
}

// Hero image edits are applied after the row is saved (the upload needs its id).
export interface LandingImageState {
  currentUrl: string | null;   // presigned URL of the saved (or duplicated) image
  currentKey: string | null;   // S3 key — only sent on create, when duplicating
  pendingFile: File | null;    // new upload chosen in the form
  remove: boolean;             // revert to the fallback image on save
}

export const emptyImageState = (): LandingImageState => ({ currentUrl: null, currentKey: null, pendingFile: null, remove: false });

/**
 * Signup-screen copy fields + hero image + live phone previews. `fallback` is the copy a
 * blank field inherits (a campaign message inherits the campaign's copy); anything still
 * blank uses the web app's default.
 */
export function LandingEditor({ text, onTextChange, image, onImageChange, fallback, fallbackImageUrl, fallbackImageLabel = 'Default image' }: {
  text: PartnerLandingText;
  onTextChange: (text: PartnerLandingText) => void;
  image: LandingImageState;
  onImageChange: (image: LandingImageState) => void;
  fallback?: PartnerLandingText | null;
  fallbackImageUrl?: string | null;
  fallbackImageLabel?: string;
}) {
  // Object URL for previewing a not-yet-uploaded hero image.
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!image.pendingFile) {
      setPendingPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(image.pendingFile);
    setPendingPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image.pendingFile]);

  const hasOwnImage = !!image.pendingFile || (!!image.currentUrl && !image.remove);
  const previewImage = image.pendingFile
    ? pendingPreviewUrl
    : (!image.remove && image.currentUrl) || fallbackImageUrl || defaultSignupImage;
  const inherited = (field: keyof PartnerLandingText) => fallback?.[field] || DEFAULT_LANDING[field];
  const shown = (field: keyof PartnerLandingText) => text[field] || inherited(field);
  const setField = (field: keyof PartnerLandingText, value: string) =>
    onTextChange({ ...text, [field]: value || null });

  const fields = (list: readonly (readonly [keyof PartnerLandingText, string, boolean])[]) => list.map(([field, label, multiline]) => (
    <LandingField
      key={field} label={label} multiline={multiline}
      value={text[field]} placeholder={inherited(field)} maxLength={LANDING_LIMITS[field]}
      onChange={v => setField(field, v)}
    />
  ));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 20, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#6b7280' }}>SCREEN 1 · WELCOME</p>
        <div style={{ fontSize: 13 }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Hero image</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <label className="btn btn-secondary" style={{ fontSize: 12, padding: '2px 10px', height: 28, cursor: 'pointer' }}>
              {hasOwnImage ? 'Replace image' : 'Upload image'}
              <input
                type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0] ?? null;
                  e.target.value = '';
                  if (file) onImageChange({ ...image, pendingFile: file, remove: false });
                }}
              />
            </label>
            {hasOwnImage && (
              <button
                type="button" className="btn btn-secondary"
                style={{ fontSize: 12, padding: '2px 10px', height: 28 }}
                onClick={() => onImageChange({ ...image, pendingFile: null, remove: true })}
              >
                Use {fallbackImageLabel.toLowerCase()}
              </button>
            )}
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              {image.pendingFile
                ? `New: ${image.pendingFile.name} (uploads on save)`
                : hasOwnImage ? 'Custom image' : fallbackImageLabel}
            </span>
          </div>
        </div>
        {fields([
          ['headline', 'Headline', true],
          ['subtext', 'Subtext', true],
          ['ctaText', 'Button text', false],
        ] as const)}
        <p style={{ margin: '6px 0 0', fontSize: 12, fontWeight: 700, color: '#6b7280' }}>SCREEN 2 · CREATE ACCOUNT</p>
        {fields([
          ['accountTitle', 'Title', false],
          ['accountSubtitle', 'Subtitle', true],
        ] as const)}
        <p style={{ margin: '6px 0 0', fontSize: 12, fontWeight: 700, color: '#6b7280' }}>LAST SCREEN · ALL SET (DOWNLOAD APP)</p>
        {fields([
          ['successTitle', 'Title', false],
          ['successSubtitle', 'Message', true],
        ] as const)}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', maxWidth: 406 }}>
        <PhonePreview label="Screen 1">
          <div style={{ width: '100%', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
            <img src={previewImage ?? defaultSignupImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, textAlign: 'center', color: '#1E2939', whiteSpace: 'pre-line', lineHeight: 1.25 }}>
            {shown('headline')}
          </p>
          <p style={{ margin: 0, fontSize: 10, textAlign: 'center', color: '#6B7280', whiteSpace: 'pre-line' }}>
            {shown('subtext')}
          </p>
          <div style={{ marginTop: 'auto', background: '#8C49D5', color: '#fff', borderRadius: 999, padding: '7px 0', textAlign: 'center', fontSize: 11, fontWeight: 600 }}>
            {shown('ctaText')}
          </div>
        </PhonePreview>
        <PhonePreview label="Screen 2">
          <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#1E2939', whiteSpace: 'pre-line' }}>
            {shown('accountTitle')}
          </p>
          <p style={{ margin: '0 0 14px', fontSize: 10, color: '#6B7280', whiteSpace: 'pre-line' }}>
            {shown('accountSubtitle')}
          </p>
          {['Email', 'Password'].map(f => (
            <div key={f} style={{ marginBottom: 8 }}>
              <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 600, color: '#1E2939' }}>{f}</p>
              <div style={{ height: 22, border: '1px solid #e5e7eb', borderRadius: 6 }} />
            </div>
          ))}
          <div style={{ marginTop: 'auto', background: '#8C49D5', color: '#fff', borderRadius: 999, padding: '7px 0', textAlign: 'center', fontSize: 11, fontWeight: 600 }}>
            Create Account
          </div>
        </PhonePreview>
        <PhonePreview label="Last screen">
          <p style={{ margin: '16px 0 6px', fontSize: 14, fontWeight: 700, textAlign: 'center', color: '#1E2939', whiteSpace: 'pre-line' }}>
            {shown('successTitle')}
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 10, textAlign: 'center', color: '#6B7280', whiteSpace: 'pre-line', lineHeight: 1.4 }}>
            {shown('successSubtitle')}
          </p>
          <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 600, textAlign: 'center', color: '#1E2939' }}>Download the Nora App</p>
          <div style={{ display: 'flex', gap: 6 }}>
            {['App Store', 'Google Play'].map(s => (
              <div key={s} style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 999, padding: '6px 0', textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#1E2939' }}>{s}</div>
            ))}
          </div>
        </PhonePreview>
      </div>
    </div>
  );
}

export function LandingField({ label, value, placeholder, maxLength, multiline, onChange }: {
  label: string;
  value: string | null;
  placeholder: string;
  maxLength: number;
  multiline: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ fontSize: 13 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: 4 }}>
        {label}
        <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 11 }}>{(value ?? '').length}/{maxLength}</span>
      </span>
      {multiline ? (
        <textarea
          style={{ ...inputStyle, height: 60, padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit' }}
          value={value ?? ''} placeholder={placeholder} maxLength={maxLength}
          onChange={e => onChange(e.target.value)}
        />
      ) : (
        <input
          style={inputStyle}
          value={value ?? ''} placeholder={placeholder} maxLength={maxLength}
          onChange={e => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

// Rough phone-sized mock of a web signup screen, for previewing campaign copy.
function PhonePreview({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 190, height: 380, border: '6px solid #1f2937', borderRadius: 22, background: '#fff',
        padding: '14px 12px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', textAlign: 'left',
        overflow: 'hidden',
      }}>
        {children}
      </div>
      <span style={{ fontSize: 11, color: '#6b7280' }}>{label}</span>
    </div>
  );
}

export const inputStyle: React.CSSProperties = {
  width: '100%', height: 36, borderRadius: 8,
  border: '1px solid #d1d5db', padding: '0 10px', fontSize: 13,
  boxSizing: 'border-box',
};
