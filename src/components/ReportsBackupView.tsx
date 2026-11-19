import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Upload,
} from 'lucide-react';
import { AppStorageData, WorkEntry } from '../types/work';
import {
  calculateEntryDuration,
  calculateMonthlySummary,
  formatArabicShortDate,
  formatEgyptianNumericDate,
  formatMonthLabel,
  getAvailableMonths,
  getLocalDateString,
  getMonthKey,
  SHIFTS,
} from '../utils/workCalculations';
import { exportMonthlyExcel, exportMonthlyPdf, downloadJsonBackup } from '../utils/exportReports';
import { parseBackupJson } from '../utils/storage';

interface ReportsBackupViewProps {
  appData: AppStorageData;
  currentMonthKey: string;
  onRestoreBackup: (incoming: AppStorageData, mode: 'merge' | 'replace') => void;
}

export const ReportsBackupView: React.FC<ReportsBackupViewProps> = ({
  appData,
  currentMonthKey,
  onRestoreBackup,
}) => {
  const availableMonths = useMemo(
    () => getAvailableMonths(appData.entries, currentMonthKey),
    [appData.entries, currentMonthKey]
  );

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Backup restore state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingBackup, setPendingBackup] = useState<{
    data: AppStorageData;
    count: number;
  } | null>(null);
  const [backupMessage, setBackupMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const summary = useMemo(
    () => calculateMonthlySummary(appData.entries, selectedMonth),
    [appData.entries, selectedMonth]
  );

  const monthEntries = useMemo(
    () =>
      appData.entries
        .filter((e) => getMonthKey(e.workDate) === selectedMonth)
        .sort((a, b) => a.workDate.localeCompare(b.workDate)),
    [appData.entries, selectedMonth]
  );

  const handleExportExcel = () => {
    exportMonthlyExcel(appData.entries, selectedMonth, summary);
    setExportStatus(`تم تحميل ملف Excel لشهر ${formatMonthLabel(selectedMonth)}`);
  };

  const handleExportPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      await exportMonthlyPdf(appData.entries, selectedMonth, summary);
      setExportStatus(`تم تحميل ملف PDF لشهر ${formatMonthLabel(selectedMonth)}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleExportJson = () => {
    downloadJsonBackup(appData, getLocalDateString());
    setBackupMessage({
      type: 'success',
      text: 'تم حفظ ملف النسخة الاحتياطية على جهازك بنجاح.',
    });
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBackupMessage(null);
    const text = await file.text();
    const parsed = parseBackupJson(text);
    if (!parsed.ok || !parsed.data) {
      setBackupMessage({
        type: 'error',
        text: parsed.error ?? 'ملف النسخة الاحتياطية مش صالح.',
      });
      return;
    }

    setPendingBackup({
      data: parsed.data,
      count: parsed.entryCount ?? parsed.data.entries.length,
    });
  };

  const confirmRestore = (mode: 'merge' | 'replace') => {
    if (!pendingBackup) return;
    onRestoreBackup(pendingBackup.data, mode);
    setPendingBackup(null);
    setBackupMessage({
      type: 'success',
      text:
        mode === 'merge'
          ? 'تم دمج الأيام الجديدة من النسخة الاحتياطية بنجاح.'
          : 'تم استرجاع النسخة الاحتياطية بالكامل بنجاح.',
    });
  };

  return (
    <div className="space-y-6">
      {/* Monthly Report Card */}
      <section
        aria-label="التقرير الشهري"
        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"
      >
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 sm:text-xl">
              التقارير الشهرية
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              نفس الحسابات الدقيقة بتاعة الشاشة الرئيسية لأي شهر تختاره
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setExportStatus(null);
              }}
              aria-label="اختر الشهر للتقرير"
              className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <span>تصدير Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isGeneratingPdf}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              <span>{isGeneratingPdf ? 'جاري التجهيز...' : 'تصدير PDF'}</span>
            </button>
          </div>
        </div>

        {exportStatus && (
          <p role="status" className="mt-3 text-xs font-semibold text-teal-800">
            {exportStatus}
          </p>
        )}

        {/* 4 Summary Metrics */}
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <p className="text-xs font-medium text-slate-600">إجمالي ساعات الشغل</p>
            <p
              data-testid="report-total-worked"
              className="tabular-time font-display mt-1 text-2xl font-extrabold text-slate-900"
            >
              {summary.totalWorkedFormatted}
            </p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
            <p className="text-xs font-medium text-amber-900">إجمالي الأوفر تايم</p>
            <p
              data-testid="report-total-overtime"
              className="tabular-time font-display mt-1 text-2xl font-extrabold text-amber-800"
            >
              {summary.totalOvertimeFormatted}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <p className="text-xs font-medium text-slate-600">أيام الشغل المسجلة</p>
            <p
              data-testid="report-days-count"
              className="tabular-time font-display mt-1 text-2xl font-extrabold text-slate-900"
            >
              {summary.completedDaysCount}
            </p>
            {summary.incompleteDaysCount > 0 && (
              <p className="mt-0.5 text-[11px] text-amber-800">
                + {summary.incompleteDaysCount} يوم ناقص انصراف
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <p className="text-xs font-medium text-slate-600">متوسط الساعات اليومي</p>
            <p
              data-testid="report-avg-daily"
              className="tabular-time font-display mt-1 text-2xl font-extrabold text-slate-900"
            >
              {summary.averageDailyFormatted}
            </p>
          </div>
        </div>

        {/* Mobile Card Breakdown (< sm) */}
        <div className="mt-5 space-y-2.5 sm:hidden">
          {monthEntries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
              مفيش أيام مسجلة في شهر {formatMonthLabel(selectedMonth)}.
            </div>
          ) : (
            monthEntries.map((entry: WorkEntry) => {
              const calc = calculateEntryDuration(entry);
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">
                      {formatArabicShortDate(entry.workDate)} · {SHIFTS[entry.shift].shortLabel}
                    </p>
                    <p className="mt-1 text-slate-600">
                      <span className="tabular-time font-semibold">{entry.checkInTime}</span>
                      {' — '}
                      {entry.checkOutTime ? (
                        <>
                          <span className="tabular-time font-semibold">{entry.checkOutTime}</span>
                          {entry.checkOutDate && entry.checkOutDate !== entry.workDate && (
                            <span className="mr-1 text-teal-700 font-medium">(تاني يوم)</span>
                          )}
                        </>
                      ) : (
                        <span className="font-semibold text-amber-700">ناقص انصراف</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-left">
                    <div>
                      <span className="block text-[10px] text-slate-500">شغل</span>
                      <span className="tabular-time font-bold text-slate-900">
                        {calc.isComplete && calc.isValid ? calc.workedFormatted : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500">أوفر تايم</span>
                      <span
                        className={`tabular-time font-bold ${
                          calc.overtimeMinutes > 0 ? 'text-amber-700' : 'text-slate-500'
                        }`}
                      >
                        {calc.isComplete && calc.isValid ? calc.overtimeFormatted : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table Breakdown (>= sm) */}
        <div className="mt-6 hidden overflow-x-auto sm:block">
          {monthEntries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
              مفيش أيام مسجلة في شهر {formatMonthLabel(selectedMonth)}.
            </div>
          ) : (
            <table className="w-full border-collapse text-right text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600">
                  <th className="px-3 py-2.5">التاريخ</th>
                  <th className="px-3 py-2.5">الوردية</th>
                  <th className="px-3 py-2.5">الحضور</th>
                  <th className="px-3 py-2.5">الانصراف</th>
                  <th className="px-3 py-2.5">ساعات الشغل</th>
                  <th className="px-3 py-2.5">الأوفر تايم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthEntries.map((entry: WorkEntry) => {
                  const calc = calculateEntryDuration(entry);
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2.5 font-semibold text-slate-900">
                        {formatArabicShortDate(entry.workDate)}{' '}
                        <span className="tabular-time text-xs font-normal text-slate-400">
                          ({formatEgyptianNumericDate(entry.workDate)})
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{SHIFTS[entry.shift].shortLabel}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900">
                        <span className="tabular-time">{entry.checkInTime}</span>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900">
                        {entry.checkOutTime ? (
                          <>
                            <span className="tabular-time">{entry.checkOutTime}</span>
                            {entry.checkOutDate && entry.checkOutDate !== entry.workDate && (
                              <span className="mr-1.5 text-[11px] font-medium text-teal-700">
                                (تاني يوم)
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs font-semibold text-amber-700">ناقص انصراف</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-slate-900">
                        <span className="tabular-time">
                          {calc.isComplete && calc.isValid ? calc.workedFormatted : '—'}
                        </span>
                      </td>
                      <td
                        className={`px-3 py-2.5 font-bold ${
                          calc.overtimeMinutes > 0 ? 'text-amber-700' : 'text-slate-500'
                        }`}
                      >
                        <span className="tabular-time">
                          {calc.isComplete && calc.isValid ? calc.overtimeFormatted : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Local Backup & Restore Section */}
      <section
        aria-label="النسخ الاحتياطي واسترجاع البيانات"
        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              النسخة الاحتياطية ونقل البيانات
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              بياناتك كلها محفوظة على جهازك فقط. احتفظ بنسخة احتياطية JSON قبل تغيير الجهاز أو مسح
              المتصفح.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="h-4 w-4 text-teal-700" aria-hidden="true" />
              <span>حفظ نسخة احتياطية</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelected}
              className="hidden"
              aria-label="اختيار ملف نسخة احتياطية"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              <span>استعادة من ملف</span>
            </button>
          </div>
        </div>

        {backupMessage && (
          <div
            role={backupMessage.type === 'error' ? 'alert' : 'status'}
            className={`mt-4 flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold ${
              backupMessage.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-teal-200 bg-teal-50 text-teal-900'
            }`}
          >
            {backupMessage.type === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>{backupMessage.text}</span>
          </div>
        )}
      </section>

      {/* Restore Confirmation Modal */}
      {pendingBackup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="restore-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 id="restore-modal-title" className="font-display text-lg font-bold text-slate-900">
              تأكيد استعادة النسخة الاحتياطية
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              لقينا <strong>{pendingBackup.count}</strong> يوم شغل جوه الملف ده. تختار نعمل إيه؟
            </p>
            <div className="mt-5 space-y-2.5">
              <button
                type="button"
                onClick={() => confirmRestore('merge')}
                className="w-full min-h-[46px] rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 cursor-pointer"
              >
                دمج (إضافة الأيام اللي مش موجودة بس)
              </button>
              <button
                type="button"
                onClick={() => confirmRestore('replace')}
                className="w-full min-h-[46px] rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-900 hover:bg-amber-100 cursor-pointer"
              >
                استبدال كل السجلات الحالية بالنسخة دي
              </button>
              <button
                type="button"
                onClick={() => setPendingBackup(null)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
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
