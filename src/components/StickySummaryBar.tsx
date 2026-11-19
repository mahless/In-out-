import React from 'react';
import { Clock, Flame } from 'lucide-react';
import { MonthlySummary } from '../types/work';
import { formatMonthLabel } from '../utils/workCalculations';

interface StickySummaryBarProps {
  summary: MonthlySummary;
}

export const StickySummaryBar: React.FC<StickySummaryBarProps> = ({ summary }) => {
  const monthLabel = formatMonthLabel(summary.monthKey);

  return (
    <section
      aria-label="ملخص الشهر الحالي"
      className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md"
    >
      <div className="mx-auto max-w-6xl px-4 py-2 sm:px-6 sm:py-2.5">
        <div className="grid grid-cols-2 gap-3 sm:gap-4" data-testid="sticky-kpi-cards">
          {/* Card 1: Total Monthly Work Hours (hours stacked below text) */}
          <div className="flex flex-col items-start justify-center rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 sm:px-4 sm:py-2.5">
            <div className="flex w-full items-center gap-1.5 min-w-0">
              <Clock className="h-3.5 w-3.5 text-teal-700 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />
              <p className="text-[11px] font-semibold text-slate-700 sm:text-xs truncate">
                إجمالي ساعات الشغل
                <span className="hidden text-slate-500 font-normal sm:inline"> · {monthLabel}</span>
              </p>
            </div>
            <p
              data-testid="kpi-total-worked"
              className="tabular-time font-display mt-0.5 text-xl font-extrabold leading-tight tracking-tight text-slate-900 sm:mt-1 sm:text-2xl"
            >
              {summary.totalWorkedFormatted}
            </p>
          </div>

          {/* Card 2: Total Monthly Overtime (hours stacked below text) */}
          <div className="flex flex-col items-start justify-center rounded-xl border border-amber-200/90 bg-amber-50/80 px-3 py-2 sm:px-4 sm:py-2.5">
            <div className="flex w-full items-center gap-1.5 min-w-0">
              <Flame className="h-3.5 w-3.5 text-amber-700 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />
              <p className="text-[11px] font-semibold text-amber-900 sm:text-xs truncate">
                إجمالي الأوفر تايم
                <span className="hidden text-amber-800/80 font-normal sm:inline">
                  {' '}
                  · خارج الوردية
                </span>
              </p>
            </div>
            <p
              data-testid="kpi-total-overtime"
              className="tabular-time font-display mt-0.5 text-xl font-extrabold leading-tight tracking-tight text-amber-800 sm:mt-1 sm:text-2xl"
            >
              {summary.totalOvertimeFormatted}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
