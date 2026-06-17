import React from 'react';
import OnboardingLayout from '../components/OnboardingLayout';

export default function SuccessScreen() {
  return (
    <OnboardingLayout>
      <div className="flex-1 flex flex-col px-6 py-12">
        {/* Success mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-[#EDE9FE] rounded-full flex items-center justify-center mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17L4 12" stroke="#8C49D5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <h1 className="text-[#1E2939] text-2xl font-bold text-center mb-3">
            You're all set!
          </h1>
          <p className="text-[#6B7280] text-sm text-center leading-relaxed">
            Your account is ready. Download the Nora app to start your first play session.
          </p>
        </div>

        {/* Account ready */}
        <div className="border border-[#EDE9FE] bg-[#F9F7FF] rounded-xl p-4 mb-6">
          <p className="text-[#8C49D5] font-semibold text-sm mb-1">Account Ready</p>
          <p className="text-[#6B7280] text-xs leading-relaxed">
            Log in with your email and password in the Nora mobile app.
          </p>
        </div>

        {/* Download section */}
        <div className="mb-6">
          <p className="text-[#1E2939] font-semibold text-sm text-center mb-4">
            Download the Nora App
          </p>

          <div className="flex flex-col gap-3">
            <a
              href="https://apps.apple.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-4 bg-[#1E2939] text-white rounded-xl px-5 py-4 hover:bg-[#2d3748] transition-colors"
            >
              <svg width="24" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M20.5 14.7C20.5 11.8 22.3 10.2 22.3 10.2C20.7 8.1 18.3 7.9 17.4 7.9C15.4 7.7 13.5 9.1 12.5 9.1C11.5 9.1 9.9 7.9 8.2 7.9C6.0 7.9 3.9 9.2 2.8 11.2C0.5 15.2 2.2 21 4.4 24.2C5.5 25.8 6.8 27.6 8.5 27.5C10.1 27.4 10.7 26.5 12.7 26.5C14.7 26.5 15.2 27.5 17.0 27.4C18.8 27.4 19.9 25.8 20.9 24.2C21.5 23.3 21.9 22.3 22.2 21.2C20.5 20.5 20.5 17.8 20.5 14.7Z" fill="white"/>
                <path d="M16.2 5.5C17.1 4.4 17.7 2.9 17.5 1.4C16.2 1.5 14.7 2.3 13.8 3.4C12.9 4.4 12.2 5.9 12.5 7.3C13.9 7.4 15.3 6.6 16.2 5.5Z" fill="white"/>
              </svg>
              <div>
                <p className="text-xs text-white/60">Download on the</p>
                <p className="font-bold text-sm leading-tight">App Store</p>
              </div>
            </a>

            <a
              href="https://play.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-4 bg-[#1E2939] text-white rounded-xl px-5 py-4 hover:bg-[#2d3748] transition-colors"
            >
              <svg width="22" height="24" viewBox="0 0 24 26" fill="none">
                <path d="M1.5 0.8L13.3 12.6L1.5 24.5C1 24.2 0.7 23.7 0.7 23.1V2.2C0.7 1.5 1 1.1 1.5 0.8Z" fill="#EA4335"/>
                <path d="M17.4 8.6L14.4 11.6L13.3 12.6L17.4 16.7L21.1 14.5C22.1 14 22.1 12.4 21.1 11.9L17.4 8.6Z" fill="#FBBC04"/>
                <path d="M1.5 0.8C2.1 0.5 2.7 0.5 3.3 0.8L14.4 11.6L13.3 12.6L1.5 0.8Z" fill="#4285F4"/>
                <path d="M13.3 12.6L14.4 13.6L3.3 24.5C2.7 24.8 2.1 24.8 1.5 24.5L13.3 12.6Z" fill="#34A853"/>
              </svg>
              <div>
                <p className="text-xs text-white/60">Get it on</p>
                <p className="font-bold text-sm leading-tight">Google Play</p>
              </div>
            </a>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 leading-relaxed mt-auto">
          Questions? Email us at{' '}
          <a href="mailto:hello@hinora.co" className="text-[#8C49D5] underline">hello@hinora.co</a>
        </p>
      </div>
    </OnboardingLayout>
  );
}
