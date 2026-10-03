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
  const { setPartnerInfo } = useOnboarding();

  useEffect(() => {
    if (!slug) {
      navigate('/', { replace: true });
      return;
    }
    // The server echoes back the resolved messageKey/source (stored with the rest of
    // partnerInfo, so a returning visitor stays attributed to the same message/channel).
    validatePartner(slug, { messageKey, source: searchParams.get('src') })
      .then(info => {
        setPartnerInfo({ slug, ...info });
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
        trackEvent('Signup Link Opened', {
          ...entryAttribution(),
          valid: false, partnerSlug: slug, messageKey: messageKey ?? null, source: searchParams.get('src'),
        });
      })
      .finally(() => navigate('/', { replace: true }));
  }, [slug, messageKey]);

  return null;
}
