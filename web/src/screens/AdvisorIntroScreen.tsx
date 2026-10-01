import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../components/OnboardingLayout';
import BackButton from '../components/BackButton';
import PrimaryButton from '../components/PrimaryButton';
import advisorImage from '../assets/images/advisor.png';

// Web port of the mobile OB2Screen_v2 (clinical advisor intro). Shown to every
// signup, between LandingScreen and /create-account.
// advisor.png is the text-free OB-2_v2.png (690x552); the text is overlaid at the
// same percentage positions as the mobile screen. Font sizes use container-width
// units so the overlay scales with the image.
export default function AdvisorIntroScreen() {
  const navigate = useNavigate();

  return (
    <OnboardingLayout>
      <div className="flex items-center px-4 pt-2">
        <BackButton to="/" />
      </div>

      <div className="flex-1 flex flex-col justify-center px-4">
        <div className="relative w-full aspect-[690/552]" style={{ containerType: 'inline-size' }}>
          <img src={advisorImage} alt="" className="w-full h-full object-contain" />
          <p
            className="absolute font-bold text-[#8C49D5]"
            style={{ top: '23%', left: '37%', width: '58%', fontSize: '4cqw', lineHeight: 1.2 }}
          >
            Prof. Yi-Chuen Chen, PhD
          </p>
          <p
            className="absolute text-[#1F2937]"
            style={{ top: '33%', left: '37%', width: '58%', fontSize: '3.2cqw', lineHeight: 1.35 }}
          >
            Clinical Child Psychologist
            <br />
            Clinical Advisor to Nora
          </p>
          <h1
            className="absolute text-center font-bold text-[#1F2937] whitespace-pre-line"
            style={{ top: '63%', left: '4%', width: '92%', fontSize: '5cqw', lineHeight: 1.27 }}
          >
            {'Nora helps you build the skills\nfor '}
            <span className="text-[#8C49D5]">hard moments</span>
            , together.
          </h1>
        </div>
      </div>

      <div className="px-6 pb-8 pt-3">
        <PrimaryButton onClick={() => navigate('/create-account')}>Continue</PrimaryButton>
      </div>
    </OnboardingLayout>
  );
}
