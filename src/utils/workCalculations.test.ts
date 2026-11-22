import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEntryDuration,
  calculateMonthlyFinancials,
  calculateMonthlySummary,
  classifyIntervalDayNightMinutes,
  createWorkEntry,
  deleteWorkEntry,
  formatMinutesToHHMM,
  inferCheckOutDate,
  matchesWorkEntrySearch,
  normalizeArabicSearchText,
  toEpochMinutes,
  updateWorkEntry,
} from './workCalculations';
import {
  createBackupPayload,
  loadAppData,
  mergeBackupData,
  migrateStorageData,
  parseBackupJson,
  saveAppData,
  STORAGE_KEY,
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

test('1. يوم عمل داخل حدود الوردية الأولى بالضبط (07:00 إلى 15:00) -> بدون أوفر تايم', () => {
  const res = calculateEntryDuration({
    workDate: '2026-11-18',
    shift: 'shift1',
    checkInTime: '07:00',
    checkOutDate: '2026-11-18',
    checkOutTime: '15:00',
  });
  assert.equal(res.isValid, true);
  assert.equal(res.isComplete, true);
  assert.equal(res.workedMinutes, 480);
  assert.equal(res.overtimeMinutes, 0);
  assert.equal(res.dayOvertimeMinutes, 0);
  assert.equal(res.nightOvertimeMinutes, 0);
  assert.equal(res.workedFormatted, '08:00');
  assert.equal(res.overtimeFormatted, '00:00');
});

test('2. حضور قبل الوردية + انصراف بعد الوردية (الأولى 06:00 إلى 15:30 -> 01:30 أوفر تايم نهاري)', () => {
  const res = calculateEntryDuration({
    workDate: '2026-11-18',
    shift: 'shift1',
    checkInTime: '06:00',
    checkOutDate: '2026-11-18',
    checkOutTime: '15:30',
  });
  assert.equal(res.isValid, true);
  assert.equal(res.workedFormatted, '09:30');
  assert.equal(res.preShiftOvertimeMinutes, 60);
  assert.equal(res.postShiftOvertimeMinutes, 30);
  assert.equal(res.overtimeFormatted, '01:30');
  assert.equal(res.dayOvertimeFormatted, '01:30');
  assert.equal(res.nightOvertimeFormatted, '00:00');
});

test('3. التأخير أو الانصراف المبكر لا يُخصم من الأوفر تايم ولا يعوّضه (09:00 إلى 17:00 على الأولى -> 02:00 أوفر تايم)', () => {
  const lateWithOt = calculateEntryDuration({
    workDate: '2026-11-18',
    shift: 'shift1',
    checkInTime: '09:00',
    checkOutDate: '2026-11-18',
    checkOutTime: '17:00',
  });
  assert.equal(lateWithOt.workedFormatted, '08:00');
  assert.equal(lateWithOt.preShiftOvertimeMinutes, 0);
  assert.equal(lateWithOt.postShiftOvertimeMinutes, 120);
  assert.equal(lateWithOt.overtimeFormatted, '02:00');
  assert.equal(lateWithOt.dayOvertimeFormatted, '02:00');

  // Early departure with pre-shift OT -> early departure does NOT deduct pre-shift OT
  const earlyDepWithPreOt = calculateEntryDuration({
    workDate: '2026-11-18',
    shift: 'shift1',
    checkInTime: '06:00',
    checkOutDate: '2026-11-18',
    checkOutTime: '14:00',
  });
  assert.equal(earlyDepWithPreOt.workedFormatted, '08:00');
  assert.equal(earlyDepWithPreOt.overtimeFormatted, '01:00');
  assert.equal(earlyDepWithPreOt.dayOvertimeFormatted, '01:00');

  // Inside shift boundaries only (08:15 to 14:45) -> 00:00 OT
  const shortInside = calculateEntryDuration({
    workDate: '2026-11-18',
    shift: 'shift1',
    checkInTime: '08:15',
    checkOutDate: '2026-11-18',
    checkOutTime: '14:45',
  });
  assert.equal(shortInside.workedFormatted, '06:30');
  assert.equal(shortInside.overtimeMinutes, 0);
  assert.equal(shortInside.overtimeFormatted, '00:00');
});

test('4. تقسيم الأوفر تايم تلقائيًا عند حد 18:00 (الأولى 07:00 إلى 19:00 -> 03:00 نهاري + 01:00 ليلي)', () => {
  const res = calculateEntryDuration({
    workDate: '2026-11-18',
    shift: 'shift1',
    checkInTime: '07:00',
    checkOutDate: '2026-11-18',
    checkOutTime: '19:00',
  });
  // Post-shift 15:00–19:00 => 15:00–18:00 (03:00 day) + 18:00–19:00 (01:00 night)
  assert.equal(res.overtimeFormatted, '04:00');
  assert.equal(res.dayOvertimeFormatted, '03:00');
  assert.equal(res.nightOvertimeFormatted, '01:00');
});

test('5. تقسيم الأوفر تايم تلقائيًا عند حد 06:00 (الأولى حضور 05:00 وانصراف 15:00 -> 01:00 ليلي + 01:00 نهاري)', () => {
  const res = calculateEntryDuration({
    workDate: '2026-11-18',
    shift: 'shift1',
    checkInTime: '05:00',
    checkOutDate: '2026-11-18',
    checkOutTime: '15:00',
  });
  // Pre-shift 05:00–07:00 => 05:00–06:00 (01:00 night) + 06:00–07:00 (01:00 day)
  assert.equal(res.overtimeFormatted, '02:00');
  assert.equal(res.dayOvertimeFormatted, '01:00');
  assert.equal(res.nightOvertimeFormatted, '01:00');
});

test('6. الوردية الثانية (15:00 إلى 23:00) — أوفر تايم قبل وبعد الوردية عبر حد 18:00 ومنتصف الليل', () => {
  // Check in 13:00 (2h pre-shift day), check out next day 00:30 (1.5h post-shift night)
  const inferred = inferCheckOutDate('2026-11-11', '13:00', '00:30', 'shift2');
  assert.equal(inferred, '2026-11-12');

  const res = calculateEntryDuration({
    workDate: '2026-11-11',
    shift: 'shift2',
    checkInTime: '13:00',
    checkOutDate: inferred,
    checkOutTime: '00:30',
  });
  assert.equal(res.workedFormatted, '11:30');
  assert.equal(res.preShiftOvertimeMinutes, 120); // 13:00–15:00 (Day)
  assert.equal(res.postShiftOvertimeMinutes, 90); // 23:00–00:30 (Night)
  assert.equal(res.overtimeFormatted, '03:30');
  assert.equal(res.dayOvertimeFormatted, '02:00');
  assert.equal(res.nightOvertimeFormatted, '01:30');
});

test('7. الوردية الثالثة تعبر منتصف الليل (23:00 إلى 07:00) — حضور 22:00 وانصراف 09:00', () => {
  const inferredDate = inferCheckOutDate('2026-11-18', '22:00', '09:00', 'shift3');
  assert.equal(inferredDate, '2026-11-19');

  const res = calculateEntryDuration({
    workDate: '2026-11-18',
    shift: 'shift3',
    checkInTime: '22:00',
    checkOutDate: inferredDate,
    checkOutTime: '09:00',
  });
  // Pre-shift 22:00–23:00 = 01:00 Night; Post-shift 07:00–09:00 = 02:00 Day
  assert.equal(res.isValid, true);
  assert.equal(res.workedFormatted, '11:00');
  assert.equal(res.overtimeFormatted, '03:00');
  assert.equal(res.dayOvertimeFormatted, '02:00');
  assert.equal(res.nightOvertimeFormatted, '01:00');
});

test('8. حدود 06:00 و 18:00 الدقيقة (06:00 نهاري، 18:00 ليلي) وعبور نهاية الشهر', () => {
  const dawnBoundary = classifyIntervalDayNightMinutes(
    toEpochMinutes('2026-11-18', '05:59'),
    toEpochMinutes('2026-11-18', '06:01')
  );
  assert.equal(dawnBoundary.nightMinutes, 1); // 05:59 -> 06:00
  assert.equal(dawnBoundary.dayMinutes, 1); // 06:00 -> 06:01

  const duskBoundary = classifyIntervalDayNightMinutes(
    toEpochMinutes('2026-11-18', '17:59'),
    toEpochMinutes('2026-11-18', '18:01')
  );
  assert.equal(duskBoundary.dayMinutes, 1); // 17:59 -> 18:00
  assert.equal(duskBoundary.nightMinutes, 1); // 18:00 -> 18:01

  // Cross-month shift3 (Nov 30 23:00 -> Dec 01 07:45)
  const crossMonth = calculateEntryDuration({
    workDate: '2026-11-30',
    shift: 'shift3',
    checkInTime: '23:00',
    checkOutDate: '2026-12-01',
    checkOutTime: '07:45',
  });
  assert.equal(crossMonth.workedFormatted, '08:45');
  assert.equal(crossMonth.overtimeFormatted, '00:45');
  assert.equal(crossMonth.dayOvertimeFormatted, '00:45');
  assert.equal(crossMonth.nightOvertimeFormatted, '00:00');
});

test('9. تعديل وقت الحضور أو الانصراف أو الوردية يعيد الحساب وتصنيف النهاري/الليلي فورًا', () => {
  let entries: WorkEntry[] = [];
  entries = createWorkEntry(entries, {
    workDate: '2026-11-10',
    shift: 'shift1',
    checkInTime: '07:00',
    checkOutDate: '2026-11-10',
    checkOutTime: '15:00',
  }).entries;

  const invalidUpdate = updateWorkEntry(entries, '2026-11-10', {
    checkOutTime: '06:30',
  });
  assert.equal(invalidUpdate.ok, false);

  const updated = updateWorkEntry(entries, '2026-11-10', {
    checkInTime: '05:30',
    checkOutTime: '19:30',
  });
  assert.equal(updated.ok, true);
  const calc = calculateEntryDuration(updated.savedEntry!);
  // Pre: 05:30–06:00 (00:30 night) + 06:00–07:00 (01:00 day)
  // Post: 15:00–18:00 (03:00 day) + 18:00–19:30 (01:30 night)
  // Totals: day 04:00 (240m), night 02:00 (120m), total OT 06:00
  assert.equal(calc.dayOvertimeFormatted, '04:00');
  assert.equal(calc.nightOvertimeFormatted, '02:00');
  assert.equal(calc.overtimeFormatted, '06:00');
});

test('10. حذف سجل يعيد حساب إجماليات الساعات النهارية والليلية للشهر', () => {
  let entries: WorkEntry[] = [];
  entries = createWorkEntry(entries, {
    workDate: '2026-11-01',
    shift: 'shift1',
    checkInTime: '07:00',
    checkOutDate: '2026-11-01',
    checkOutTime: '19:00', // 3h day + 1h night OT
  }).entries;
  entries = createWorkEntry(entries, {
    workDate: '2026-11-02',
    shift: 'shift1',
    checkInTime: '06:00',
    checkOutDate: '2026-11-02',
    checkOutTime: '16:00', // 2h day OT
  }).entries;

  const beforeDelete = calculateMonthlySummary(entries, '2026-11');
  assert.equal(beforeDelete.totalOvertimeFormatted, '06:00');
  assert.equal(beforeDelete.totalDayOvertimeFormatted, '05:00');
  assert.equal(beforeDelete.totalNightOvertimeFormatted, '01:00');

  entries = deleteWorkEntry(entries, '2026-11-01');
  const afterDelete = calculateMonthlySummary(entries, '2026-11');
  assert.equal(afterDelete.completedDaysCount, 1);
  assert.equal(afterDelete.totalOvertimeFormatted, '02:00');
  assert.equal(afterDelete.totalDayOvertimeFormatted, '02:00');
  assert.equal(afterDelete.totalNightOvertimeFormatted, '00:00');
});

test('11. التسعير المالي للأوفر تايم (×1.35 نهاري و ×1.70 ليلي) وحساب الدقائق بدقة بدون تقريب خاطئ', () => {
  let entries: WorkEntry[] = [];
  entries = createWorkEntry(entries, {
    workDate: '2026-11-05',
    shift: 'shift1',
    checkInTime: '06:30', // 00:30 day OT
    checkOutDate: '2026-11-05',
    checkOutTime: '18:30', // 15:00–18:00 (3h day) + 18:00–18:30 (00:30 night)
  }).entries;

  const summary = calculateMonthlySummary(entries, '2026-11');
  assert.equal(summary.totalDayOvertimeMinutes, 210); // 3.5 hours
  assert.equal(summary.totalNightOvertimeMinutes, 30); // 0.5 hours

  // Base rate 100 EGP:
  // Day = 3.5 * 100 * 1.35 = 472.50 EGP
  // Night = 0.5 * 100 * 1.70 = 85.00 EGP
  // Total = 557.50 EGP
  const fin = calculateMonthlyFinancials(summary, 100);
  assert.equal(fin.hasRate, true);
  assert.equal(fin.dayHourlyRate, 135);
  assert.equal(fin.nightHourlyRate, 170);
  assert.equal(fin.dayOvertimeAmount, 472.5);
  assert.equal(fin.nightOvertimeAmount, 85);
  assert.equal(fin.totalOvertimeAmount, 557.5);

  // Decimal hourly rate 55.5 EGP:
  // Day = (210/60)*55.5*1.35 = 262.2375 -> 262.24
  // Night = (30/60)*55.5*1.70 = 47.175 -> 47.18
  // Total = 309.42
  const finDecimal = calculateMonthlyFinancials(summary, 55.5);
  assert.equal(finDecimal.dayOvertimeAmount, 262.24);
  assert.equal(finDecimal.nightOvertimeAmount, 47.18);
  assert.equal(finDecimal.totalOvertimeAmount, 309.42);
});

test('12. عدم إدخال سعر ساعة للشهر يُرجع حالة غير محدد بدون أرقام مالية مضللة', () => {
  const summary = calculateMonthlySummary([], '2026-11');
  for (const unsetRate of [undefined, null, 0, -25, NaN]) {
    const fin = calculateMonthlyFinancials(
      { ...summary, totalDayOvertimeMinutes: 120, totalNightOvertimeMinutes: 60 },
      unsetRate
    );
    assert.equal(fin.hasRate, false);
    assert.equal(fin.baseHourlyRate, null);
    assert.equal(fin.dayOvertimeAmount, 0);
    assert.equal(fin.nightOvertimeAmount, 0);
    assert.equal(fin.totalOvertimeAmount, 0);
  }
});

test('13. استقلال سعر الساعة لكل شهر وحفظه واستعادته تلقائيًا بدون التأثير على باقي الشهور', () => {
  const storage = createMemoryStorage();
  let entries: WorkEntry[] = [];
  entries = createWorkEntry(entries, {
    workDate: '2026-11-10',
    shift: 'shift1',
    checkInTime: '07:00',
    checkOutDate: '2026-11-10',
    checkOutTime: '17:00', // 2h day OT
  }).entries;
  entries = createWorkEntry(entries, {
    workDate: '2026-12-10',
    shift: 'shift1',
    checkInTime: '07:00',
    checkOutDate: '2026-12-10',
    checkOutTime: '17:00', // 2h day OT
  }).entries;

  const saved = saveAppData(
    {
      version: 2,
      selectedShift: 'shift1',
      entries,
      monthlyHourlyRates: {
        '2026-11': 50,
        '2026-12': 55,
        '2027-01': 60,
      },
    },
    storage
  );
  assert.equal(saved, true);

  const restored = loadAppData(storage);
  assert.equal(restored.monthlyHourlyRates['2026-11'], 50);
  assert.equal(restored.monthlyHourlyRates['2026-12'], 55);
  assert.equal(restored.monthlyHourlyRates['2027-01'], 60);

  const novSummary = calculateMonthlySummary(restored.entries, '2026-11');
  const decSummary = calculateMonthlySummary(restored.entries, '2026-12');

  const novFin = calculateMonthlyFinancials(novSummary, restored.monthlyHourlyRates['2026-11']);
  const decFin = calculateMonthlyFinancials(decSummary, restored.monthlyHourlyRates['2026-12']);

  assert.equal(novFin.totalOvertimeAmount, 135); // 2 * 50 * 1.35
  assert.equal(decFin.totalOvertimeAmount, 148.5); // 2 * 55 * 1.35

  // Updating December rate does not change November
  const updatedStorage: typeof restored = {
    ...restored,
    monthlyHourlyRates: { ...restored.monthlyHourlyRates, '2026-12': 70 },
  };
  saveAppData(updatedStorage, storage);
  const reloaded = loadAppData(storage);
  assert.equal(reloaded.monthlyHourlyRates['2026-11'], 50);
  assert.equal(reloaded.monthlyHourlyRates['2026-12'], 70);
});

test('14. منع تكرار تسجيل نفس التاريخ عند الإضافة وعند تعديل التاريخ', () => {
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

test('15. الترحيل الآمن من الإصدار v1 إلى v2 يحافظ على السجلات القديمة والوردية بدون فقدان', () => {
  const storage = createMemoryStorage();
  // Simulate legacy v1 localStorage payload without monthlyHourlyRates
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      selectedShift: 'shift3',
      entries: [
        {
          id: '2026-11-05',
          workDate: '2026-11-05',
          shift: 'shift2',
          checkInTime: '15:00',
          checkOutDate: '2026-11-05',
          checkOutTime: '23:30',
          createdAt: '2026-11-05T13:00:00.000Z',
          updatedAt: '2026-11-05T21:30:00.000Z',
        },
        {
          id: '2026-11-06',
          workDate: '2026-11-06',
          shift: 'shift3',
          checkInTime: '23:00',
          checkOutDate: null,
          checkOutTime: null,
          createdAt: '2026-11-06T21:00:00.000Z',
          updatedAt: '2026-11-06T21:00:00.000Z',
        },
      ],
    })
  );

  const migrated = loadAppData(storage);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.selectedShift, 'shift3');
  assert.equal(migrated.entries.length, 2);
  assert.deepEqual(migrated.monthlyHourlyRates, {});

  // Verify old v1 entries now compute day/night OT dynamically
  const nov5 = migrated.entries.find((e) => e.workDate === '2026-11-05')!;
  const calc = calculateEntryDuration(nov5);
  assert.equal(calc.overtimeFormatted, '00:30');
  assert.equal(calc.nightOvertimeFormatted, '00:30');
  assert.equal(calc.dayOvertimeFormatted, '00:00');
});

test('16. النسخ الاحتياطي JSON واستعادته بالدمج أو الاستبدال يشمل أسعار الساعات الشهرية', () => {
  const created = createWorkEntry([], {
    workDate: '2026-11-18',
    shift: 'shift1',
    checkInTime: '06:00',
    checkOutDate: '2026-11-18',
    checkOutTime: '19:00',
  });

  const payload = createBackupPayload({
    version: 2,
    selectedShift: 'shift2',
    entries: created.entries,
    monthlyHourlyRates: { '2026-11': 75 },
  });

  const parsed = parseBackupJson(JSON.stringify(payload));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data?.monthlyHourlyRates['2026-11'], 75);

  const currentData = migrateStorageData({
    version: 2,
    selectedShift: 'shift1',
    entries: [],
    monthlyHourlyRates: { '2026-10': 60, '2026-11': 50 },
  });

  // Merge preserves current month rate while importing missing months
  const merged = mergeBackupData(currentData, parsed.data!, 'merge');
  assert.equal(merged.entries.length, 1);
  assert.equal(merged.monthlyHourlyRates['2026-10'], 60);
  assert.equal(merged.monthlyHourlyRates['2026-11'], 50);

  // Replace takes incoming rates
  const replaced = mergeBackupData(currentData, parsed.data!, 'replace');
  assert.equal(replaced.monthlyHourlyRates['2026-11'], 75);
  assert.equal(replaced.monthlyHourlyRates['2026-10'], undefined);
  assert.equal(formatMinutesToHHMM(1000), '16:40');
});

test('17. البحث العربي يفهم توحيد (ه/ة) و(أ/إ/آ/ا) و(ى/ي) والتشكيل والأرقام العربية', () => {
  assert.equal(normalizeArabicSearchText('الْوَرْدِيَّةُ الأُولَىٰ'), 'الورديه الاولي');
  assert.equal(normalizeArabicSearchText('٢٢/١١/٢٠٢٦'), '22/11/2026');

  const entry: WorkEntry = {
    id: '2026-11-22',
    workDate: '2026-11-22', // الأحد 22 نوفمبر 2026
    shift: 'shift1', // الوردية الأولى
    checkInTime: '07:00',
    checkOutDate: '2026-11-22',
    checkOutTime: '15:00',
    notes: 'مراجعة جرد المساء',
    createdAt: '2026-11-22T07:00:00.000Z',
    updatedAt: '2026-11-22T15:00:00.000Z',
  };

  // ه vs ة and أ vs ا and ي vs ى
  assert.equal(matchesWorkEntrySearch(entry, 'الورديه الاولي'), true);
  assert.equal(matchesWorkEntrySearch(entry, 'الوردية الأولى'), true);
  assert.equal(matchesWorkEntrySearch(entry, 'الاحد'), true);
  assert.equal(matchesWorkEntrySearch(entry, 'الأحد'), true);
  assert.equal(matchesWorkEntrySearch(entry, 'مراجعه'), true);
  // Arabic numerals and multi-word query
  assert.equal(matchesWorkEntrySearch(entry, 'الاولي ٢٢ نوفمبر'), true);
  // Shift 2/3 colloquial & MSA
  const shift2Entry: WorkEntry = { ...entry, shift: 'shift2' };
  assert.equal(matchesWorkEntrySearch(shift2Entry, 'التانيه'), true);
  assert.equal(matchesWorkEntrySearch(shift2Entry, 'الثانية'), true);
  // Non-matching query
  assert.equal(matchesWorkEntrySearch(entry, 'التالته'), false);
});

