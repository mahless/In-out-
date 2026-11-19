import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Edit3,
  Eye,
  Flame,
  PlusCircle,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { ShiftId, WorkEntry } from '../types/work';
import {
  addDaysToDate,
  calculateEntryDuration,
  formatArabicDate,
  formatEgyptianNumericDate,
  formatMonthLabel,
  formatTime12hEgyptian,
  getAvailableMonths,
  getMonthKey,
  SHIFT_LIST,
  SHIFTS,
} from '../utils/workCalculations';
import { RtlDateInput, RtlTimeInput } from './RtlDateTimeInput';
import { useModalBackHandler } from '../hooks/useNavigationHistory';

interface WorkLogViewProps {
  entries: WorkEntry[];
  currentMonthKey: string;
  onUpdateEntry: (
    id: string,
    updates: Partial<Omit<WorkEntry, 'id' | 'createdAt'>>
  ) => { ok: boolean; error?: string };
  onDeleteEntry: (id: string) => void;
  onJumpToRegisterDate: (date: string) => void;
}

export const WorkLogView: React.FC<WorkLogViewProps> = ({
  entries,
  currentMonthKey,
  onUpdateEntry,
  onDeleteEntry,
  onJumpToRegisterDate,
}) => {
  const availableMonths = useMemo(
    () => getAvailableMonths(entries, currentMonthKey),
    [entries, currentMonthKey]
  );

  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [detailEntry, setDetailEntry] = useState<WorkEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<WorkEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<WorkEntry | null>(null);

  const isAnyModalOpen = Boolean(detailEntry || editingEntry || deletingEntry);
  useModalBackHandler('worklog-modal', isAnyModalOpen, () => {
    setDetailEntry(null);
    setEditingEntry(null);
    setDeletingEntry(null);
  });

  // Edit modal form state
  const [editDate, setEditDate] = useState('');
  const [editShift, setEditShift] = useState<ShiftId>('shift1');
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOutDate, setEditCheckOutDate] = useState('');
  const [editCheckOutTime, setEditCheckOutTime] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const openEditModal = (entry: WorkEntry) => {
    setEditingEntry(entry);
    setEditDate(entry.workDate);
    setEditShift(entry.shift);
    setEditCheckIn(entry.checkInTime);
    setEditCheckOutDate(entry.checkOutDate ?? entry.workDate);
    setEditCheckOutTime(entry.checkOutTime ?? '');
    setEditNotes(entry.notes ?? '');
    setEditError(null);
  };

  const editPreview = useMemo(() => {
    if (!editingEntry) return null;
    return calculateEntryDuration({
      workDate: editDate,
      shift: editShift,
      checkInTime: editCheckIn,
      checkOutDate: editCheckOutTime ? editCheckOutDate || editDate : null,
      checkOutTime: editCheckOutTime || null,
    });
  }, [editingEntry, editDate, editShift, editCheckIn, editCheckOutDate, editCheckOutTime]);

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    setEditError(null);

    const res = onUpdateEntry(editingEntry.id, {
      workDate: editDate,
      shift: editShift,
      checkInTime: editCheckIn,
      checkOutDate: editCheckOutTime ? editCheckOutDate || editDate : null,
      checkOutTime: editCheckOutTime || null,
      notes: editNotes.trim() || undefined,
    });

    if (!res.ok) {
      setEditError(res.error ?? 'تعذر حفظ التعديل.');
      return;
    }

    setEditingEntry(null);
  };

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((entry) => {
      if (selectedMonth !== 'all' && getMonthKey(entry.workDate) !== selectedMonth) {
        return false;
      }
      if (!q) return true;
      const arabicDate = formatArabicDate(entry.workDate).toLowerCase();
      const shiftLabel = SHIFTS[entry.shift].label.toLowerCase();
      const notes = (entry.notes ?? '').toLowerCase();
      return (
        entry.workDate.includes(q) ||
        arabicDate.includes(q) ||
        shiftLabel.includes(q) ||
        notes.includes(q)
      );
    });
  }, [entries, selectedMonth, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Filter & Search Bar */}
      <section
        aria-label="تصفية سجل الشغل"
        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">سجل الشغل</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              مرتب من الأحدث للأقدم · {filteredEntries.length} يوم مسجل
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative">
              <Search
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالتاريخ أو الوردية..."
                aria-label="بحث في سجل الشغل"
                className="min-h-[42px] w-full rounded-xl border border-slate-300 bg-white pr-9 pl-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 sm:w-56"
              />
            </div>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              aria-label="تصفية حسب الشهر"
              className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            >
              <option value="all">كل الشهور</option>
              {availableMonths.map((monthKey) => (
                <option key={monthKey} value={monthKey}>
                  {formatMonthLabel(monthKey)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Entries List */}
      {filteredEntries.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
          <Calendar className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
          <h3 className="mt-3 font-display text-base font-bold text-slate-900">
            مفيش أيام مسجلة في البحث ده
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            سجل يوم شغلك الأول من شاشة تسجيل اليوم وهتظهر كل التفاصيل هنا.
          </p>
          <button
            type="button"
            onClick={() => onJumpToRegisterDate(new Date().toISOString().slice(0, 10))}
            className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            <span>روح لتسجيل النهارده</span>
          </button>
        </section>
      ) : (
        <section aria-label="قائمة أيام الشغل" className="space-y-3" data-testid="work-log-list">
          {filteredEntries.map((entry) => {
            const calc = calculateEntryDuration(entry);
            const isIncomplete = !entry.checkOutTime;
            const hasOvertime = calc.isComplete && calc.overtimeMinutes > 0;

            return (
              <article
                key={entry.id}
                data-testid={`log-entry-${entry.workDate}`}
                className={`rounded-2xl border p-4 transition-colors sm:p-5 ${
                  isIncomplete
                    ? 'border-amber-300 bg-amber-50/50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  {/* Date & Shift Info */}
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base font-bold text-slate-900">
                        {formatArabicDate(entry.workDate)}
                      </h3>
                      <span className="text-xs text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-xs font-semibold text-teal-800">
                        {SHIFTS[entry.shift].label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                      <span>
                        الحضور:{' '}
                        <strong className="tabular-time text-slate-900">{entry.checkInTime}</strong>
                      </span>
                      <span className="text-slate-300" aria-hidden="true">
                        /
                      </span>
                      {entry.checkOutTime ? (
                        <span>
                          الانصراف:{' '}
                          <strong className="tabular-time text-slate-900">
                            {entry.checkOutTime}
                          </strong>
                          {entry.checkOutDate && entry.checkOutDate !== entry.workDate && (
                            <span className="mr-1 text-teal-700 font-medium">
                              (تاني يوم{' '}
                              <span className="tabular-time">
                                {formatEgyptianNumericDate(entry.checkOutDate)}
                              </span>
                              )
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-800">
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>لسه مسجلتش الانصراف</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Duration Metrics + Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-3 md:border-t-0 md:pt-0">
                    <div className="flex items-center gap-5">
                      <div>
                        <p className="text-[11px] text-slate-500">ساعات الشغل</p>
                        <p className="tabular-time font-display text-lg font-extrabold text-slate-900">
                          {calc.isComplete && calc.isValid ? calc.workedFormatted : '--:--'}
                        </p>
                      </div>

                      <div>
                        <p className="text-[11px] text-slate-500">الأوفر تايم</p>
                        <p
                          className={`tabular-time font-display inline-flex items-center gap-1 text-lg font-extrabold ${
                            hasOvertime ? 'text-amber-700' : 'text-slate-600'
                          }`}
                        >
                          {hasOvertime && <Flame className="h-4 w-4 text-amber-600" aria-hidden="true" />}
                          <span>
                            {calc.isComplete && calc.isValid ? calc.overtimeFormatted : '--:--'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDetailEntry(entry)}
                        aria-label={`عرض تفاصيل يوم ${entry.workDate}`}
                        className="inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(entry)}
                        aria-label={`تعديل يوم ${entry.workDate}`}
                        className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                      >
                        <Edit3 className="h-4 w-4 text-teal-700" aria-hidden="true" />
                        <span>تعديل</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingEntry(entry)}
                        aria-label={`حذف يوم ${entry.workDate}`}
                        className="inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl border border-red-200 bg-white px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Day Details Modal */}
      {detailEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
              <h3 id="detail-modal-title" className="font-display text-lg font-bold text-slate-900">
                تفاصيل يوم {formatArabicDate(detailEntry.workDate)}
              </h3>
              <button
                type="button"
                onClick={() => setDetailEntry(null)}
                aria-label="إغلاق التفاصيل"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {(() => {
              const calc = calculateEntryDuration(detailEntry);
              return (
                <dl className="mt-4 divide-y divide-slate-100 text-sm">
                  <div className="flex justify-between py-2.5">
                    <dt className="text-slate-500">التاريخ</dt>
                    <dd className="tabular-time font-semibold text-slate-900">
                      {formatEgyptianNumericDate(detailEntry.workDate)}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <dt className="text-slate-500">الوردية</dt>
                    <dd className="font-semibold text-slate-900">
                      {SHIFTS[detailEntry.shift].label}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <dt className="text-slate-500">الحضور</dt>
                    <dd className="font-bold text-slate-900">
                      <span className="tabular-time">{detailEntry.checkInTime}</span> (
                      {formatTime12hEgyptian(detailEntry.checkInTime)})
                    </dd>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <dt className="text-slate-500">الانصراف</dt>
                    <dd className="font-bold text-slate-900">
                      {detailEntry.checkOutTime ? (
                        <>
                          <span className="tabular-time">{detailEntry.checkOutTime}</span> (
                          <span className="tabular-time">
                            {formatEgyptianNumericDate(detailEntry.checkOutDate || detailEntry.workDate)}
                          </span>
                          )
                        </>
                      ) : (
                        <span className="text-amber-700">لسه مسجلتش الانصراف</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <dt className="text-slate-500">إجمالي ساعات الشغل</dt>
                    <dd className="tabular-time font-bold text-teal-800">
                      {calc.isComplete ? calc.workedFormatted : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <dt className="text-slate-500">الأوفر تايم</dt>
                    <dd className="tabular-time font-bold text-amber-700">
                      {calc.isComplete ? calc.overtimeFormatted : '—'}
                    </dd>
                  </div>
                  {calc.isComplete && calc.overtimeMinutes > 0 && (
                    <div className="flex justify-between py-2.5">
                      <dt className="text-slate-500">تصنيف الأوفر تايم</dt>
                      <dd className="font-semibold text-slate-800">
                        نهاري{' '}
                        <span className="tabular-time text-amber-800">
                          {calc.dayOvertimeFormatted}
                        </span>
                        {' · '}
                        ليلي{' '}
                        <span className="tabular-time text-indigo-800">
                          {calc.nightOvertimeFormatted}
                        </span>
                      </dd>
                    </div>
                  )}
                  {detailEntry.notes && (
                    <div className="py-2.5">
                      <dt className="text-slate-500">ملاحظات</dt>
                      <dd className="mt-1 text-slate-800">{detailEntry.notes}</dd>
                    </div>
                  )}
                </dl>
              );
            })()}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  const target = detailEntry;
                  setDetailEntry(null);
                  openEditModal(target);
                }}
                className="flex-1 min-h-[44px] rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 cursor-pointer"
              >
                تعديل اليوم
              </button>
              <button
                type="button"
                onClick={() => setDetailEntry(null)}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-modal-title"
        >
          <form
            onSubmit={handleSaveEdit}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
              <h3 id="edit-modal-title" className="font-display text-lg font-bold text-slate-900">
                تعديل تسجيل الشغل
              </h3>
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                aria-label="إغلاق التعديل"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="edit-work-date" className="block text-xs font-semibold text-slate-700">
                  التاريخ
                </label>
                <div className="mt-1.5">
                  <RtlDateInput
                    id="edit-work-date"
                    value={editDate}
                    onChange={setEditDate}
                    required
                    className="min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edit-shift" className="block text-xs font-semibold text-slate-700">
                  الوردية
                </label>
                <select
                  id="edit-shift"
                  value={editShift}
                  onChange={(e) => setEditShift(e.target.value as ShiftId)}
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 focus:border-teal-600 focus:outline-none"
                >
                  {SHIFT_LIST.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} ({s.timeRangeLabel})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-checkin" className="block text-xs font-semibold text-slate-700">
                    وقت الحضور
                  </label>
                  <div className="mt-1.5">
                    <RtlTimeInput
                      id="edit-checkin"
                      value={editCheckIn}
                      onChange={setEditCheckIn}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="edit-checkout-time" className="block text-xs font-semibold text-slate-700">
                    وقت الانصراف (سيبه فاضي لو لسه)
                  </label>
                  <div className="mt-1.5">
                    <RtlTimeInput
                      id="edit-checkout-time"
                      value={editCheckOutTime}
                      placeholder="لسه مسجلتش الانصراف"
                      onChange={setEditCheckOutTime}
                    />
                  </div>
                </div>
              </div>

              {editCheckOutTime && (
                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="edit-checkout-date"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      تاريخ الانصراف
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditCheckOutDate(addDaysToDate(editDate, 1))}
                      className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                    >
                      خليه تاني يوم (
                      <span className="tabular-time">
                        {formatEgyptianNumericDate(addDaysToDate(editDate, 1))}
                      </span>
                      )
                    </button>
                  </div>
                  <div className="mt-1.5">
                    <RtlDateInput
                      id="edit-checkout-date"
                      min={editDate}
                      value={editCheckOutDate}
                      onChange={setEditCheckOutDate}
                      className="min-h-[44px]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="edit-notes" className="block text-xs font-semibold text-slate-700">
                  ملاحظة (اختياري)
                </label>
                <input
                  id="edit-notes"
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="مثلاً: شغل إضافي جرد"
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>

              {/* Live preview inside edit modal */}
              {editPreview && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                  {!editPreview.isValid ? (
                    <p className="font-semibold text-red-700">{editPreview.errorMessage}</p>
                  ) : editPreview.isComplete ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">الحساب بعد التعديل:</span>
                        <span className="font-bold text-slate-900">
                          شغل <span className="tabular-time">{editPreview.workedFormatted}</span> · أوفر
                          تايم{' '}
                          <span className="tabular-time text-amber-700">
                            {editPreview.overtimeFormatted}
                          </span>
                        </span>
                      </div>
                      {editPreview.overtimeMinutes > 0 && (
                        <div className="flex items-center justify-end gap-3 text-[11px] font-medium text-slate-600">
                          <span>
                            نهاري{' '}
                            <span className="tabular-time font-bold text-amber-800">
                              {editPreview.dayOvertimeFormatted}
                            </span>
                          </span>
                          <span>
                            ليلي{' '}
                            <span className="tabular-time font-bold text-indigo-800">
                              {editPreview.nightOvertimeFormatted}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="font-medium text-amber-800">التسجيل ده هيفضل مفتوح بدون انصراف.</p>
                  )}
                </div>
              )}

              {editError && (
                <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
                  {editError}
                </p>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                className="flex-1 min-h-[44px] rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 cursor-pointer"
              >
                حفظ التعديل
              </button>
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 id="delete-modal-title" className="font-display text-lg font-bold text-slate-900">
              متأكد إنك عايز تمسح اليوم ده؟
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              هيتمسح تسجيل يوم <strong>{formatArabicDate(deletingEntry.workDate)}</strong> ومش هتقدر
              ترجعه تاني، والإجماليات هتتحدث فورًا.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  onDeleteEntry(deletingEntry.id);
                  setDeletingEntry(null);
                }}
                className="flex-1 min-h-[44px] rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 cursor-pointer"
              >
                أيوة، امسح
              </button>
              <button
                type="button"
                onClick={() => setDeletingEntry(null)}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
