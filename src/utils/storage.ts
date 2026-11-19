import { AppStorageData, BackupPayload, ShiftId, WorkEntry } from '../types/work';
import {
  calculateEntryDuration,
  isValidDateString,
  isValidTimeString,
  sortEntriesDesc,
} from './workCalculations';

export const STORAGE_KEY = 'daftar_elshoghl_data_v1';
export const CURRENT_SCHEMA_VERSION = 1;

const VALID_SHIFTS = new Set<ShiftId>(['shift1', 'shift2', 'shift3']);

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getSafeStorage(customStorage?: StorageLike): StorageLike | null {
  if (customStorage) return customStorage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function getDefaultStorageData(): AppStorageData {
  return {
    version: CURRENT_SCHEMA_VERSION,
    selectedShift: 'shift1',
    entries: [],
  };
}

function sanitizeShift(value: unknown): ShiftId {
  if (typeof value === 'string' && VALID_SHIFTS.has(value as ShiftId)) {
    return value as ShiftId;
  }
  return 'shift1';
}

function sanitizeEntry(raw: unknown): WorkEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const workDate = typeof obj.workDate === 'string' ? obj.workDate : '';
  const checkInTime = typeof obj.checkInTime === 'string' ? obj.checkInTime : '';
  if (!isValidDateString(workDate) || !isValidTimeString(checkInTime)) {
    return null;
  }

  const shift = sanitizeShift(obj.shift);
  const checkOutTime =
    typeof obj.checkOutTime === 'string' && isValidTimeString(obj.checkOutTime)
      ? obj.checkOutTime
      : null;

  let checkOutDate: string | null = null;
  if (checkOutTime) {
    checkOutDate =
      typeof obj.checkOutDate === 'string' && isValidDateString(obj.checkOutDate)
        ? obj.checkOutDate
        : workDate;
  }

  const candidate: WorkEntry = {
    id: workDate,
    workDate,
    shift,
    checkInTime,
    checkOutDate,
    checkOutTime,
    notes: typeof obj.notes === 'string' ? obj.notes.slice(0, 300) : undefined,
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : new Date().toISOString(),
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString(),
  };

  // Validate duration integrity if complete; if corrupted checkOut, keep checkIn intact
  const calc = calculateEntryDuration(candidate);
  if (!calc.isValid && candidate.checkOutTime) {
    return {
      ...candidate,
      checkOutDate: null,
      checkOutTime: null,
    };
  }

  return candidate;
}

/**
 * Safely migrates raw parsed JSON from any older or current version to CURRENT_SCHEMA_VERSION.
 * Deduplicates by workDate (preserving the most recently updated record) to prevent data loss.
 */
export function migrateStorageData(raw: unknown): AppStorageData {
  if (!raw || typeof raw !== 'object') {
    return getDefaultStorageData();
  }

  const data = raw as Record<string, unknown>;
  const selectedShift = sanitizeShift(data.selectedShift);
  const rawEntries = Array.isArray(data.entries) ? data.entries : [];

  const deduped = new Map<string, WorkEntry>();
  for (const item of rawEntries) {
    const clean = sanitizeEntry(item);
    if (!clean) continue;
    const prev = deduped.get(clean.workDate);
    if (!prev || clean.updatedAt >= prev.updatedAt) {
      deduped.set(clean.workDate, clean);
    }
  }

  return {
    version: CURRENT_SCHEMA_VERSION,
    selectedShift,
    entries: sortEntriesDesc(Array.from(deduped.values())),
  };
}

export function loadAppData(customStorage?: StorageLike): AppStorageData {
  const storage = getSafeStorage(customStorage);
  if (!storage) return getDefaultStorageData();

  try {
    const rawStr = storage.getItem(STORAGE_KEY);
    if (!rawStr) return getDefaultStorageData();
    const parsed = JSON.parse(rawStr);
    return migrateStorageData(parsed);
  } catch {
    return getDefaultStorageData();
  }
}

export function saveAppData(data: AppStorageData, customStorage?: StorageLike): boolean {
  const storage = getSafeStorage(customStorage);
  if (!storage) return false;

  try {
    const payload: AppStorageData = {
      version: CURRENT_SCHEMA_VERSION,
      selectedShift: sanitizeShift(data.selectedShift),
      entries: sortEntriesDesc(data.entries),
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function createBackupPayload(data: AppStorageData): BackupPayload {
  return {
    app: 'daftar-elshoghl',
    version: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    selectedShift: data.selectedShift,
    entries: sortEntriesDesc(data.entries),
  };
}

export interface BackupParseResult {
  ok: boolean;
  error?: string;
  data?: AppStorageData;
  entryCount?: number;
}

export function parseBackupJson(jsonText: string): BackupParseResult {
  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as Record<string, unknown>).entries)) {
      return {
        ok: false,
        error: 'ملف النسخة الاحتياطية مش سليم أو مش بصيغة التطبيق.',
      };
    }

    const migrated = migrateStorageData(parsed);
    const rawLen = (parsed as { entries: unknown[] }).entries.length;
    if (rawLen > 0 && migrated.entries.length === 0) {
      return {
        ok: false,
        error: 'مفيش سجلات صالحة جوه ملف النسخة الاحتياطية.',
      };
    }

    return {
      ok: true,
      data: migrated,
      entryCount: migrated.entries.length,
    };
  } catch {
    return {
      ok: false,
      error: 'تعذر قراءة الملف. تأكد إنه ملف JSON سليم.',
    };
  }
}

export function mergeBackupData(
  current: AppStorageData,
  incoming: AppStorageData,
  mode: 'merge' | 'replace'
): AppStorageData {
  if (mode === 'replace') {
    return {
      version: CURRENT_SCHEMA_VERSION,
      selectedShift: incoming.selectedShift || current.selectedShift,
      entries: sortEntriesDesc(incoming.entries),
    };
  }

  const map = new Map<string, WorkEntry>();
  for (const entry of current.entries) {
    map.set(entry.workDate, entry);
  }
  for (const entry of incoming.entries) {
    if (!map.has(entry.workDate)) {
      map.set(entry.workDate, entry);
    }
  }

  return {
    version: CURRENT_SCHEMA_VERSION,
    selectedShift: current.selectedShift,
    entries: sortEntriesDesc(Array.from(map.values())),
  };
}
