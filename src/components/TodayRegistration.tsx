import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Flame,
  LogIn,
  LogOut,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { ShiftId, WorkEntry } from '../types/work';
import {
  addDaysToDate,
  calculateEntryDuration,
  formatArabicDate,
  formatEgyptianNumericDate,
  formatTime12hEgyptian,
  getLocalDateString,
  getLocalTimeString,
  inferCheckOutDate,
  SHIFT_LIST,
  SHIFTS,
  toEpochMinutes,
} from '../utils/workCalculations';
import { RtlDateInput, RtlTimeInput } from './RtlDateTimeInput';

interface TodayRegistrationProps {
  entries: WorkEntry[];
  selectedShift: ShiftId;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onSelectShift: (shift: ShiftId) => void;
  onCheckIn: (workDate: string, shift: ShiftId, time: string) => { ok: boolean; error?: string };
  onUpdateEntry: (
    id: string,
    updates: Partial<Omit<WorkEntry, 'id' | 'createdAt'>>
  ) => { ok: boolean; error?: string };
  onDeleteEntry: (id: string) => void;
  onOpenWorkLog: () => void;
}

export const TodayRegistration: React.FC<TodayRegistrationProps> = ({
  entries,
  selectedShift,
  selectedDate,
  onSelectDate,
  onSelectShift,
  onCheckIn,
  onUpdateEntry,
  onDeleteEntry,
  onOpenWorkLog,
}) => {
  const todayStr = getLocalDateString();
  const currentEntry = entries.find((e) => e.workDate === selectedDate) ?? null;

  // Find any incomplete entry on another date (e.g. yesterday's shift 3)
  const otherIncompleteEntry =
    entries.find((e) => e.workDate !== selectedDate && !e.checkOutTime) ?? null;

  // Local draft inputs so user can freely edit time & checkout date with instant validation feedback
  const [checkInInput, setCheckInInput] = useState<string>('');
  const [checkOutTimeInput, setCheckOutTimeInput] = useState<string>('');
  const [checkOutDateInput, setCheckOutDateInput] = useState<string>('');
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [liveClock, setLiveClock] = useState<string>(() => getLocalTimeString());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLiveClock(getLocalTimeString());
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  // Sync draft fields when selectedDate or stored entry changes
  useEffect(() => {
    if (currentEntry) {
      setCheckInInput(currentEntry.checkInTime);
      setCheckOutTimeInput(currentEntry.checkOutTime ?? '');
      setCheckOutDateInput(currentEntry.checkOutDate ?? currentEntry.workDate);
    } else {
      setCheckInInput('');
      setCheckOutTimeInput('');
      setCheckOutDateInput(selectedDate);
    }
    setFeedbackError(null);
    setConfirmDelete(false);
  }, [
    selectedDate,
    currentEntry?.workDate,
    currentEntry?.checkInTime,
    currentEntry?.checkOutTime,
    currentEntry?.checkOutDate,
  ]);

  const activeShift: ShiftId = currentEntry ? currentEntry.shift : selectedShift;
  const activeShiftDef = SHIFTS[activeShift];

  const duration = currentEntry
    ? calculateEntryDuration(currentEntry)
    : null;

  const showQuickNextDayFix =
    Boolean(currentEntry) &&
    Boolean(checkOutTimeInput) &&
    checkOutDateInput === selectedDate &&
    checkOutTimeInput <= checkInInput;

  const handleShiftClick = (shiftId: ShiftId) => {
    setFeedbackError(null);
    setFeedbackSuccess(null);
    onSelectShift(shiftId);
    if (currentEntry && currentEntry.shift !== shiftId) {
      const res = onUpdateEntry(currentEntry.id, { shift: shiftId });
      if (!res.ok) {
        setFeedbackError(res.error ?? 'تعذر تغيير الوردية.');
      }
    }
  };

  const handleCheckInClick = () => {
    setFeedbackError(null);
    setFeedbackSuccess(null);
    if (currentEntry) {
      setFeedbackError('اليوم ده متسجل فيه حضور بالفعل. تقدر تعدّل الوقت من الخانة تحت.');
      return;
    }
    const nowTime = getLocalTimeString();
    const res = onCheckIn(selectedDate, selectedShift, nowTime);
    if (!res.ok) {
      setFeedbackError(res.error ?? 'تعذر تسجيل الحضور.');
      return;
    }
    setFeedbackSuccess(`تم تسجيل الحضور الساعة ${nowTime}`);
  };

  const handleCheckOutClick = () => {
    setFeedbackError(null);
    setFeedbackSuccess(null);
    if (!currentEntry) {
      setFeedbackError('لازم تسجل الحضور الأول قبل تسجيل الانصراف.');
      return;
    }
    const now = new Date();
    const nowDate = getLocalDateString(now);
    const nowTime = getLocalTimeString(now);

    // Check if phone date is within 24h window from workDate
    const realDiff =
      toEpochMinutes(nowDate, nowTime) -
      toEpochMinutes(currentEntry.workDate, currentEntry.checkInTime);

    let targetOutDate: string;
    if (realDiff > 0 && realDiff <= 24 * 60) {
      targetOutDate = nowDate;
    } else {
      targetOutDate = inferCheckOutDate(
        currentEntry.workDate,
        currentEntry.checkInTime,
        nowTime,
        currentEntry.shift
      );
    }

    const checkDiff =
      toEpochMinutes(targetOutDate, nowTime) -
      toEpochMinutes(currentEntry.workDate, currentEntry.checkInTime);

    if (!Number.isFinite(checkDiff) || checkDiff <= 0) {
      setCheckOutDateInput(targetOutDate);
      setCheckOutTimeInput(nowTime);
      setFeedbackError(
        'وقت الانصراف الحالي مش بعد وقت الحضور بدقيقة على الأقل. عدّل وقت أو تاريخ الانصراف يدويًا.'
      );
      return;
    }

    const res = onUpdateEntry(currentEntry.id, {
      checkOutDate: targetOutDate,
      checkOutTime: nowTime,
    });

    if (!res.ok) {
      setFeedbackError(res.error ?? 'تعذر تسجيل الانصراف.');
      return;
    }
    setFeedbackSuccess(`تم تسجيل الانصراف الساعة ${nowTime}`);
  };

  const handleCheckInManualChange = (nextTime: string) => {
    setCheckInInput(nextTime);
    setFeedbackError(null);
    setFeedbackSuccess(null);
    if (!currentEntry || !nextTime) return;

    const res = onUpdateEntry(currentEntry.id, { checkInTime: nextTime });
    if (!res.ok) {
      setFeedbackError(res.error ?? 'وقت الحضور مش متوافق مع وقت الانصراف.');
    }
  };

  const handleCheckOutManualChange = (nextDate: string, nextTime: string) => {
    setCheckOutDateInput(nextDate);
    setCheckOutTimeInput(nextTime);
    setFeedbackError(null);
    setFeedbackSuccess(null);
    if (!currentEntry) return;

    if (!nextTime) {
      onUpdateEntry(currentEntry.id, { checkOutDate: null, checkOutTime: null });
      return;
    }

    // For shift 3, if user hasn't explicitly moved away from workDate and entered an early morning hour,
    // automatically map to next calendar day for smooth overnight entry.
    let resolvedDate = nextDate || currentEntry.workDate;
    if (
      activeShiftDef.crossesMidnight &&
      resolvedDate === currentEntry.workDate &&
      nextTime < currentEntry.checkInTime &&
      nextDate === currentEntry.workDate &&
      !currentEntry.checkOutTime
    ) {
      resolvedDate = addDaysToDate(currentEntry.workDate, 1);
      setCheckOutDateInput(resolvedDate);
    }

    const res = onUpdateEntry(currentEntry.id, {
      checkOutDate: resolvedDate,
      checkOutTime: nextTime,
    });
    if (!res.ok) {
      setFeedbackError(res.error ?? 'وقت الانصراف مش منطقي.');
    }
  };

  const handleUseNextDayForCheckout = () => {
    if (!currentEntry || !checkOutTimeInput) return;
    const nextDay = addDaysToDate(currentEntry.workDate, 1);
    setCheckOutDateInput(nextDay);
    setFeedbackError(null);
    const res = onUpdateEntry(currentEntry.id, {
      checkOutDate: nextDay,
      checkOutTime: checkOutTimeInput,
    });
    if (!res.ok) {
      setFeedbackError(res.error ?? 'تعذر تحديث تاريخ الانصراف.');
    } else {
      setFeedbackSuccess('تم ضبط الانصراف على اليوم التالي بنجاح.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Open shift recovery banner if user forgot to check out on a previous date */}
      {otherIncompleteEntry && (
        <div
          role="region"
          aria-label="تنبيه وردية مفتوحة"
          className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-700 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-amber-950">
                عندك تسجيل مفتوح لسه مسجلتش فيه الانصراف
              </p>
              <p className="mt-0.5 text-xs text-amber-900">
                يوم {formatArabicDate(otherIncompleteEntry.workDate)} ·{' '}
                {SHIFTS[otherIncompleteEntry.shift].label} · حضور{' '}
                <span className="tabular-time font-semibold">{otherIncompleteEntry.checkInTime}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectDate(otherIncompleteEntry.workDate)}
            className="min-h-[44px] rounded-xl bg-amber-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            افتح اليوم لتسجيل الانصراف
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Main Registration Panel (7 cols on desktop) */}
        <section
          aria-label="تسجيل يوم الشغل"
          className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 lg:col-span-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 sm:text-xl">
                تسجيل يوم الشغل
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                ساعة الجهاز دلوقتي:{' '}
                <span className="tabular-time font-semibold text-slate-700">{liveClock}</span>
              </p>
            </div>

            {selectedDate !== todayStr && (
              <button
                type="button"
                onClick={() => onSelectDate(todayStr)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>رجوع لتاريخ النهارده</span>
              </button>
            )}
          </div>

          {/* 1. Date Picker */}
          <div className="mt-5">
            <label htmlFor="work-date-input" className="block text-sm font-semibold text-slate-800">
              1. تاريخ يوم الشغل
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex-1">
                <RtlDateInput
                  id="work-date-input"
                  value={selectedDate}
                  onChange={(val) => {
                    if (val) onSelectDate(val);
                  }}
                />
              </div>
              <p className="text-xs font-medium text-slate-600 sm:min-w-[170px]">
                {formatArabicDate(selectedDate)}
              </p>
            </div>
            {currentEntry && (
              <p className="mt-2 text-xs font-medium text-teal-800">
                التاريخ ده متسجل بالفعل — أي تعديل هيتحفظ عليه مباشرة ومش هيتكرر.
              </p>
            )}
          </div>

          {/* 2. Shift Selector */}
          <div className="mt-6">
            <span className="block text-sm font-semibold text-slate-800">
              2. اختار الوردية (بتتحفظ تلقائيًا)
            </span>
            <div
              role="radiogroup"
              aria-label="اختيار الوردية"
              className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3"
            >
              {SHIFT_LIST.map((shift) => {
                const isSelected = activeShift === shift.id;
                return (
                  <button
                    key={shift.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleShiftClick(shift.id)}
                    className={`min-h-[56px] rounded-xl border p-3 text-right transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-teal-700 bg-teal-50 text-teal-950 ring-1 ring-teal-700'
                        : 'border-slate-200 bg-slate-50/70 text-slate-800 hover:border-slate-300 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{shift.label}</span>
                      {isSelected && (
                        <CheckCircle2 className="h-4 w-4 text-teal-700 shrink-0" aria-hidden="true" />
                      )}
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-slate-600">
                      {shift.timeRangeLabel}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3 & 4. Check-In and Check-Out Quick Buttons + Manual Time Editing */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Check-in block */}
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">3. الحضور</span>
                {currentEntry && (
                  <span className="text-xs font-semibold text-teal-700">تم التسجيل</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleCheckInClick}
                disabled={Boolean(currentEntry)}
                className={`mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
                  currentEntry
                    ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
                    : 'cursor-pointer bg-teal-700 text-white hover:bg-teal-800 active:scale-[0.99]'
                }`}
              >
                <LogIn className="h-5 w-5" aria-hidden="true" />
                <span>تسجيل الحضور</span>
              </button>

              {currentEntry && (
                <div className="mt-3">
                  <label
                    htmlFor="manual-checkin-time"
                    className="block text-xs font-medium text-slate-600"
                  >
                    تعديل وقت الحضور يدويًا
                  </label>
                  <div className="mt-1.5">
                    <RtlTimeInput
                      id="manual-checkin-time"
                      value={checkInInput}
                      onChange={handleCheckInManualChange}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Check-out block */}
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">4. الانصراف</span>
                {currentEntry?.checkOutTime && (
                  <span className="text-xs font-semibold text-teal-700">تم التسجيل</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleCheckOutClick}
                disabled={!currentEntry}
                className={`mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
                  !currentEntry
                    ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
                    : currentEntry.checkOutTime
                    ? 'cursor-pointer border border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                    : 'cursor-pointer bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.99]'
                }`}
              >
                <LogOut className="h-5 w-5" aria-hidden="true" />
                <span>
                  {currentEntry?.checkOutTime ? 'تحديث الانصراف بالوقت الحالي' : 'تسجيل الانصراف'}
                </span>
              </button>

              {!currentEntry ? (
                <p className="mt-3 text-xs text-slate-500">
                  الزر ده هيفتح بعد ما تسجل الحضور الأول.
                </p>
              ) : (
                <div className="mt-3 space-y-2.5">
                  <div>
                    <label
                      htmlFor="manual-checkout-time"
                      className="block text-xs font-medium text-slate-600"
                    >
                      تعديل وقت الانصراف يدويًا
                    </label>
                    <div className="mt-1.5">
                      <RtlTimeInput
                        id="manual-checkout-time"
                        value={checkOutTimeInput}
                        placeholder="لسه مسجلتش الانصراف"
                        onChange={(val) => handleCheckOutManualChange(checkOutDateInput, val)}
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="manual-checkout-date"
                      className="block text-xs font-medium text-slate-600"
                    >
                      تاريخ الانصراف (لو عدّيت نص الليل)
                    </label>
                    <div className="mt-1.5">
                      <RtlDateInput
                        id="manual-checkout-date"
                        min={selectedDate}
                        value={checkOutDateInput}
                        className="min-h-[44px]"
                        onChange={(val) => handleCheckOutManualChange(val, checkOutTimeInput)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Feedback Alerts */}
          {feedbackError && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-900"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 text-red-700 shrink-0" aria-hidden="true" />
                <div className="flex-1">
                  <p className="font-semibold">{feedbackError}</p>
                  {showQuickNextDayFix && (
                    <button
                      type="button"
                      onClick={handleUseNextDayForCheckout}
                      className="mt-2 min-h-[38px] rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-800 cursor-pointer"
                    >
                      خلي الانصراف في اليوم التالي (
                      <span className="tabular-time">
                        {formatEgyptianNumericDate(addDaysToDate(selectedDate, 1))}
                      </span>
                      )
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {feedbackSuccess && !feedbackError && (
            <div
              role="status"
              className="mt-4 flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs font-semibold text-teal-900"
            >
              <CheckCircle2 className="h-4 w-4 text-teal-700 shrink-0" aria-hidden="true" />
              <span>{feedbackSuccess}</span>
            </div>
          )}
        </section>

        {/* Live Day Summary Panel (5 cols on desktop) */}
        <aside
          aria-label="ملخص التسجيل"
          className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 lg:col-span-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h2 className="font-display text-lg font-bold text-slate-900">
              ملخص اليوم
            </h2>
            {currentEntry && (
              <span className="text-xs font-semibold text-slate-500">
                {currentEntry.checkOutTime ? 'تسجيل مكتمل' : 'في انتظار الانصراف'}
              </span>
            )}
          </div>

          {!currentEntry ? (
            <div className="py-8 text-center">
              <Clock className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                لسه مسجلتش حضور يوم {formatArabicDate(selectedDate)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                اختار الوردية واضغط &quot;تسجيل الحضور&quot; وهيتحسب كل حاجة تلقائي.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <dl className="divide-y divide-slate-100 text-sm">
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-500">التاريخ</dt>
                  <dd className="font-semibold text-slate-900">{formatArabicDate(currentEntry.workDate)}</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-500">الوردية</dt>
                  <dd className="font-semibold text-slate-900">{SHIFTS[currentEntry.shift].label}</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-500">وقت الحضور</dt>
                  <dd className="font-bold text-slate-900">
                    <span className="tabular-time">{currentEntry.checkInTime}</span>{' '}
                    <span className="text-xs font-normal text-slate-500">
                      ({formatTime12hEgyptian(currentEntry.checkInTime)})
                    </span>
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-500">وقت الانصراف</dt>
                  <dd className="font-bold text-slate-900">
                    {currentEntry.checkOutTime ? (
                      <>
                        <span className="tabular-time">{currentEntry.checkOutTime}</span>
                        {currentEntry.checkOutDate &&
                          currentEntry.checkOutDate !== currentEntry.workDate && (
                            <span className="mr-1.5 text-xs font-medium text-teal-700">
                              (تاني يوم{' '}
                              <span className="tabular-time">
                                {formatEgyptianNumericDate(currentEntry.checkOutDate)}
                              </span>
                              )
                            </span>
                          )}
                      </>
                    ) : (
                      <span className="text-amber-700">لسه مسجلتش الانصراف</span>
                    )}
                  </dd>
                </div>
              </dl>

              {/* Calculated Hours Summary */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <p className="text-xs font-semibold text-slate-600">إجمالي ساعات الشغل</p>
                  <p
                    data-testid="today-worked-hours"
                    className="tabular-time font-display mt-1 text-2xl font-extrabold text-slate-900"
                  >
                    {duration?.isComplete && duration.isValid ? duration.workedFormatted : '00:00'}
                  </p>
                </div>

                <div
                  className={`rounded-xl border p-3.5 ${
                    duration && duration.overtimeMinutes > 0
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {duration && duration.overtimeMinutes > 0 && (
                      <Flame className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
                    )}
                    <p
                      className={`text-xs font-semibold ${
                        duration && duration.overtimeMinutes > 0
                          ? 'text-amber-900'
                          : 'text-slate-600'
                      }`}
                    >
                      إجمالي الأوفر تايم
                    </p>
                  </div>
                  <p
                    data-testid="today-overtime-hours"
                    className={`tabular-time font-display mt-1 text-2xl font-extrabold ${
                      duration && duration.overtimeMinutes > 0
                        ? 'text-amber-800'
                        : 'text-slate-900'
                    }`}
                  >
                    {duration?.isComplete && duration.isValid ? duration.overtimeFormatted : '00:00'}
                  </p>
                </div>
              </div>

              {/* Quick actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={onOpenWorkLog}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline cursor-pointer"
                >
                  عرض كل أيام الشغل في السجل
                </button>

                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>مسح اليوم ده</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteEntry(currentEntry.id);
                        setConfirmDelete(false);
                      }}
                      className="min-h-[38px] rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 cursor-pointer"
                    >
                      تأكيد المسح
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="min-h-[38px] rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
