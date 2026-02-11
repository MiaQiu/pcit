import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export default function PhonePreview({ children }: Props) {
  return (
    <div className="iphone-frame">
      <div className="iphone-notch" />
      <div className="iphone-screen">
        {children}
      </div>
    </div>
  );
}
