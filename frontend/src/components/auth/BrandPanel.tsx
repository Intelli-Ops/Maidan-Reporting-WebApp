import type { ReactNode } from 'react';
import { NightPanel } from '@/components/brand/NightScene';
import maidanLogo from '@/assets/maidan-logo.png';

const DEFAULT_CHIPS = ['KMC', 'Emaar', 'Malir Cantt'];

export function BrandPanel({
  headline,
  subline,
  chips = DEFAULT_CHIPS,
}: {
  headline: ReactNode;
  subline: string;
  chips?: string[];
}) {
  return (
    <NightPanel className="hidden h-full flex-col justify-between px-16 py-14 lg:flex">
      <div className="relative z-10 inline-flex">
        <span className="animate-badge-glow relative inline-flex items-center overflow-hidden rounded-[14px] border border-white/70 bg-gradient-to-br from-[#F8FAF9] to-[#E7F2ED] px-5 py-2.5">
          <span className="animate-shine-sweep pointer-events-none absolute inset-y-0 left-[-60%] z-[2] w-[35%] -skew-x-[20deg] bg-gradient-to-r from-transparent via-white/70 to-transparent" />
          <img src={maidanLogo} alt="Maidan" className="relative z-[1] block h-5 w-auto" />
        </span>
      </div>

      <div className="relative z-10">
        <p
          className="max-w-[440px] font-display text-[clamp(30px,2.8vw,40px)] font-bold leading-[1.2] tracking-tight bg-clip-text text-transparent"
          style={{ backgroundImage: 'linear-gradient(120deg, #FFFFFF 15%, #85B7EB 55%, #9FE1CB 90%)' }}
        >
          {headline}
        </p>
        <p className="mt-3.5 max-w-[400px] text-[15px] text-white/65">{subline}</p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          {chips.map((chip) => (
            <span
              key={chip}
              className="flex items-center gap-1.5 rounded-full border border-white/14 bg-white/8 py-1.5 pl-2.5 pr-3.5 text-[13px] font-medium text-white/90 backdrop-blur-md"
            >
              <span className="relative h-[7px] w-[7px] rounded-full bg-live shadow-[0_0_10px_2px_rgba(74,222,128,0.9)]">
                <span className="animate-pulse-ring absolute -inset-[5px] rounded-full bg-live opacity-80" />
              </span>
              {chip}
            </span>
          ))}
        </div>
      </div>
    </NightPanel>
  );
}
