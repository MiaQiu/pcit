import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { validatePartner, referrerName } from '../api';
import { useOnboarding, type PartnerInfo } from '../contexts/OnboardingContext';

// Referral link destination (/join/:code). No visible UI — mirrors
// PartnerLandingScreen: saves the referral trial config + attribution code into
// OnboardingContext (persisted to localStorage), then drops the user into the
// normal signup flow. The referee then completes web onboarding + Stripe
// checkout and actually receives the 30-day trial, and the referrer link is
// recorded server-side at signup (POST /api/auth/signup with `referralCode`).

// Used if GET /api/partner/validate/referral is unreachable (row not seeded).
const FALLBACK_REFERRAL_OFFER: PartnerInfo = {
  slug: 'referral',
  name: 'Referral',
  welcomeMessage: null,
  trialDays: 30,
  plans: ['monthly', 'yearly'],
  discounts: { monthly: null, yearly: null },
};

export default function ReferralLandingScreen() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { setPartnerInfo, setReferral } = useOnboarding();

  useEffect(() => {
    if (!code) {
      navigate('/', { replace: true });
      return;
    }

    // Best-effort: attempt to open the app if it's installed.
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = `nora://join?referralCode=${encodeURIComponent(code)}`;
    document.body.appendChild(iframe);
    const iframeTimer = window.setTimeout(() => {
      try { document.body.removeChild(iframe); } catch { /* already gone */ }
    }, 2000);

    Promise.allSettled([
      validatePartner('referral'),
      referrerName(code),
    ])
      .then(([offer, referrer]) => {
        setPartnerInfo(
          offer.status === 'fulfilled'
            ? { slug: 'referral', ...offer.value }
            : FALLBACK_REFERRAL_OFFER
        );
        setReferral(
          code,
          referrer.status === 'fulfilled' ? referrer.value.firstName : null
        );
      })
      .finally(() => {
        window.clearTimeout(iframeTimer);
        navigate('/create-account', { replace: true });
      });
  }, [code]);

  return null;
}
