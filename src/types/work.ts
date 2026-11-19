export type ShiftId = 'shift1' | 'shift2' | 'shift3';

export interface ShiftDefinition {
  id: ShiftId;
  label: string;
  shortLabel: string;
  timeRangeLabel: string;
  defaultStartTime: string;
  defaultEndTime: string;
  crossesMidnight: boolean;
}

export interface WorkEntry {
  id: string;
  workDate: string; // YYYY-MM-DD
  shift: ShiftId;
  checkInTime: string; // HH:MM (24h)
  checkOutDate: string | null; // YYYY-MM-DD
  checkOutTime: string | null; // HH:MM (24h)
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalculatedEntryDuration {
  isComplete: boolean;
  isValid: boolean;
  errorMessage: string | null;
  workedMinutes: number;
  overtimeMinutes: number;
  preShiftOvertimeMinutes: number;
  postShiftOvertimeMinutes: number;
  dayOvertimeMinutes: number;
  nightOvertimeMinutes: number;
  regularMinutes: number;
  workedFormatted: string;
  overtimeFormatted: string;
  dayOvertimeFormatted: string;
  nightOvertimeFormatted: string;
}

export interface MonthlySummary {
  monthKey: string; // YYYY-MM
  totalWorkedMinutes: number;
  totalOvertimeMinutes: number;
  totalDayOvertimeMinutes: number;
  totalNightOvertimeMinutes: number;
  completedDaysCount: number;
  incompleteDaysCount: number;
  totalEntriesCount: number;
  averageDailyMinutes: number;
  totalWorkedFormatted: string;
  totalOvertimeFormatted: string;
  totalDayOvertimeFormatted: string;
  totalNightOvertimeFormatted: string;
  averageDailyFormatted: string;
}

export interface MonthlyFinancialSummary {
  hasRate: boolean;
  baseHourlyRate: number | null;
  dayHourlyRate: number;
  nightHourlyRate: number;
  dayOvertimeAmount: number;
  nightOvertimeAmount: number;
  totalOvertimeAmount: number;
}

export interface AppStorageData {
  version: number;
  selectedShift: ShiftId;
  entries: WorkEntry[];
  monthlyHourlyRates: Record<string, number>;
}

export interface BackupPayload {
  app: 'daftar-elshoghl';
  version: number;
  exportedAt: string;
  selectedShift: ShiftId;
  entries: WorkEntry[];
  monthlyHourlyRates?: Record<string, number>;
}

