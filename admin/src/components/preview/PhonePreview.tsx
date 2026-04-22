import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export default function PhonePreview({ children }: Props) {
  return (
    <div className="iphone-frame">
      <div className="iphone-notch" />
      <div className="iphone-screen">
        <div style={{ position: 'absolute', top: 85, left: 12, right: 12, height: 4, background: 'linear-gradient(to right, #7C3AED 40%, rgba(124,58,237,0.2) 40%)', borderRadius: 2, zIndex: 10 }} />
        {children}
        <div style={{ position: 'absolute', bottom: 24, left: 12, right: 12, display: 'flex', gap: 10, zIndex: 10 }}>
          <button style={{ flex: 1, height: 48, borderRadius: 999, border: '1px solid #E0E0E0', background: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 600, cursor: 'default' }}>← Back</button>
          <button style={{ flex: 1, height: 48, borderRadius: 999, border: 'none', background: '#1E2939', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'default' }}>Continue →</button>
        </div>
      </div>
    </div>
  );
}
