import type { ReactNode } from 'react';
import { BrandPanel } from '@/components/auth/BrandPanel';

export function AuthShell({
  headline,
  subline,
  chips,
  children,
}: {
  headline: ReactNode;
  subline: string;
  chips?: string[];
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <div className="lg:flex-[0_0_56%]">
        <BrandPanel headline={headline} subline={subline} chips={chips} />
      </div>
      <div className="flex flex-1 items-center justify-center bg-canvas p-12">
        <div className="w-full max-w-[360px]">{children}</div>
      </div>
    </div>
  );
}
