import { useEffect, useState } from 'react';

// Ticks a seconds-remaining value down to 0, for disabling submission during
// a 429 rate-limit window instead of showing a raw error.
export function useCountdown(initialSeconds: number | undefined) {
  const [seconds, setSeconds] = useState(initialSeconds ?? 0);

  useEffect(() => {
    setSeconds(initialSeconds ?? 0);
  }, [initialSeconds]);

  useEffect(() => {
    if ((initialSeconds ?? 0) <= 0) return;
    const timer = window.setInterval(() => {
      setSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [initialSeconds]);

  return seconds;
}
