import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Download,
  FileCheck2,
  FolderSync,
  Moon,
  RefreshCw,
  Sun,
  Unlink,
  Upload,
} from 'lucide-react';
import { AppStorageData } from '../types/work';
import {
  calculateMonthlyFinancials,
  calculateMonthlySummary,
  DAY_OVERTIME_MULTIPLIER,
  formatEgpAmount,
  formatMonthLabel,
  formatTime12hEgyptian,
  getAvailableMonths,
  getLocalDateString,
  getLocalTimeString,
  NIGHT_OVERTIME_MULTIPLIER,
} from '../utils/workCalculations';
import { exportMonthlyExcel, exportMonthlyPdf, downloadJsonBackup } from '../utils/exportReports';
import { parseBackupJson } from '../utils/storage';
import { useModalBackHandler } from '../hooks/useNavigationHistory';
import { UseAutoBackupResult } from '../hooks/useAutoBackup';

interface ReportsBackupViewProps {
  appData: AppStorageData;
  currentMonthKey: string;
  autoBackup: UseAutoBackupResult;
  onUpdateMonthlyRate: (monthKey: string, rate: number | null) => void;
  onRestoreBackup: (incoming: AppStorageData, mode: 'merge' | 'replace') => void;
}

export const ReportsBackupView: React.FC<ReportsBackupViewProps> = ({
  appData,
  currentMonthKey,
  autoBackup,
  onUpdateMonthlyRate,
  onRestoreBackup,
}) => {
  const availableMonths = useMemo(
    () => getAvailableMonths(appData.entries, currentMonthKey),
    [appData.entries, currentMonthKey]
  );

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const savedMonthRate = appData.monthlyHourlyRates[selectedMonth];
  const [rateDraft, setRateDraft] = useState<string>(() =>
    typeof savedMonthRate === 'number' && savedMonthRate > 0 ? String(savedMonthRate) : ''
  );
  const [rateError, setRateError] = useState<string | null>(null);

  // Sync input field whenever user switches months or restores a backup
  useEffect(() => {
    setRateDraft(
      typeof savedMonthRate === 'number' && savedMonthRate > 0 ? String(savedMonthRate) : ''
    );
    setRateError(null);
  }, [selectedMonth, savedMonthRate]);

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

  useModalBackHandler('backup-restore-modal', Boolean(pendingBackup), () => {
    setPendingBackup(null);
  });

  const summary = useMemo(
    () => calculateMonthlySummary(appData.entries, selectedMonth),
    [appData.entries, selectedMonth]
  );

  const financials = useMemo(
    () => calculateMonthlyFinancials(summary, savedMonthRate),
    [summary, savedMonthRate]
  );

  const handleRateInputChange = (rawValue: string) => {
    // Allow digits and a single decimal separator (normalize Arabic/Persian digits if needed)
    const normalized = rawValue
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(',', '.');

    setRateDraft(normalized);

    if (normalized.trim() === '') {
      setRateError(null);
      onUpdateMonthlyRate(selectedMonth, null);
      return;
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setRateError('اكتب سعر ساعة صحيح أكبر من صفر (مثلاً: 50 أو 62.5).');
      return;
    }

    setRateError(null);
    onUpdateMonthlyRate(selectedMonth, parsed);
  };

  const handleExportExcel = () => {
    exportMonthlyExcel(appData.entries, selectedMonth, summary, financials);
    setExportStatus(`تم تحميل ملف Excel لشهر ${formatMonthLabel(selectedMonth)}`);
  };

  const handleExportPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      await exportMonthlyPdf(appData.entries, selectedMonth, summary, financials);
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

  const handleRestoreFromLinked = async () => {
    setBackupMessage(null);
    const parsed = await autoBackup.readLinkedBackup();
    if (!parsed.ok || !parsed.data) {
      setBackupMessage({
        type: 'error',
        text: parsed.error ?? 'تعذر قراءة ملف النسخة الاحتياطية المرتبط.',
      });
      return;
    }
    setPendingBackup({
      data: parsed.data,
      count: parsed.entryCount ?? parsed.data.entries.length,
    });
  };

  const formattedLastSync = useMemo(() => {
    if (!autoBackup.snapshot.lastSyncedAt) return null;
    const dt = new Date(autoBackup.snapshot.lastSyncedAt);
    if (Number.isNaN(dt.getTime())) return null;
    return formatTime12hEgyptian(getLocalTimeString(dt));
  }, [autoBackup.snapshot.lastSyncedAt]);

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
              ملخص ساعات الشغل والأوفر تايم النهاري والليلي وحساب المستحقات لشهر{' '}
              {formatMonthLabel(selectedMonth)}
            </p>
          </div>

          <div
            data-testid="reports-header-actions"
            className="flex flex-nowrap items-center gap-2 min-w-0"
          >
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setExportStatus(null);
              }}
              aria-label="اختر الشهر للتقرير"
              className="min-h-[40px] min-w-0 flex-1 sm:flex-none rounded-xl border border-slate-300 bg-white px-2.5 sm:px-3 text-xs sm:text-sm font-bold text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
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
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>تصدير Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isGeneratingPdf}
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{isGeneratingPdf ? 'جاري التجهيز...' : 'تصدير PDF'}</span>
            </button>
          </div>
        </div>

        {exportStatus && (
          <p role="status" className="mt-3 text-xs font-semibold text-teal-800">
            {exportStatus}
          </p>
        )}

        {/* Base Summary Metrics */}
        <div className="mt-5 grid grid-cols-2 gap-3">
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

          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
            <p className="text-xs font-medium text-amber-900">إجمالي الأوفر تايم</p>
            <p
              data-testid="report-total-overtime"
              className="tabular-time font-display mt-1 text-2xl font-extrabold text-amber-800"
            >
              {summary.totalOvertimeFormatted}
            </p>
          </div>
        </div>

        {/* New Day / Night Overtime Classification KPI Cards */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-orange-600 shrink-0" aria-hidden="true" />
                <p className="text-xs font-bold text-orange-950">إجمالي الساعات النهارية</p>
              </div>
              <span className="text-[11px] font-semibold text-orange-800">
                06:00 ص – 06:00 م (× {DAY_OVERTIME_MULTIPLIER})
              </span>
            </div>
            <p
              data-testid="report-day-overtime"
              className="tabular-time font-display mt-1.5 text-2xl font-extrabold text-orange-900"
            >
              {summary.totalDayOvertimeFormatted}
            </p>
          </div>

          <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-indigo-700 shrink-0" aria-hidden="true" />
                <p className="text-xs font-bold text-indigo-950">إجمالي الساعات الليلية</p>
              </div>
              <span className="text-[11px] font-semibold text-indigo-800">
                06:00 م – 06:00 ص (× {NIGHT_OVERTIME_MULTIPLIER.toFixed(2)})
              </span>
            </div>
            <p
              data-testid="report-night-overtime"
              className="tabular-time font-display mt-1.5 text-2xl font-extrabold text-indigo-900"
            >
              {summary.totalNightOvertimeFormatted}
            </p>
          </div>
        </div>

        {/* Per-Month Hourly Rate Input & Financial Overtime Summary */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-md">
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-teal-700 shrink-0" aria-hidden="true" />
                <h3 className="font-display text-base font-bold text-slate-900">
                  تسعير الأوفر تايم — {formatMonthLabel(selectedMonth)}
                </h3>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                كل شهر ليه سعر ساعة أساسي مستقل، وتعديله بيحسب مستحقات الشهر ده بس من غير ما يغير
                أي شهر تاني.
              </p>
            </div>

            <div className="w-full md:w-72">
              <label
                htmlFor="monthly-hourly-rate"
                className="block text-xs font-bold text-slate-800"
              >
                سعر الساعة الأساسي (جنيه مصري)
              </label>
              <div className="relative mt-1.5">
                <input
                  id="monthly-hourly-rate"
                  data-testid="monthly-hourly-rate-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={rateDraft}
                  onChange={(e) => handleRateInputChange(e.target.value)}
                  placeholder="مثلاً: 50 أو 62.5"
                  className="tabular-time min-h-[44px] w-full rounded-xl border border-slate-300 bg-white pr-3.5 pl-14 text-right text-sm font-bold text-slate-900 placeholder:text-right placeholder:font-normal placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                  ج.م
                </span>
              </div>
              {rateError && (
                <p role="alert" className="mt-1.5 text-xs font-semibold text-red-700">
                  {rateError}
                </p>
              )}
            </div>
          </div>

          {/* Financial Results or Unset Rate Notice */}
          {!financials.hasRate ? (
            <div
              data-testid="rate-unset-notice"
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-bold text-slate-900">
                  سعر الساعة مش متحدد لشهر {formatMonthLabel(selectedMonth)} لسه
                </p>
                <p className="mt-0.5 text-slate-600">
                  اكتب سعر الساعة الأساسي فوق عشان يتحسب تلقائيًا قيمة الساعات النهارية (×{' '}
                  {DAY_OVERTIME_MULTIPLIER}) والساعات الليلية (×{' '}
                  {NIGHT_OVERTIME_MULTIPLIER.toFixed(2)}) وإجمالي مستحقات الأوفر تايم.
                </p>
              </div>
            </div>
          ) : (
            <div
              data-testid="financial-summary-cards"
              className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
            >
              <div className="rounded-xl border border-orange-200 bg-white p-3.5">
                <p className="text-xs font-medium text-slate-600">
                  قيمة الأوفر تايم النهاري{' '}
                  <span className="text-[11px] text-orange-700 font-semibold">
                    ({formatEgpAmount(financials.dayHourlyRate)} ج.م/ساعة)
                  </span>
                </p>
                <p
                  data-testid="report-day-amount"
                  className="font-display mt-1 text-xl font-extrabold text-orange-900"
                >
                  <span className="tabular-time">{formatEgpAmount(financials.dayOvertimeAmount)}</span>{' '}
                  <span className="text-xs font-bold text-slate-600">ج.م</span>
                </p>
              </div>

              <div className="rounded-xl border border-indigo-200 bg-white p-3.5">
                <p className="text-xs font-medium text-slate-600">
                  قيمة الأوفر تايم الليلي{' '}
                  <span className="text-[11px] text-indigo-700 font-semibold">
                    ({formatEgpAmount(financials.nightHourlyRate)} ج.م/ساعة)
                  </span>
                </p>
                <p
                  data-testid="report-night-amount"
                  className="font-display mt-1 text-xl font-extrabold text-indigo-900"
                >
                  <span className="tabular-time">
                    {formatEgpAmount(financials.nightOvertimeAmount)}
                  </span>{' '}
                  <span className="text-xs font-bold text-slate-600">ج.م</span>
                </p>
              </div>

              <div className="rounded-xl border border-teal-300 bg-teal-50/70 p-3.5">
                <p className="text-xs font-bold text-teal-950">إجمالي مستحقات الأوفر تايم</p>
                <p
                  data-testid="report-total-amount"
                  className="font-display mt-1 text-2xl font-extrabold text-teal-900"
                >
                  <span className="tabular-time">
                    {formatEgpAmount(financials.totalOvertimeAmount)}
                  </span>{' '}
                  <span className="text-xs font-bold text-teal-800">ج.م</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Automatic Single-File Local Backup & Restore Section */}
      <section
        aria-label="النسخ الاحتياطي التلقائي في ملف واحد"
        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"
      >
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <FolderSync className="h-5 w-5 text-teal-700 shrink-0" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-slate-900">
              النسخة الاحتياطية التلقائية على الجهاز
            </h2>
          </div>
          <p className="text-xs text-slate-600">
            اربط ملف واحد على جهازك، وأي تسجيل أو تعديل أو مسح أو تغيير في سعر الساعة هيتحدّث جوه
            نفس الملف تلقائيًا من غير ما تنزّل ملفات جديدة كل مرة.
          </p>
        </div>

        {/* Auto-backup status & primary action */}
        <div className="mt-4">
          {autoBackup.snapshot.status === 'unsupported' ? (
            <div
              data-testid="auto-backup-unsupported"
              className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950"
            >
              <p className="font-bold">
                المتصفح ده مش بيدعم التعديل التلقائي المباشر على ملفات الجهاز
              </p>
              <p className="mt-1 text-amber-900">
                تقدر تحفظ نسخة احتياطية يدويًا من الزر تحت، أو تستخدم متصفح Chrome / Edge أو تثبّت
                التطبيق عشان التحديث التلقائي في ملف واحد يشتغل.
              </p>
            </div>
          ) : autoBackup.snapshot.status === 'blocked-iframe' ? (
            <div
              data-testid="auto-backup-blocked-iframe"
              className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950"
            >
              <p className="font-bold">الحفظ المباشر على الملفات مقفول جوه إطار المعاينة</p>
              <p className="mt-1 text-amber-900">
                {autoBackup.snapshot.errorMessage ||
                  'افتح التطبيق في صفحة مستقلة أو ثبّته على الجهاز لتفعيل الحفظ التلقائي في ملف واحد.'}
              </p>
            </div>
          ) : autoBackup.snapshot.status === 'unlinked' ? (
            <div
              data-testid="auto-backup-unlinked"
              className="flex flex-col gap-3 rounded-xl border border-dashed border-teal-300 bg-teal-50/40 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-bold text-slate-900">لسه مفيش ملف مربوط للحفظ التلقائي</p>
                <p className="mt-0.5 text-xs text-slate-600">
                  اختار مكان واسم ملف واحد على جهازك مرة واحدة، وكل التعديلات الجاية هتتكتب فوقه
                  تلقائيًا.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void autoBackup.linkFile();
                }}
                data-testid="link-auto-backup-btn"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FolderSync className="h-4 w-4" aria-hidden="true" />
                <span>تحديد ملف النسخ التلقائي</span>
              </button>
            </div>
          ) : autoBackup.snapshot.status === 'needs-permission' ? (
            <div
              data-testid="auto-backup-needs-permission"
              className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50/70 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-bold text-amber-950">
                  مطلوب ضغطة واحدة لتكملة الحفظ التلقائي على الملف
                </p>
                <p className="mt-0.5 text-xs text-amber-900">
                  الملف المرتبط:{' '}
                  <span className="tabular-time font-bold">{autoBackup.snapshot.fileName}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void autoBackup.reauthorize();
                  }}
                  data-testid="reauth-auto-backup-btn"
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>تفعيل الحفظ التلقائي</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void autoBackup.unlinkFile();
                  }}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>إلغاء الربط</span>
                </button>
              </div>
            </div>
          ) : (
            <div
              data-testid="auto-backup-active"
              className={`rounded-xl border p-4 ${
                autoBackup.snapshot.status === 'error'
                  ? 'border-red-200 bg-red-50/70'
                  : 'border-teal-200 bg-teal-50/60'
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2.5">
                  <FileCheck2
                    className={`mt-0.5 h-5 w-5 shrink-0 ${
                      autoBackup.snapshot.status === 'error' ? 'text-red-700' : 'text-teal-700'
                    }`}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {autoBackup.snapshot.status === 'syncing'
                        ? 'جاري تحديث ملف النسخة الاحتياطية...'
                        : autoBackup.snapshot.status === 'error'
                        ? 'حصلت مشكلة في تحديث الملف التلقائي'
                        : 'الحفظ التلقائي شغال على ملف واحد'}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-700">
                      اسم الملف:{' '}
                      <span
                        data-testid="auto-backup-filename"
                        className="tabular-time font-bold text-slate-900"
                      >
                        {autoBackup.snapshot.fileName}
                      </span>
                      {formattedLastSync && (
                        <>
                          {' · '}
                          <span>آخر تحديث الساعة {formattedLastSync}</span>
                        </>
                      )}
                    </p>
                    {autoBackup.snapshot.errorMessage && (
                      <p className="mt-1 text-xs font-semibold text-red-700">
                        {autoBackup.snapshot.errorMessage}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void autoBackup.syncNow();
                    }}
                    data-testid="sync-auto-backup-now-btn"
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-teal-300 bg-white px-3 py-1.5 text-xs font-bold text-teal-900 hover:bg-teal-50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>تحديث دلوقتي</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRestoreFromLinked}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>استعادة من الملف ده</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void autoBackup.linkFile();
                    }}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>تغيير الملف</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void autoBackup.unlinkFile();
                    }}
                    data-testid="unlink-auto-backup-btn"
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>إلغاء الربط</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Manual Download & File Restore Fallback */}
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            بياناتك كلها محفوظة على جهازك فقط. تقدر كمان تاخد نسخة يدوية أو تسترجع من أي ملف JSON.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="h-4 w-4 text-teal-700" aria-hidden="true" />
              <span>تنزيل نسخة يدوية</span>
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
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
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
