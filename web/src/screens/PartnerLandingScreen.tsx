import React, { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { validatePartner } from '../api';
import { useOnboarding } from '../contexts/OnboardingContext';
import { entryAttribution, trackEvent } from '../analytics';

// QR-code/marketing-link destination (/p/:slug, or /p/:slug/:messageKey for a campaign
// message variant; ?src=<channel> tags the ad channel on either). No visible UI — loads and saves the
// partner's discount/trial config into OnboardingContext (persisted to localStorage), then
// redirects straight into the normal signup flow. An invalid/expired slug just falls through
// to the normal flow with no partner attached, rather than showing a dead-end error screen.
export default function PartnerLandingScreen() {
  const { slug, messageKey } = useParams<{ slug: string; messageKey?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setPartnerInfo, setAccessToken, setSignupDraftId } = useOnboarding();

  useEffect(() => {
    if (!slug) {
      navigate('/', { replace: true });
      return;
    }
    // The server echoes back the resolved messageKey/source (stored with the rest of
    // partnerInfo, so a returning visitor stays attributed to the same message/channel).
    // A superseded run (React StrictMode's double effect in dev) is ignored, so its late
    // response can't reset state after the visitor has moved on.
    let cancelled = false;
    validatePartner(slug, { messageKey, source: searchParams.get('src') })
      .then(info => {
        if (cancelled) return;
        setPartnerInfo({ slug, ...info });
        if (info.accountLast) {
          // Account-last links start a fresh signup: a token left from an earlier signup in
          // this browser would otherwise send this visitor's answers to that old account.
          setAccessToken(null);
          setSignupDraftId(null);
        }
        trackEvent('Signup Link Opened', {
          ...entryAttribution(),
          valid: true,
          linkType: info.kind === 'CAMPAIGN' ? 'campaign' : 'partner',
          partnerSlug: slug,
          partnerKind: info.kind ?? null,
          messageKey: info.messageKey ?? null,
          source: info.source ?? null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        trackEvent('Signup Link Opened', {
          ...entryAttribution(),
          valid: false, partnerSlug: slug, messageKey: messageKey ?? null, source: searchParams.get('src'),
        });
      })
      .finally(() => { if (!cancelled) navigate('/', { replace: true }); });
    return () => { cancelled = true; };
  }, [slug, messageKey]);

  return null;
}
