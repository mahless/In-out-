import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEntryDuration,
  calculateMonthlySummary,
  createWorkEntry,
  deleteWorkEntry,
  formatMinutesToHHMM,
  inferCheckOutDate,
  updateWorkEntry,
} from './workCalculations';
import {
  createBackupPayload,
  loadAppData,
  mergeBackupData,
  migrateStorageData,
  parseBackupJson,
  saveAppData,
  StorageLike,
} from './storage';
import { WorkEntry } from '../types/work';

function createMemoryStorage(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
  };
}

test('1. يوم عمل 8 ساعات بالضبط (07:00 إلى 15:00)', () => {
  const res = calculateEntryDuration({
    workDate: '2026-11-18',
    checkInTime: '07:00',
    checkOutDate: '2026-11-18',
    checkOutTime: '15:00',
  });
  assert.equal(res.isValid, true);
  assert.equal(res.isComplete, true);
  assert.equal(res.workedMinutes, 480);
  assert.equal(res.overtimeMinutes, 0);
  assert.equal(res.workedFormatted, '08:00');
  assert.equal(res.overtimeFormatted, '00:00');
});

test('2. يوم عمل 10 ساعات (07:00 إلى 17:00 و 07:30 إلى 17:30)', () => {
  const a = calculateEntryDuration({
    workDate: '2026-11-18',
    checkInTime: '07:00',
    checkOutDate: '2026-11-18',
    checkOutTime: '17:00',
  });
  assert.equal(a.workedFormatted, '10:00');
  assert.equal(a.overtimeFormatted, '02:00');

  const b = calculateEntryDuration({
    workDate: '2026-11-19',
    checkInTime: '07:30',
    checkOutDate: '2026-11-19',
    checkOutTime: '17:30',
  });
  assert.equal(b.workedFormatted, '10:00');
  assert.equal(b.overtimeFormatted, '02:00');
});

test('3. يوم عمل أقل من 8 ساعات — الأوفر تايم يكون صفرًا ولا يظهر بالسالب', () => {
  const res = calculateEntryDuration({
    workDate: '2026-11-18',
    checkInTime: '08:15',
    checkOutDate: '2026-11-18',
    checkOutTime: '14:45',
  });
  assert.equal(res.isValid, true);
  assert.equal(res.workedMinutes, 390);
  assert.equal(res.overtimeMinutes, 0);
  assert.equal(res.workedFormatted, '06:30');
  assert.equal(res.overtimeFormatted, '00:00');
});

test('4. وردية ليلية تعبر منتصف الليل (23:00 إلى 09:00 اليوم التالي)', () => {
  const inferredDate = inferCheckOutDate('2026-11-18', '23:00', '09:00', 'shift3');
  assert.equal(inferredDate, '2026-11-19');

  const res = calculateEntryDuration({
    workDate: '2026-11-18',
    checkInTime: '23:00',
    checkOutDate: inferredDate,
    checkOutTime: '09:00',
  });
  assert.equal(res.isValid, true);
  assert.equal(res.workedMinutes, 600);
  assert.equal(res.overtimeMinutes, 120);
  assert.equal(res.workedFormatted, '10:00');
  assert.equal(res.overtimeFormatted, '02:00');
});

test('5. تسجيل حضور وانصراف في تاريخين مختلفين حتى لو عبر نهاية الشهر أو السنة', () => {
  const res = calculateEntryDuration({
    workDate: '2026-11-30',
    checkInTime: '23:00',
    checkOutDate: '2026-12-01',
    checkOutTime: '07:45',
  });
  assert.equal(res.isValid, true);
  assert.equal(res.workedMinutes, 525);
  assert.equal(res.overtimeMinutes, 45);
  assert.equal(res.workedFormatted, '08:45');
  assert.equal(res.overtimeFormatted, '00:45');
});

test('6. تعديل وقت الحضور يعيد حساب الساعات والأوفر تايم بدقة', () => {
  let entries: WorkEntry[] = [];
  const created = createWorkEntry(entries, {
    workDate: '2026-11-10',
    shift: 'shift1',
    checkInTime: '07:00',
    checkOutDate: '2026-11-10',
    checkOutTime: '15:00',
  });
  assert.equal(created.ok, true);
  entries = created.entries;

  const updated = updateWorkEntry(entries, '2026-11-10', { checkInTime: '06:00' });
  assert.equal(updated.ok, true);
  const calc = calculateEntryDuration(updated.savedEntry!);
  assert.equal(calc.workedFormatted, '09:00');
  assert.equal(calc.overtimeFormatted, '01:00');
});

test('7. تعديل وقت الانصراف ورفض وقت انصراف قبل أو مساوٍ للحضور', () => {
  const created = createWorkEntry([], {
    workDate: '2026-11-11',
    shift: 'shift2',
    checkInTime: '15:00',
    checkOutDate: '2026-11-11',
    checkOutTime: '23:00',
  });
  assert.equal(created.ok, true);

  const invalidUpdate = updateWorkEntry(created.entries, '2026-11-11', {
    checkOutDate: '2026-11-11',
    checkOutTime: '14:30',
  });
  assert.equal(invalidUpdate.ok, false);

  const validUpdate = updateWorkEntry(created.entries, '2026-11-11', {
    checkOutDate: '2026-11-12',
    checkOutTime: '00:30',
  });
  assert.equal(validUpdate.ok, true);
  const calc = calculateEntryDuration(validUpdate.savedEntry!);
  assert.equal(calc.workedFormatted, '09:30');
  assert.equal(calc.overtimeFormatted, '01:30');
});

test('8. حذف سجل وإعادة حساب الإجماليات', () => {
  let entries: WorkEntry[] = [];
  entries = createWorkEntry(entries, {
    workDate: '2026-11-01',
    shift: 'shift1',
    checkInTime: '07:00',
    checkOutDate: '2026-11-01',
    checkOutTime: '17:00',
  }).entries;
  entries = createWorkEntry(entries, {
    workDate: '2026-11-02',
    shift: 'shift1',
    checkInTime: '07:00',
    checkOutDate: '2026-11-02',
    checkOutTime: '16:00',
  }).entries;

  assert.equal(calculateMonthlySummary(entries, '2026-11').totalWorkedFormatted, '19:00');
  assert.equal(calculateMonthlySummary(entries, '2026-11').totalOvertimeFormatted, '03:00');

  entries = deleteWorkEntry(entries, '2026-11-01');
  const afterDelete = calculateMonthlySummary(entries, '2026-11');
  assert.equal(afterDelete.completedDaysCount, 1);
  assert.equal(afterDelete.totalWorkedFormatted, '09:00');
  assert.equal(afterDelete.totalOvertimeFormatted, '01:00');
});

test('9 و 10. تجميع إجماليات الشهر والانتقال لشهر جديد يبدأ من 00:00 مع حفظ الشهور السابقة', () => {
  let entries: WorkEntry[] = [];
  entries = createWorkEntry(entries, {
    workDate: '2026-10-28',
    shift: 'shift1',
    checkInTime: '07:00',
    checkOutDate: '2026-10-28',
    checkOutTime: '17:00', // 10h, 2h OT
  }).entries;
  entries = createWorkEntry(entries, {
    workDate: '2026-10-29',
    shift: 'shift1',
    checkInTime: '07:00',
    checkOutDate: '2026-10-29',
    checkOutTime: '15:00', // 8h, 0h OT
  }).entries;
  entries = createWorkEntry(entries, {
    workDate: '2026-11-01',
    shift: 'shift3',
    checkInTime: '23:00',
    checkOutDate: '2026-11-02',
    checkOutTime: '08:00', // 9h, 1h OT
  }).entries;

  const oct = calculateMonthlySummary(entries, '2026-10');
  assert.equal(oct.totalWorkedFormatted, '18:00');
  assert.equal(oct.totalOvertimeFormatted, '02:00');
  assert.equal(oct.completedDaysCount, 2);
  assert.equal(oct.averageDailyFormatted, '09:00');

  const nov = calculateMonthlySummary(entries, '2026-11');
  assert.equal(nov.totalWorkedFormatted, '09:00');
  assert.equal(nov.totalOvertimeFormatted, '01:00');

  const dec = calculateMonthlySummary(entries, '2026-12');
  assert.equal(dec.totalWorkedFormatted, '00:00');
  assert.equal(dec.totalOvertimeFormatted, '00:00');
  assert.equal(dec.completedDaysCount, 0);
});

test('11. منع تكرار تسجيل نفس التاريخ عند الإضافة وعند تعديل التاريخ', () => {
  let entries: WorkEntry[] = [];
  entries = createWorkEntry(entries, {
    workDate: '2026-11-15',
    shift: 'shift1',
    checkInTime: '07:00',
    checkOutDate: null,
    checkOutTime: null,
  }).entries;

  const dupCreate = createWorkEntry(entries, {
    workDate: '2026-11-15',
    shift: 'shift2',
    checkInTime: '15:00',
    checkOutDate: null,
    checkOutTime: null,
  });
  assert.equal(dupCreate.ok, false);

  entries = createWorkEntry(entries, {
    workDate: '2026-11-16',
    shift: 'shift2',
    checkInTime: '15:00',
    checkOutDate: '2026-11-16',
    checkOutTime: '23:00',
  }).entries;

  const dupUpdate = updateWorkEntry(entries, '2026-11-16', { workDate: '2026-11-15' });
  assert.equal(dupUpdate.ok, false);
});

test('12. حفظ واستعادة البيانات والوردية المختارة والنسخ الاحتياطي والترحيل الآمن', () => {
  const storage = createMemoryStorage();
  const created = createWorkEntry([], {
    workDate: '2026-11-18',
    shift: 'shift3',
    checkInTime: '23:00',
    checkOutDate: null, // تسجيل غير مكتمل عند غلق التطبيق
    checkOutTime: null,
  });

  const saved = saveAppData(
    {
      version: 1,
      selectedShift: 'shift3',
      entries: created.entries,
    },
    storage
  );
  assert.equal(saved, true);

  // Simulate reopening app
  const restored = loadAppData(storage);
  assert.equal(restored.selectedShift, 'shift3');
  assert.equal(restored.entries.length, 1);
  assert.equal(restored.entries[0].checkOutTime, null);

  // Backup export & import merge/replace
  const backupJson = JSON.stringify(createBackupPayload(restored));
  const parsed = parseBackupJson(backupJson);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.entryCount, 1);

  const extraEntry = createWorkEntry([], {
    workDate: '2026-11-19',
    shift: 'shift1',
    checkInTime: '07:00',
    checkOutDate: '2026-11-19',
    checkOutTime: '15:00',
  }).entries[0];

  const merged = mergeBackupData(
    { ...restored, entries: [extraEntry] },
    parsed.data!,
    'merge'
  );
  assert.equal(merged.entries.length, 2);

  // Reject malformed backup JSON
  const badBackup = parseBackupJson('{invalid json');
  assert.equal(badBackup.ok, false);

  // Safe migration preserves older entries and formats HH:MM properly
  const migrated = migrateStorageData({
    version: 0,
    selectedShift: 'invalid_shift',
    entries: [
      {
        workDate: '2026-11-05',
        shift: 'shift2',
        checkInTime: '15:00',
        checkOutDate: '2026-11-05',
        checkOutTime: '23:30',
      },
    ],
  });
  assert.equal(migrated.selectedShift, 'shift1');
  assert.equal(migrated.entries.length, 1);
  assert.equal(formatMinutesToHHMM(1000), '16:40');
});
