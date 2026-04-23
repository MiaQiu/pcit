import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

function SignalIcon() {
  return (
    <svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor">
      <rect x="0" y="7" width="3" height="4" rx="0.5" />
      <rect x="5" y="4" width="3" height="7" rx="0.5" />
      <rect x="10" y="0" width="3" height="11" rx="0.5" />
    </svg>
  );
}

function WifiIcon() {
  return (
    <svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke="currentColor" strokeLinecap="round">
      <circle cx="7.5" cy="10" r="1" fill="currentColor" stroke="none" />
      <path d="M4.7 7.3a3.9 3.9 0 0 1 5.6 0" strokeWidth="1.2" />
      <path d="M2.2 4.8a7 7 0 0 1 10.6 0" strokeWidth="1.2" />
    </svg>
  );
}

function BatteryIcon() {
  return (
    <svg width="22" height="11" viewBox="0 0 22 11" fill="none">
      <rect x="0.5" y="1" width="17" height="9" rx="2" stroke="currentColor" strokeWidth="1" />
      <rect x="18" y="3.5" width="2" height="4" rx="1" fill="currentColor" />
      <rect x="2" y="2.5" width="12" height="6" rx="1" fill="currentColor" />
    </svg>
  );
}

export default function PhonePreview({ children }: Props) {
  return (
    <div className="iphone-frame">
      <div className="iphone-notch" />
      <div className="iphone-screen">
        {/* Status bar */}
        {/* <div style={{ position: 'absolute', top: 0, left: 20, right: 0, height: 64, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 14, paddingBottom: 6, zIndex: 50, fontSize: 15, fontWeight: 700, color: '#1a1a1a', letterSpacing: '0.01em' }}>
          <span>9:41</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SignalIcon />
            <WifiIcon />
            <BatteryIcon />
          </div>
        </div> */}
        <div style={{ position: 'absolute', top: 62, left: 12, right: 12, height: 4, background: 'linear-gradient(to right, #7C3AED 40%, rgba(124,58,237,0.2) 40%)', borderRadius: 2, zIndex: 10 }} />
        {children}
        <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, display: 'flex', gap: 10, zIndex: 10 }}>
          <button style={{ flex: 1, height: 48, borderRadius: 999, border: '1px solid #E0E0E0', background: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 600, cursor: 'default' }}>← Back</button>
          <button style={{ flex: 1, height: 48, borderRadius: 999, border: 'none', background: '#1E2939', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'default' }}>Continue →</button>
        </div>
      </div>
    </div>
  );
}
