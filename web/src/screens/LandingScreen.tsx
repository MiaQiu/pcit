import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../components/OnboardingLayout';
import PrimaryButton from '../components/PrimaryButton';
import { useOnboarding } from '../contexts/OnboardingContext';
import signupImage from '../assets/images/signup.jpg';

export default function LandingScreen() {
  const navigate = useNavigate();
  // Campaign links (/p/:slug) can override this screen's copy and image; any
  // field left blank in the admin portal keeps the default below.
  const landing = useOnboarding().data.partnerInfo?.landing;
  const [customImageFailed, setCustomImageFailed] = useState(false);
  const heroImage = landing?.imageUrl && !customImageFailed ? landing.imageUrl : signupImage;

  return (
    <OnboardingLayout>
      {/* Content */}
      <div className="flex-1 flex flex-col px-6 pt-8 pb-8">
        {/* Hero illustration */}
        <div className="w-full aspect-square rounded-2xl overflow-hidden mb-8">
          <img
            src={heroImage}
            alt=""
            className="w-full h-full object-cover"
            // The custom image is a presigned URL that expires — fall back to the default.
            onError={() => setCustomImageFailed(true)}
          />
        </div>

        <h2 className="text-[#1E2939] text-2xl font-bold text-center mb-3 leading-tight whitespace-pre-line">
          {landing?.headline || 'Raise confident, happy kids — with just 5 minutes a day'}
        </h2>
        <p className="text-[#6B7280] text-sm text-center mb-8 leading-relaxed whitespace-pre-line">
          {landing?.subtext || 'Science-backed parenting coaching, personalized for your child'}
        </p>

        <div className="mt-auto">
          <PrimaryButton onClick={() => navigate('/create-account')}>
            {landing?.ctaText || 'Get Started'}
          </PrimaryButton>
        </div>
      </div>
    </OnboardingLayout>
  );
}
