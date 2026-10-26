import { motion, useReducedMotion } from 'motion/react';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// Non-breaking space: a literal space inside these inline-flex cells gets
// collapsed away, which would drop the gap between "PKR" and the figure.
const NBSP = ' ';

// One digit column: a 0-9 strip masked to a single character cell, sprung up
// to its target. Rolling 0→N reads as a count-up, while the per-digit delay
// gives the staggered "kinetic type" reveal — one mechanism, both effects,
// and no re-render per frame the way an interval-based counter would need.
//
// The travel is expressed in `em`, not `%`: a percentage translate resolves
// against the *strip's* own height (ten cells), so `-400%` would throw the
// column forty lines up instead of four digits. One cell is 1em by
// construction, so `-4em` is exactly four digits.
function DigitColumn({ digit, delay }: { digit: number; delay: number }) {
  return (
    <span className="relative inline-block h-[1em] overflow-hidden leading-none">
      {/* Invisible glyph reserves the column's advance width, so the strip
          inherits whatever the font's tabular digit width actually is
          instead of a hardcoded em guess that drifts per font-size. */}
      <span className="invisible" aria-hidden="true">
        0
      </span>
      <motion.span
        className="absolute inset-x-0 top-0 flex flex-col"
        initial={{ y: '0em' }}
        animate={{ y: `-${digit}em` }}
        transition={{ type: 'spring', stiffness: 70, damping: 16, mass: 0.9, delay }}
      >
        {DIGITS.map((d) => (
          <span key={d} className="flex h-[1em] items-center justify-center leading-none">
            {d}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

// Static characters (currency prefix, decimal point, "M" suffix) mask up
// from below on the same stagger clock as the digits. This strip is a single
// cell tall, so a percentage translate is unambiguous here.
function StaticChar({ char, delay }: { char: string; delay: number }) {
  const glyph = char === ' ' ? NBSP : char;

  return (
    <span className="relative inline-block h-[1em] overflow-hidden leading-none">
      <span className="invisible" aria-hidden="true">
        {glyph}
      </span>
      <motion.span
        className="absolute inset-x-0 top-0 flex h-[1em] items-center justify-center leading-none"
        initial={{ y: '110%' }}
        animate={{ y: '0%' }}
        transition={{ type: 'spring', stiffness: 90, damping: 18, delay }}
      >
        {glyph}
      </motion.span>
    </span>
  );
}

export function RollingNumber({
  value,
  className,
  startDelay = 0,
}: {
  /** Rendered verbatim — digits roll, everything else masks up. */
  value: string;
  className?: string;
  startDelay?: number;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <span className={className}>{value}</span>;
  }

  return (
    <span className={className}>
      {/* Screen readers get the finished figure as one string; the animated
          glyphs are decorative and would otherwise be announced one
          character at a time as each cell mounts. */}
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="inline-flex items-end">
        {[...value].map((char, i) => {
          const delay = startDelay + i * 0.055;
          return /[0-9]/.test(char) ? (
            <DigitColumn key={i} digit={Number(char)} delay={delay} />
          ) : (
            <StaticChar key={i} char={char} delay={delay} />
          );
        })}
      </span>
    </span>
  );
}
