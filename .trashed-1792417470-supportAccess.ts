import { useState, useEffect } from 'react';
import { TechnicalSupportAccess } from '../types';

export const isSupportAccessActive = (support?: TechnicalSupportAccess | null): boolean => {
  if (!support || !support.enabled || !support.expiresAt) return false;
  return Date.now() < support.expiresAt;
};

export interface SupportTimeRemaining {
  active: boolean;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  formatted: string;
}

export const getRemainingSupportTime = (support?: TechnicalSupportAccess | null): SupportTimeRemaining => {
  if (!isSupportAccessActive(support)) {
    return {
      active: false,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalMs: 0,
      formatted: '00:00:00'
    };
  }

  const diff = Math.max(0, (support!.expiresAt || 0) - Date.now());
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  const pad = (n: number) => n.toString().padStart(2, '0');
  return {
    active: diff > 0,
    hours,
    minutes,
    seconds,
    totalMs: diff,
    formatted: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  };
};

export const useSupportCountdown = (support?: TechnicalSupportAccess | null): SupportTimeRemaining => {
  const [remaining, setRemaining] = useState<SupportTimeRemaining>(() => getRemainingSupportTime(support));

  useEffect(() => {
    setRemaining(getRemainingSupportTime(support));

    if (!isSupportAccessActive(support)) return;

    const interval = setInterval(() => {
      const next = getRemainingSupportTime(support);
      setRemaining(next);
      if (!next.active) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [support?.enabled, support?.expiresAt]);

  return remaining;
};
