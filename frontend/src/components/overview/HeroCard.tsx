import { motion } from 'motion/react';
import heroImage from '@/assets/Aerial-2.jfif';
import { RollingNumber } from '@/components/overview/RollingNumber';
import { Sparkline } from '@/components/ui/Sparkline';
import { TrendTag } from '@/components/ui/TrendTag';
import { overviewFixtures } from '@/lib/overviewFixtures';

// Staggered entrance for the hero's text stack — each block trails the one
// above it, which is what makes the panel feel composed rather than
// popped-in all at once.
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

const rise = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 120, damping: 20 } },
};

function timeOfDay(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function HeroCard({ firstName }: { firstName: string }) {
  const { hero, period } = overviewFixtures;

  return (
    <motion.section
      variants={container}
      initial="hidden"
      animate="show"
      className="relative flex min-h-0 flex-1 flex-col justify-between overflow-hidden rounded-[20px] px-8 py-8 sm:px-10 sm:py-9"
    >
      {/* Ken Burns lives on the <img> itself rather than the section so the
          overflow-hidden frame stays put while the photograph drifts inside it. */}
      <img
        src={heroImage}
        alt=""
        aria-hidden="true"
        className="animate-ken-burns absolute inset-0 h-full w-full object-cover will-change-transform"
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(4,21,33,0.20) 0%, rgba(4,21,33,0.40) 42%, rgba(4,21,33,0.88) 100%), ' +
            'radial-gradient(circle at 88% 0%, rgba(93,202,165,0.26), transparent 45%), ' +
            'radial-gradient(circle at 0% 100%, rgba(24,95,165,0.32), transparent 45%)',
        }}
      />

      {/* The greeting rides in the eyebrow row rather than sitting above the
          metric as its own line: a dashboard's top strip is prime space, and
          two competing small lines over the metric was what made the old
          serif flourish read as an ornament rather than as hierarchy. */}
      <motion.div variants={rise} className="relative z-10 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="font-display text-sm font-bold uppercase tracking-[0.14em] text-white">Maidan</span>
          <span className="h-1 w-1 shrink-0 rounded-full bg-white/40" />
          <p className="text-[13px] font-medium text-white/70">
            {timeOfDay()}, <span className="text-white">{firstName}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {hero.chips.map((chip) => (
            <span
              key={chip.label}
              className="flex items-center gap-1.5 rounded-full border border-white/14 bg-white/8 px-3 py-1 text-xs font-medium text-white/85 backdrop-blur-md"
            >
              <span className="text-white/50">{chip.label}</span>
              <span className="tabular-nums text-white">{chip.value}</span>
            </span>
          ))}
        </div>
      </motion.div>

      <div className="relative z-10 mt-8">
        <motion.p
          variants={rise}
          className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55"
        >
          {hero.label} · {period}
        </motion.p>

        <RollingNumber
          value={hero.value}
          startDelay={0.32}
          className="mt-2.5 block font-heading text-[clamp(38px,5.4vw,60px)] font-semibold leading-none tracking-tight text-white tabular-nums drop-shadow-[0_2px_18px_rgba(0,0,0,0.45)]"
        />

        <motion.div variants={rise} className="mt-5 flex flex-wrap items-center gap-3">
          <Sparkline data={hero.spark} color="#5DCAA5" width={100} height={30} />
          <TrendTag changePct={hero.changePct} />
          <span className="text-xs text-white/50">vs last month</span>

          <span className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-white/70">
            <span>3 facilities</span>
            <span className="h-3 w-px bg-white/15" />
            <span>6 court types</span>
            <span className="h-3 w-px bg-white/15" />
            <span className="flex items-center gap-1.5">
              <span className="relative h-[7px] w-[7px] rounded-full bg-live shadow-[0_0_10px_2px_rgba(74,222,128,0.9)]">
                <span className="animate-pulse-ring absolute -inset-[5px] rounded-full bg-live opacity-80" />
              </span>
              Open now
            </span>
          </span>
        </motion.div>
      </div>
    </motion.section>
  );
}
