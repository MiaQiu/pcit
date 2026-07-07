import React from 'react';
import OnboardingLayout from '../components/OnboardingLayout';
import googlePlayIcon from '../assets/images/googleplay.png';

export default function SuccessScreen() {
  return (
    <OnboardingLayout>
      <div className="flex-1 flex flex-col px-6 py-12">
        {/* Success mark */}
        <div className="flex flex-col items-center mb-8">
          {/* <div className="w-16 h-16 bg-[#EDE9FE] rounded-full flex items-center justify-center mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17L4 12" stroke="#8C49D5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div> */}

          <h1 className="text-[#1E2939] text-2xl font-bold text-center mb-3">
            You're all set!
          </h1>
          <p className="text-[#6B7280] text-sm text-center leading-relaxed">
            Your account is ready. Download the Nora app to start your first play session. Log in with your email and password in the Nora mobile app.
          </p>
        </div>

        {/* Download section */}
        <div className="mb-6">
          <p className="text-[#1E2939] font-semibold text-sm text-center mb-4">
            Download the Nora App
          </p>

          <div className="flex flex-row gap-3">
            <a
              href="https://apps.apple.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 text-[#1E2939] rounded-full px-3 py-3 shadow-sm hover:bg-gray-50 transition-colors"
            >
              <svg width="22" height="26" viewBox="0 0 28 28" fill="none">
                <path d="M20.5 14.7C20.5 11.8 22.3 10.2 22.3 10.2C20.7 8.1 18.3 7.9 17.4 7.9C15.4 7.7 13.5 9.1 12.5 9.1C11.5 9.1 9.9 7.9 8.2 7.9C6.0 7.9 3.9 9.2 2.8 11.2C0.5 15.2 2.2 21 4.4 24.2C5.5 25.8 6.8 27.6 8.5 27.5C10.1 27.4 10.7 26.5 12.7 26.5C14.7 26.5 15.2 27.5 17.0 27.4C18.8 27.4 19.9 25.8 20.9 24.2C21.5 23.3 21.9 22.3 22.2 21.2C20.5 20.5 20.5 17.8 20.5 14.7Z" fill="#1E2939"/>
                <path d="M16.2 5.5C17.1 4.4 17.7 2.9 17.5 1.4C16.2 1.5 14.7 2.3 13.8 3.4C12.9 4.4 12.2 5.9 12.5 7.3C13.9 7.4 15.3 6.6 16.2 5.5Z" fill="#1E2939"/>
              </svg>
              <div className="text-left">
                <p className="text-[10px] text-gray-500 leading-tight">Download on the</p>
                <p className="font-bold text-sm leading-tight">App Store</p>
              </div>
            </a>

            <a
              href="https://play.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 text-[#1E2939] rounded-full px-3 py-3 shadow-sm hover:bg-gray-50 transition-colors"
            >
              <img src={googlePlayIcon} alt="" width="22" height="22" />
              <div className="text-left">
                <p className="text-[10px] text-gray-500 leading-tight">Get it on</p>
                <p className="font-bold text-sm leading-tight">Google Play</p>
              </div>
            </a>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 leading-relaxed mt-auto">
          Questions? Email us at{' '}
          <a href="mailto:support@chromamind.ai" className="text-[#8C49D5] underline">support@chromamind.ai</a>
        </p>
      </div>
    </OnboardingLayout>
  );
}
