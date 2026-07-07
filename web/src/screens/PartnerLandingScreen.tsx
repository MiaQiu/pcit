import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { validatePartner } from '../api';
import { useOnboarding } from '../contexts/OnboardingContext';

// QR-code/marketing-link destination (/p/:slug). No visible UI — loads and saves the
// partner's discount/trial config into OnboardingContext (persisted to localStorage), then
// redirects straight into the normal signup flow. An invalid/expired slug just falls through
// to the normal flow with no partner attached, rather than showing a dead-end error screen.
export default function PartnerLandingScreen() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { setPartnerInfo } = useOnboarding();

  useEffect(() => {
    if (!slug) {
      navigate('/', { replace: true });
      return;
    }
    validatePartner(slug)
      .then(info => setPartnerInfo({ slug, ...info }))
      .catch(() => {})
      .finally(() => navigate('/', { replace: true }));
  }, [slug]);

  return null;
}
