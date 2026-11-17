export function isValidDate(date: any): boolean {
  if (date === undefined || date === null || date === '') return false;
  const d = new Date(date);
  return !isNaN(d.getTime());
}

export function safeFormatDate(
  date: string | number | Date | undefined, 
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' },
  locale: string = 'id-ID'
): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);
  try {
    return d.toLocaleDateString(locale, options);
  } catch (e) {
    return String(date);
  }
}

export function safeFormatTime(
  date: string | number | Date | undefined, 
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
  locale: string = 'id-ID'
): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  try {
    return d.toLocaleTimeString(locale, options);
  } catch (e) {
    return '';
  }
}

export function safeFormatDateTime(
  date: string | number | Date | undefined, 
  options: Intl.DateTimeFormatOptions = { dateStyle: 'long', timeStyle: 'short' },
  locale: string = 'id-ID'
): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);
  try {
    return d.toLocaleString(locale, options);
  } catch (e) {
    return String(date);
  }
}

const ID_MONTHS: Record<string, number> = {
  januari: 0, jan: 0,
  februari: 1, feb: 1,
  maret: 2, mar: 2,
  april: 3, apr: 3,
  mei: 4, may: 4,
  juni: 5, jun: 5,
  juli: 6, jul: 6,
  agustus: 7, agu: 7, agt: 7,
  september: 8, sep: 8,
  oktober: 9, okt: 9,
  november: 10, nov: 10,
  desember: 11, des: 11
};

/**
 * Parses event date string and optional execution time into a final ending Date object.
 * Handles single dates, date ranges (e.g. '10 - 12 November 2026'), ISO dates, and DD-MM-YYYY.
 */
export function parseEventEndDate(dateStr?: string, timeStr?: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim();
  if (!clean) return null;

  // Split range if any: '10 - 12 November 2026' or '2026-11-10 to 2026-11-12'
  const parts = clean.split(/\s*(?:-|–|—|s\/d|sampai|to)\s*/i);
  const targetStr = parts.length > 1 ? parts[parts.length - 1].trim() : parts[0].trim();

  let d: Date | null = null;

  // 1. Check ISO format YYYY-MM-DD
  const isoMatch = targetStr.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (isoMatch) {
    d = new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
  }

  // 2. Check DD/MM/YYYY or DD-MM-YYYY (Indonesian format)
  if (!d) {
    const dmy = targetStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) {
      d = new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
    }
  }

  // 3. Check Indonesian month text format: e.g. '12 November 2026' or '12 Nov 2026'
  if (!d) {
    const textMatch = targetStr.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
    if (textMatch) {
      const mKey = textMatch[2].toLowerCase();
      if (ID_MONTHS[mKey] !== undefined) {
        d = new Date(parseInt(textMatch[3], 10), ID_MONTHS[mKey], parseInt(textMatch[1], 10));
      }
    }
  }

  // 4. Fallback to standard Date parse
  if (!d) {
    const fallback = new Date(targetStr);
    if (!isNaN(fallback.getTime())) {
      d = fallback;
    }
  }

  if (!d || isNaN(d.getTime())) return null;

  // Default end of day: 23:59:59.999
  let endHour = 23;
  let endMin = 59;
  let endSec = 59;

  // Parse timeStr if provided, e.g. '08:00 - 17:00' or '16.00'
  if (timeStr && typeof timeStr === 'string') {
    const timeParts = timeStr.split(/\s*(?:-|–|—|s\/d|sampai|to)\s*/i);
    const lastTimePart = timeParts.length > 1 ? timeParts[timeParts.length - 1].trim() : '';
    const tm = lastTimePart.match(/(\d{1,2})[:.](\d{2})/);
    if (tm) {
      const h = parseInt(tm[1], 10);
      const m = parseInt(tm[2], 10);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        endHour = h;
        endMin = m;
        endSec = 0;
      }
    }
  }

  d.setHours(endHour, endMin, endSec, 999);
  return d;
}

/**
 * Checks whether the registration deadline has passed.
 */
export function isRegistrationDeadlinePassed(deadline?: string | number | Date | null): boolean {
  if (!deadline) return false;
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return false;
  return Date.now() > d.getTime();
}

/**
 * Checks whether the event execution date and time have completed/passed.
 */
export function isEventFinished(event?: { 
  status?: string; 
  settings?: { eventDate?: string; executionTime?: string; [key: string]: any } 
} | null): boolean {
  if (!event) return false;
  if (event.status === 'COMPLETED') return true;
  if (!event.settings?.eventDate) return false;
  const endDate = parseEventEndDate(event.settings.eventDate, event.settings.executionTime);
  if (!endDate) return false;
  return Date.now() > endDate.getTime();
}

/**
 * Comprehensive check whether online registration should be closed for an event.
 * Registration closes if:
 * 1. Event status is COMPLETED or DELETED
 * 2. Event is already finished (past execution time)
 * 3. isRegistrationClosed flag is explicitly set
 * 4. registrationDeadline has passed
 */
export function isEventRegistrationClosed(event?: { 
  status?: string; 
  isRegistrationClosed?: boolean; 
  settings?: { 
    registrationDeadline?: string; 
    eventDate?: string; 
    executionTime?: string; 
    [key: string]: any 
  } 
} | null): boolean {
  if (!event) return false;
  if (event.status === 'COMPLETED' || event.status === 'DELETED') return true;
  if (event.isRegistrationClosed === true) return true;
  if (isEventFinished(event)) return true;
  if (event.settings?.registrationDeadline) {
    if (isRegistrationDeadlinePassed(event.settings.registrationDeadline)) {
      return true;
    }
  }
  return false;
}

export type EventTimingState = 'UPCOMING' | 'ONGOING' | 'COMPLETED';

/**
 * Returns formatted status badges, labels, and state indicators for an event.
 */
export function getEventTimingStatus(event?: {
  status?: string;
  settings?: { eventDate?: string; executionTime?: string; registrationDeadline?: string; [key: string]: any };
} | null): {
  isFinished: boolean;
  isRegClosed: boolean;
  state: EventTimingState;
  statusLabel: string;
  regStatusLabel: string;
} {
  const isFinished = isEventFinished(event);
  const isRegClosed = isEventRegistrationClosed(event);

  let state: EventTimingState = 'UPCOMING';
  let statusLabel = 'Akan Datang';

  if (isFinished) {
    state = 'COMPLETED';
    statusLabel = 'Event Selesai';
  } else if (event?.status === 'ACTIVE' || event?.status === 'ONGOING') {
    state = 'ONGOING';
    statusLabel = 'Sedang Berlangsung';
  }

  let regStatusLabel = 'Pendaftaran Dibuka';
  if (isFinished) {
    regStatusLabel = 'Event Telah Selesai';
  } else if (isRegClosed) {
    regStatusLabel = 'Pendaftaran Ditutup';
  }

  return {
    isFinished,
    isRegClosed,
    state,
    statusLabel,
    regStatusLabel
  };
}
