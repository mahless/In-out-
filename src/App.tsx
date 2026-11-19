import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Clock, ListChecks } from 'lucide-react';
import { AppStorageData, ShiftId, WorkEntry } from './types/work';
import {
  calculateMonthlySummary,
  createWorkEntry,
  deleteWorkEntry,
  getCurrentMonthKey,
  getLocalDateString,
  updateWorkEntry,
} from './utils/workCalculations';
import { loadAppData, mergeBackupData, saveAppData } from './utils/storage';
import { StickySummaryBar } from './components/StickySummaryBar';
import { TodayRegistration } from './components/TodayRegistration';
import { WorkLogView } from './components/WorkLogView';
import { ReportsBackupView } from './components/ReportsBackupView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineBanner } from './components/OfflineBanner';
import { NavigationProvider, useAppNavigation } from './hooks/useNavigationHistory';

function AppShell() {
  const [appData, setAppData] = useState<AppStorageData>(() => loadAppData());
  const { activeTab, navigateToTab } = useAppNavigation();
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateString());

  // Automatically track current calendar month so transitioning to a new month updates totals naturally
  const [currentMonthKey, setCurrentMonthKey] = useState<string>(() => getCurrentMonthKey());

  useEffect(() => {
    const interval = window.setInterval(() => {
      const nextMonth = getCurrentMonthKey();
      setCurrentMonthKey((prev) => (prev === nextMonth ? prev : nextMonth));
    }, 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    saveAppData(appData);
  }, [appData]);

  const currentMonthSummary = useMemo(
    () => calculateMonthlySummary(appData.entries, currentMonthKey),
    [appData.entries, currentMonthKey]
  );

  const handleSelectShift = (shift: ShiftId) => {
    setAppData((prev) => ({
      ...prev,
      selectedShift: shift,
    }));
  };

  const handleCheckIn = (workDate: string, shift: ShiftId, time: string) => {
    const res = createWorkEntry(appData.entries, {
      workDate,
      shift,
      checkInTime: time,
      checkOutDate: null,
      checkOutTime: null,
    });
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    setAppData((prev) => ({
      ...prev,
      selectedShift: shift,
      entries: res.entries,
    }));
    return { ok: true };
  };

  const handleUpdateEntry = (
    id: string,
    updates: Partial<Omit<WorkEntry, 'id' | 'createdAt'>>
  ) => {
    const res = updateWorkEntry(appData.entries, id, updates);
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    setAppData((prev) => ({
      ...prev,
      entries: res.entries,
    }));
    return { ok: true };
  };

  const handleDeleteEntry = (id: string) => {
    setAppData((prev) => ({
      ...prev,
      entries: deleteWorkEntry(prev.entries, id),
    }));
  };

  const handleRestoreBackup = (incoming: AppStorageData, mode: 'merge' | 'replace') => {
    setAppData((prev) => mergeBackupData(prev, incoming, mode));
  };

  const handleJumpToRegisterDate = (date: string) => {
    setSelectedDate(date);
    navigateToTab('today');
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16 text-slate-900 md:pb-10">
      {/* Top Bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3 sm:px-6">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigateToTab('today')}
            className="font-display text-xl font-extrabold tracking-tight text-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            دفتر الشغل
          </button>

          {/* Zone 2: Desktop Single-Line Navigation Links */}
          <nav
            aria-label="التنقل الرئيسي"
            className="hidden items-center gap-6 text-sm font-semibold md:flex"
          >
            <button
              type="button"
              onClick={() => navigateToTab('today')}
              className={`border-b-2 py-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'today'
                  ? 'border-teal-700 text-teal-800'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              تسجيل اليوم
            </button>
            <button
              type="button"
              onClick={() => navigateToTab('log')}
              className={`border-b-2 py-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'log'
                  ? 'border-teal-700 text-teal-800'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              سجل الشغل
            </button>
            <button
              type="button"
              onClick={() => navigateToTab('reports')}
              className={`border-b-2 py-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'reports'
                  ? 'border-teal-700 text-teal-800'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              التقارير والنسخ الاحتياطي
            </button>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => navigateToTab('reports')}
              className="hidden min-h-[40px] items-center rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer md:inline-flex"
            >
              النسخ الاحتياطي
            </button>
          </div>
        </div>
      </header>

      {/* Permanent Sticky 2 KPI Cards at Top */}
      <StickySummaryBar summary={currentMonthSummary} />

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
        {activeTab === 'today' && (
          <TodayRegistration
            entries={appData.entries}
            selectedShift={appData.selectedShift}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onSelectShift={handleSelectShift}
            onCheckIn={handleCheckIn}
            onUpdateEntry={handleUpdateEntry}
            onDeleteEntry={handleDeleteEntry}
            onOpenWorkLog={() => navigateToTab('log')}
          />
        )}

        {activeTab === 'log' && (
          <WorkLogView
            entries={appData.entries}
            currentMonthKey={currentMonthKey}
            onUpdateEntry={handleUpdateEntry}
            onDeleteEntry={handleDeleteEntry}
            onJumpToRegisterDate={handleJumpToRegisterDate}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsBackupView
            appData={appData}
            currentMonthKey={currentMonthKey}
            onRestoreBackup={handleRestoreBackup}
          />
        )}
      </main>

      {/* Mobile Bottom Thumb-Zone Navigation */}
      <nav
        aria-label="شريط التنقل السفلي"
        className="fixed bottom-0 left-0 right-0 z-30 grid h-[54px] grid-cols-3 border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden"
      >
        <button
          type="button"
          onClick={() => navigateToTab('today')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold cursor-pointer ${
            activeTab === 'today' ? 'text-teal-700' : 'text-slate-500'
          }`}
        >
          <Clock className="h-5 w-5" aria-hidden="true" />
          <span>تسجيل اليوم</span>
        </button>

        <button
          type="button"
          onClick={() => navigateToTab('log')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold cursor-pointer ${
            activeTab === 'log' ? 'text-teal-700' : 'text-slate-500'
          }`}
        >
          <ListChecks className="h-5 w-5" aria-hidden="true" />
          <span>سجل الشغل</span>
        </button>

        <button
          type="button"
          onClick={() => navigateToTab('reports')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold cursor-pointer ${
            activeTab === 'reports' ? 'text-teal-700' : 'text-slate-500'
          }`}
        >
          <BarChart3 className="h-5 w-5" aria-hidden="true" />
          <span>التقارير</span>
        </button>
      </nav>

      <OfflineBanner />
    </div>
  );
}

export default function App() {
  return (
    <NavigationProvider>
      <AppShell />
    </NavigationProvider>
  );
}
