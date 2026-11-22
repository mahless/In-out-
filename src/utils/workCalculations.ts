import {
  CalculatedEntryDuration,
  MonthlyFinancialSummary,
  MonthlySummary,
  ShiftDefinition,
  ShiftId,
  WorkEntry,
} from '../types/work';

export const STANDARD_SHIFT_MINUTES = 8 * 60; // 480 minutes = 8 hours
export const MINUTES_PER_DAY = 24 * 60;
export const DAY_START_MINUTES = 6 * 60; // 06:00 inclusive
export const NIGHT_START_MINUTES = 18 * 60; // 18:00 inclusive
export const DAY_OVERTIME_MULTIPLIER = 1.35;
export const NIGHT_OVERTIME_MULTIPLIER = 1.7;

export const SHIFTS: Record<ShiftId, ShiftDefinition> = {
  shift1: {
    id: 'shift1',
    label: 'الوردية الأولى',
    shortLabel: 'الأولى',
    timeRangeLabel: '07:00 صباحًا — 03:00 عصرًا',
    defaultStartTime: '07:00',
    defaultEndTime: '15:00',
    crossesMidnight: false,
  },
  shift2: {
    id: 'shift2',
    label: 'الوردية الثانية',
    shortLabel: 'الثانية',
    timeRangeLabel: '03:00 عصرًا — 11:00 مساءً',
    defaultStartTime: '15:00',
    defaultEndTime: '23:00',
    crossesMidnight: false,
  },
  shift3: {
    id: 'shift3',
    label: 'الوردية الثالثة',
    shortLabel: 'الثالثة',
    timeRangeLabel: '11:00 مساءً — 07:00 صباحًا (اليوم التالي)',
    defaultStartTime: '23:00',
    defaultEndTime: '07:00',
    crossesMidnight: true,
  },
};

export const SHIFT_LIST: ShiftDefinition[] = [
  SHIFTS.shift1,
  SHIFTS.shift2,
  SHIFTS.shift3,
];

const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

const ARABIC_WEEKDAYS = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

export function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function isValidTimeString(timeStr: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return false;
  const [hh, mm] = timeStr.split(':').map(Number);
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

/**
 * Converts a YYYY-MM-DD date and HH:MM time into exact integer minutes since Unix epoch (UTC).
 * Using UTC avoids local Daylight Saving Time shifts distorting elapsed work durations.
 */
export function toEpochMinutes(dateStr: string, timeStr: string): number {
  if (!isValidDateString(dateStr) || !isValidTimeString(timeStr)) {
    return NaN;
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d, hh, mm, 0, 0) / 60000);
}

export function addDaysToDate(dateStr: string, days: number): string {
  if (!isValidDateString(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalTimeString(date: Date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function getCurrentMonthKey(date: Date = new Date()): string {
  return getMonthKey(getLocalDateString(date));
}

export function formatMinutesToHHMM(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return '00:00';
  }
  const safeMinutes = Math.round(totalMinutes);
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function formatTime12hEgyptian(timeStr: string | null): string {
  if (!timeStr || !isValidTimeString(timeStr)) return '--:--';
  const [hh, mm] = timeStr.split(':').map(Number);
  const period = hh < 12 ? 'ص' : 'م';
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${String(hour12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${period}`;
}

export function formatArabicDate(dateStr: string): string {
  if (!isValidDateString(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const weekday = ARABIC_WEEKDAYS[dt.getUTCDay()];
  const month = ARABIC_MONTHS[m - 1];
  return `${weekday} ${d} ${month} ${y}`;
}

export function formatArabicShortDate(dateStr: string): string {
  if (!isValidDateString(dateStr)) return dateStr;
  const [, m, d] = dateStr.split('-').map(Number);
  return `${d} ${ARABIC_MONTHS[m - 1]}`;
}

export function formatEgyptianNumericDate(dateStr: string): string {
  if (!isValidDateString(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function formatMonthLabel(monthKey: string): string {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return monthKey;
  const [y, m] = monthKey.split('-').map(Number);
  const monthName = ARABIC_MONTHS[m - 1] ?? monthKey;
  return `${monthName} ${y}`;
}

/**
 * Resolves the sensible default checkout date when recording or adjusting checkout time.
 * For shift 3 (or when explicitly crossing midnight), if checkout time is earlier than check-in time,
 * it belongs to the next calendar day.
 */
export function inferCheckOutDate(
  workDate: string,
  checkInTime: string,
  checkOutTime: string,
  shift: ShiftId,
  nowDate?: string
): string {
  if (nowDate && isValidDateString(nowDate) && nowDate >= workDate) {
    const startMins = toEpochMinutes(workDate, checkInTime);
    const endMins = toEpochMinutes(nowDate, checkOutTime);
    if (Number.isFinite(startMins) && Number.isFinite(endMins) && endMins > startMins) {
      return nowDate;
    }
  }
  if (checkOutTime < checkInTime) {
    return addDaysToDate(workDate, 1);
  }
  return workDate;
}

export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatEgpAmount(amount: number): string {
  if (!Number.isFinite(amount)) return '0.00';
  return roundCurrency(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Classifies an exact [startEpochMin, endEpochMin) interval into Daytime (06:00-18:00)
 * and Nighttime (18:00-06:00) integer minutes, splitting seamlessly at 06:00 and 18:00 boundaries.
 */
export function classifyIntervalDayNightMinutes(
  startEpochMin: number,
  endEpochMin: number
): { dayMinutes: number; nightMinutes: number } {
  if (
    !Number.isFinite(startEpochMin) ||
    !Number.isFinite(endEpochMin) ||
    endEpochMin <= startEpochMin
  ) {
    return { dayMinutes: 0, nightMinutes: 0 };
  }

  let cursor = startEpochMin;
  let dayMinutes = 0;
  let nightMinutes = 0;

  while (cursor < endEpochMin) {
    const dayIndex = Math.floor(cursor / MINUTES_PER_DAY);
    const dayBase = dayIndex * MINUTES_PER_DAY;
    const dayStart = dayBase + DAY_START_MINUTES; // 06:00
    const nightStart = dayBase + NIGHT_START_MINUTES; // 18:00
    const nextDayBase = (dayIndex + 1) * MINUTES_PER_DAY; // 24:00

    if (cursor < dayStart) {
      const segEnd = Math.min(endEpochMin, dayStart);
      nightMinutes += segEnd - cursor;
      cursor = segEnd;
    } else if (cursor < nightStart) {
      const segEnd = Math.min(endEpochMin, nightStart);
      dayMinutes += segEnd - cursor;
      cursor = segEnd;
    } else {
      const segEnd = Math.min(endEpochMin, nextDayBase);
      nightMinutes += segEnd - cursor;
      cursor = segEnd;
    }
  }

  return { dayMinutes, nightMinutes };
}

function emptyCalculatedDuration(
  isValid: boolean,
  errorMessage: string | null
): CalculatedEntryDuration {
  return {
    isComplete: false,
    isValid,
    errorMessage,
    workedMinutes: 0,
    overtimeMinutes: 0,
    preShiftOvertimeMinutes: 0,
    postShiftOvertimeMinutes: 0,
    dayOvertimeMinutes: 0,
    nightOvertimeMinutes: 0,
    regularMinutes: 0,
    workedFormatted: '00:00',
    overtimeFormatted: '00:00',
    dayOvertimeFormatted: '00:00',
    nightOvertimeFormatted: '00:00',
  };
}

/**
 * Pure calculation engine for a single work entry.
 * Overtime is determined strictly by shift boundaries (pre-shift + post-shift),
 * never deducting late arrivals or early departures, and classifies every overtime minute
 * into Daytime (06:00–18:00) or Nighttime (18:00–06:00).
 */
export function calculateEntryDuration(
  entry: Pick<WorkEntry, 'workDate' | 'shift' | 'checkInTime' | 'checkOutDate' | 'checkOutTime'>
): CalculatedEntryDuration {
  if (!isValidDateString(entry.workDate) || !isValidTimeString(entry.checkInTime)) {
    return emptyCalculatedDuration(false, 'تاريخ أو وقت الحضور مش مظبوط.');
  }

  if (!entry.checkOutTime) {
    return emptyCalculatedDuration(true, null);
  }

  const effectiveCheckOutDate = entry.checkOutDate || entry.workDate;
  if (!isValidDateString(effectiveCheckOutDate) || !isValidTimeString(entry.checkOutTime)) {
    return emptyCalculatedDuration(false, 'تاريخ أو وقت الانصراف مش مظبوط.');
  }

  const startMins = toEpochMinutes(entry.workDate, entry.checkInTime);
  const endMins = toEpochMinutes(effectiveCheckOutDate, entry.checkOutTime);
  const diff = endMins - startMins;

  if (!Number.isFinite(diff) || diff <= 0) {
    return emptyCalculatedDuration(false, 'وقت الانصراف مينفعش يكون قبل أو قد وقت الحضور.');
  }

  if (diff > 24 * 60) {
    return emptyCalculatedDuration(
      false,
      'الفرق بين الحضور والانصراف أكتر من 24 ساعة. راجع التاريخ والوقت.'
    );
  }

  const shiftDef = SHIFTS[entry.shift] ?? SHIFTS.shift1;
  const shiftStartMins = toEpochMinutes(entry.workDate, shiftDef.defaultStartTime);
  const shiftEndDate = shiftDef.crossesMidnight
    ? addDaysToDate(entry.workDate, 1)
    : entry.workDate;
  const shiftEndMins = toEpochMinutes(shiftEndDate, shiftDef.defaultEndTime);

  // Pre-shift overtime interval: [startMins, min(endMins, shiftStartMins))
  const preEnd = Math.min(endMins, shiftStartMins);
  const preShiftOvertimeMinutes = startMins < preEnd ? preEnd - startMins : 0;
  const preClassified =
    preShiftOvertimeMinutes > 0
      ? classifyIntervalDayNightMinutes(startMins, preEnd)
      : { dayMinutes: 0, nightMinutes: 0 };

  // Post-shift overtime interval: [max(startMins, shiftEndMins), endMins)
  const postStart = Math.max(startMins, shiftEndMins);
  const postShiftOvertimeMinutes = endMins > postStart ? endMins - postStart : 0;
  const postClassified =
    postShiftOvertimeMinutes > 0
      ? classifyIntervalDayNightMinutes(postStart, endMins)
      : { dayMinutes: 0, nightMinutes: 0 };

  const overtimeMinutes = preShiftOvertimeMinutes + postShiftOvertimeMinutes;
  const dayOvertimeMinutes = preClassified.dayMinutes + postClassified.dayMinutes;
  const nightOvertimeMinutes = preClassified.nightMinutes + postClassified.nightMinutes;
  const regularMinutes = Math.max(0, diff - overtimeMinutes);

  return {
    isComplete: true,
    isValid: true,
    errorMessage: null,
    workedMinutes: diff,
    overtimeMinutes,
    preShiftOvertimeMinutes,
    postShiftOvertimeMinutes,
    dayOvertimeMinutes,
    nightOvertimeMinutes,
    regularMinutes,
    workedFormatted: formatMinutesToHHMM(diff),
    overtimeFormatted: formatMinutesToHHMM(overtimeMinutes),
    dayOvertimeFormatted: formatMinutesToHHMM(dayOvertimeMinutes),
    nightOvertimeFormatted: formatMinutesToHHMM(nightOvertimeMinutes),
  };
}

/**
 * Sorts entries in reverse chronological order (newest workDate first).
 */
export function sortEntriesDesc(entries: WorkEntry[]): WorkEntry[] {
  return [...entries].sort((a, b) => {
    if (a.workDate !== b.workDate) {
      return b.workDate.localeCompare(a.workDate);
    }
    return b.checkInTime.localeCompare(a.checkInTime);
  });
}

/**
 * Computes monthly totals strictly from records belonging to monthKey (YYYY-MM).
 * Never resets stored data; new months naturally start at 00:00 because no records exist yet.
 */
export function calculateMonthlySummary(
  entries: WorkEntry[],
  monthKey: string
): MonthlySummary {
  const monthEntries = entries.filter((e) => getMonthKey(e.workDate) === monthKey);

  let totalWorkedMinutes = 0;
  let totalOvertimeMinutes = 0;
  let totalDayOvertimeMinutes = 0;
  let totalNightOvertimeMinutes = 0;
  let completedDaysCount = 0;
  let incompleteDaysCount = 0;

  for (const entry of monthEntries) {
    const calc = calculateEntryDuration(entry);
    if (calc.isComplete && calc.isValid) {
      totalWorkedMinutes += calc.workedMinutes;
      totalOvertimeMinutes += calc.overtimeMinutes;
      totalDayOvertimeMinutes += calc.dayOvertimeMinutes;
      totalNightOvertimeMinutes += calc.nightOvertimeMinutes;
      completedDaysCount += 1;
    } else {
      incompleteDaysCount += 1;
    }
  }

  const averageDailyMinutes =
    completedDaysCount > 0 ? Math.round(totalWorkedMinutes / completedDaysCount) : 0;

  return {
    monthKey,
    totalWorkedMinutes,
    totalOvertimeMinutes,
    totalDayOvertimeMinutes,
    totalNightOvertimeMinutes,
    completedDaysCount,
    incompleteDaysCount,
    totalEntriesCount: monthEntries.length,
    averageDailyMinutes,
    totalWorkedFormatted: formatMinutesToHHMM(totalWorkedMinutes),
    totalOvertimeFormatted: formatMinutesToHHMM(totalOvertimeMinutes),
    totalDayOvertimeFormatted: formatMinutesToHHMM(totalDayOvertimeMinutes),
    totalNightOvertimeFormatted: formatMinutesToHHMM(totalNightOvertimeMinutes),
    averageDailyFormatted: formatMinutesToHHMM(averageDailyMinutes),
  };
}

/**
 * Computes financial overtime payout for a month based on its independent base hourly rate.
 * Day overtime multiplier = 1.35x, Night overtime multiplier = 1.70x.
 */
export function calculateMonthlyFinancials(
  summary: Pick<MonthlySummary, 'totalDayOvertimeMinutes' | 'totalNightOvertimeMinutes'>,
  baseHourlyRate: number | null | undefined
): MonthlyFinancialSummary {
  if (
    typeof baseHourlyRate !== 'number' ||
    !Number.isFinite(baseHourlyRate) ||
    baseHourlyRate <= 0
  ) {
    return {
      hasRate: false,
      baseHourlyRate: null,
      dayHourlyRate: 0,
      nightHourlyRate: 0,
      dayOvertimeAmount: 0,
      nightOvertimeAmount: 0,
      totalOvertimeAmount: 0,
    };
  }

  const dayOvertimeAmount = roundCurrency(
    (summary.totalDayOvertimeMinutes * baseHourlyRate * DAY_OVERTIME_MULTIPLIER) / 60
  );
  const nightOvertimeAmount = roundCurrency(
    (summary.totalNightOvertimeMinutes * baseHourlyRate * NIGHT_OVERTIME_MULTIPLIER) / 60
  );
  const totalOvertimeAmount = roundCurrency(dayOvertimeAmount + nightOvertimeAmount);

  return {
    hasRate: true,
    baseHourlyRate,
    dayHourlyRate: roundCurrency(baseHourlyRate * DAY_OVERTIME_MULTIPLIER),
    nightHourlyRate: roundCurrency(baseHourlyRate * NIGHT_OVERTIME_MULTIPLIER),
    dayOvertimeAmount,
    nightOvertimeAmount,
    totalOvertimeAmount,
  };
}

/**
 * Returns sorted list of unique month keys (YYYY-MM) descending, always including currentMonthKey.
 */
export function getAvailableMonths(
  entries: WorkEntry[],
  currentMonthKey: string = getCurrentMonthKey()
): string[] {
  const set = new Set<string>([currentMonthKey]);
  for (const entry of entries) {
    if (isValidDateString(entry.workDate)) {
      set.add(getMonthKey(entry.workDate));
    }
  }
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

export interface UpsertEntryResult {
  ok: boolean;
  error?: string;
  entries: WorkEntry[];
  savedEntry?: WorkEntry;
}

/**
 * Adds a new work entry while strictly enforcing one record per workDate.
 */
export function createWorkEntry(
  entries: WorkEntry[],
  input: Omit<WorkEntry, 'id' | 'createdAt' | 'updatedAt'>,
  nowIso: string = new Date().toISOString()
): UpsertEntryResult {
  if (!isValidDateString(input.workDate)) {
    return { ok: false, error: 'التاريخ المختار مش صحيح.', entries };
  }
  if (!isValidTimeString(input.checkInTime)) {
    return { ok: false, error: 'وقت الحضور مش صحيح.', entries };
  }

  const existingForDate = entries.find((e) => e.workDate === input.workDate);
  if (existingForDate) {
    return {
      ok: false,
      error: `اليوم ده (${input.workDate}) متسجل بالفعل. تقدر تعدّل التسجيل الموجود بدل ما تضيف واحد جديد.`,
      entries,
    };
  }

  const calc = calculateEntryDuration(input);
  if (!calc.isValid) {
    return { ok: false, error: calc.errorMessage || 'بيانات التسجيل غير صالحة.', entries };
  }

  const newEntry: WorkEntry = {
    ...input,
    id: input.workDate,
    checkOutDate: input.checkOutTime ? input.checkOutDate || input.workDate : null,
    checkOutTime: input.checkOutTime || null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  return {
    ok: true,
    entries: sortEntriesDesc([newEntry, ...entries]),
    savedEntry: newEntry,
  };
}

/**
 * Updates an existing work entry by id, enforcing uniqueness if workDate changed
 * and strict duration validation.
 */
export function updateWorkEntry(
  entries: WorkEntry[],
  targetId: string,
  updates: Partial<Omit<WorkEntry, 'id' | 'createdAt'>>,
  nowIso: string = new Date().toISOString()
): UpsertEntryResult {
  const index = entries.findIndex((e) => e.id === targetId);
  if (index === -1) {
    return { ok: false, error: 'التسجيل المطلوب تعديله مش موجود.', entries };
  }

  const current = entries[index];
  const nextWorkDate = updates.workDate ?? current.workDate;

  if (!isValidDateString(nextWorkDate)) {
    return { ok: false, error: 'التاريخ الجديد مش صحيح.', entries };
  }

  if (nextWorkDate !== current.workDate) {
    const duplicate = entries.find((e) => e.id !== targetId && e.workDate === nextWorkDate);
    if (duplicate) {
      return {
        ok: false,
        error: `مينفعش تنقل التسجيل ليوم ${nextWorkDate} عشان اليوم ده متسجل فيه شغل بالفعل.`,
        entries,
      };
    }
  }

  const nextCheckOutTime =
    updates.checkOutTime === undefined ? current.checkOutTime : updates.checkOutTime;
  const nextCheckOutDate = nextCheckOutTime
    ? updates.checkOutDate === undefined
      ? current.checkOutDate || nextWorkDate
      : updates.checkOutDate || nextWorkDate
    : null;

  const candidate: WorkEntry = {
    ...current,
    ...updates,
    id: nextWorkDate,
    workDate: nextWorkDate,
    checkOutDate: nextCheckOutDate,
    checkOutTime: nextCheckOutTime,
    updatedAt: nowIso,
  };

  const calc = calculateEntryDuration(candidate);
  if (!calc.isValid) {
    return { ok: false, error: calc.errorMessage || 'وقت الانصراف غير منطقي.', entries };
  }

  const nextEntries = entries.map((e, i) => (i === index ? candidate : e));
  return {
    ok: true,
    entries: sortEntriesDesc(nextEntries),
    savedEntry: candidate,
  };
}

/**
 * Deletes an entry by id and returns updated reverse-chronological list.
 */
export function deleteWorkEntry(entries: WorkEntry[], targetId: string): WorkEntry[] {
  return sortEntriesDesc(entries.filter((e) => e.id !== targetId));
}

/**
 * Normalizes Arabic and mixed Latin/numeric text for forgiving search:
 * - Strips Arabic diacritics (tashkeel) and tatweel
 * - Unifies Alef forms (أ إ آ ٱ -> ا)
 * - Unifies Teh Marbuta & Heh (ة -> ه)
 * - Unifies Alef Maksura & Yeh (ى -> ي) and Hamza carriers (ؤ -> و, ئ -> ي)
 * - Converts Eastern Arabic / Persian numerals (٠-٩, ۰-۹) to ASCII 0-9
 * - Collapses extra whitespace and lowercases
 */
export function normalizeArabicSearchText(value: string): string {
  return value
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const SHIFT_SEARCH_SYNONYMS: Record<ShiftId, string> = {
  shift1: 'الاولي الاول 1',
  shift2: 'التانيه الثانيه 2',
  shift3: 'التالته الثالثه 3',
};

/**
 * Checks if a WorkEntry matches an Arabic/English/numeric search query across date,
 * shift label (colloquial & MSA), notes, and incomplete status.
 */
export function matchesWorkEntrySearch(entry: WorkEntry, rawQuery: string): boolean {
  const normalizedQuery = normalizeArabicSearchText(rawQuery);
  if (!normalizedQuery) return true;

  const tokens = normalizedQuery.split(' ').filter(Boolean);
  if (tokens.length === 0) return true;

  const searchable = normalizeArabicSearchText(
    [
      entry.workDate,
      formatEgyptianNumericDate(entry.workDate),
      formatArabicDate(entry.workDate),
      formatMonthLabel(getMonthKey(entry.workDate)),
      SHIFTS[entry.shift]?.label ?? '',
      SHIFT_SEARCH_SYNONYMS[entry.shift] ?? '',
      entry.notes ?? '',
      !entry.checkOutTime ? 'ناقص انصراف لسه مسجلتش' : '',
    ].join(' ')
  );

  return tokens.every((token) => searchable.includes(token));
}

