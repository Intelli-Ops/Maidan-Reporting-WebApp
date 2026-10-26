import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

const DRAW_LINE_STYLE: CSSProperties = {
  strokeDasharray: 2400,
  strokeDashoffset: 2400,
  animationDuration: '6s',
  animationTimingFunction: 'cubic-bezier(0.65, 0, 0.35, 1)',
  animationIterationCount: 'infinite',
};

// The animated court-line draw + dropping-ball moment from the auth brand
// panel, factored out so it can also anchor smaller "brand moments" (e.g.
// the Overview hero card) without duplicating the keyframed SVG markup.
export function CourtScene() {
  return (
    <div className="pointer-events-none absolute inset-0 animate-scene-cycle">
      <svg viewBox="0 0 900 700" className="absolute -inset-[10%] h-[120%] w-[120%] rotate-[-6deg] opacity-10">
        <rect
          x="120"
          y="90"
          width="660"
          height="520"
          fill="none"
          stroke="white"
          strokeWidth="3"
          style={{ ...DRAW_LINE_STYLE, animationName: 'draw-rect-1' }}
        />
        <line
          x1="120"
          y1="350"
          x2="780"
          y2="350"
          stroke="white"
          strokeWidth="3"
          style={{ ...DRAW_LINE_STYLE, animationName: 'draw-line-1' }}
        />
        <line
          x1="450"
          y1="90"
          x2="450"
          y2="610"
          stroke="white"
          strokeWidth="2"
          style={{ ...DRAW_LINE_STYLE, animationName: 'draw-line-2' }}
        />
        <rect
          x="120"
          y="230"
          width="660"
          height="240"
          fill="none"
          stroke="white"
          strokeWidth="2"
          style={{ ...DRAW_LINE_STYLE, animationName: 'draw-rect-2' }}
        />
      </svg>

      <svg viewBox="0 0 900 700" className="absolute -inset-[10%] h-[120%] w-[120%] rotate-[-6deg]">
        <circle
          cx="450"
          cy="350"
          r="9"
          fill="#5DCAA5"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeOpacity="0"
          className="origin-center animate-ball-drop [transform-box:fill-box]"
        />
      </svg>
    </div>
  );
}

// The dark "night" gradient + drifting glow orbs used behind the court
// scene — shared by the auth brand panel and any other full brand moment
// (e.g. the Overview hero card) so they read as the same product.
export function NightPanel({
  children,
  className,
  glow = true,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{
        background:
          'radial-gradient(circle at 15% 20%, rgba(55,138,221,0.35), transparent 42%), ' +
          'radial-gradient(circle at 82% 8%, rgba(93,202,165,0.30), transparent 40%), ' +
          'radial-gradient(circle at 60% 75%, rgba(24,95,165,0.25), transparent 45%), ' +
          'linear-gradient(155deg, #041521 0%, #06251f 42%, #0c3320 75%, #123c1a 100%)',
      }}
    >
      {glow && (
        <>
          <span className="pointer-events-none absolute -left-20 -top-[120px] h-[420px] w-[420px] rounded-full bg-blue-bright opacity-55 blur-[70px] animate-glow-drift" />
          <span className="pointer-events-none absolute -bottom-36 left-[20%] h-[380px] w-[380px] rounded-full bg-mint opacity-55 blur-[70px] animate-glow-drift [animation-delay:-6s]" />
          <span className="pointer-events-none absolute left-[55%] top-[30%] h-[300px] w-[300px] rounded-full bg-blue opacity-55 blur-[70px] animate-glow-drift [animation-delay:-3s]" />
        </>
      )}
      <CourtScene />
      {children}
    </div>
  );
}
