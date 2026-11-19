import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { AppStorageData, MonthlySummary, WorkEntry } from '../types/work';
import {
  calculateEntryDuration,
  formatArabicDate,
  formatMonthLabel,
  getMonthKey,
  SHIFTS,
} from './workCalculations';
import { createBackupPayload } from './storage';

export function downloadJsonBackup(data: AppStorageData, todayStr: string): void {
  const payload = createBackupPayload(data);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `daftar-elshoghl-backup-${todayStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportMonthlyExcel(
  entries: WorkEntry[],
  monthKey: string,
  summary: MonthlySummary
): void {
  const monthEntries = entries
    .filter((e) => getMonthKey(e.workDate) === monthKey)
    .sort((a, b) => a.workDate.localeCompare(b.workDate));

  const rows: (string | number)[][] = [
    [`تقرير ساعات الشغل والأوفر تايم — ${formatMonthLabel(monthKey)}`],
    [],
    ['إجمالي ساعات الشغل', summary.totalWorkedFormatted, 'إجمالي الأوفر تايم', summary.totalOvertimeFormatted],
    ['أيام الشغل المكتملة', summary.completedDaysCount, 'متوسط الساعات اليومي', summary.averageDailyFormatted],
    [],
    [
      'التاريخ',
      'اليوم',
      'الوردية',
      'وقت الحضور',
      'تاريخ الانصراف',
      'وقت الانصراف',
      'ساعات الشغل',
      'الأوفر تايم',
      'الحالة',
    ],
  ];

  for (const entry of monthEntries) {
    const calc = calculateEntryDuration(entry);
    const fullDateLabel = formatArabicDate(entry.workDate);
    const dayName = fullDateLabel.split(' ')[0] || '';
    rows.push([
      entry.workDate,
      dayName,
      SHIFTS[entry.shift].label,
      entry.checkInTime,
      entry.checkOutDate ?? '—',
      entry.checkOutTime ?? '—',
      calc.isComplete && calc.isValid ? calc.workedFormatted : '—',
      calc.isComplete && calc.isValid ? calc.overtimeFormatted : '—',
      calc.isComplete ? 'مكتمل' : 'لسه مسجلتش الانصراف',
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!views'] = [{ rightToLeft: true }];
  ws['!cols'] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 18 },
    { wch: 13 },
    { wch: 14 },
    { wch: 13 },
    { wch: 13 },
    { wch: 13 },
    { wch: 22 },
  ];

  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, `تقرير ${monthKey}`);
  XLSX.writeFile(wb, `work-report-${monthKey}.xlsx`);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Generates an Arabic RTL PDF report using native browser Canvas text shaping
 * (guaranteed connected Arabic letters and crisp tabular numbers) packaged via jsPDF.
 */
export async function exportMonthlyPdf(
  entries: WorkEntry[],
  monthKey: string,
  summary: MonthlySummary
): Promise<void> {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const monthEntries = entries
    .filter((e) => getMonthKey(e.workDate) === monthKey)
    .sort((a, b) => a.workDate.localeCompare(b.workDate));

  const pageWidth = 1240;
  const pageHeight = 1754; // A4 ratio at 150 DPI
  const marginX = 64;
  const contentWidth = pageWidth - marginX * 2;
  const rowHeight = 52;
  const firstPageRows = 20;
  const nextPageRows = 26;

  // Split entries into pages
  const pages: WorkEntry[][] = [];
  if (monthEntries.length === 0) {
    pages.push([]);
  } else {
    pages.push(monthEntries.slice(0, firstPageRows));
    let offset = firstPageRows;
    while (offset < monthEntries.length) {
      pages.push(monthEntries.slice(offset, offset + nextPageRows));
      offset += nextPageRows;
    }
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pdfWidth = doc.internal.pageSize.getWidth();
  const pdfHeight = doc.internal.pageSize.getHeight();

  pages.forEach((pageRows, pageIndex) => {
    const canvas = document.createElement('canvas');
    canvas.width = pageWidth;
    canvas.height = pageHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, pageWidth, pageHeight);
    ctx.direction = 'rtl';
    ctx.textBaseline = 'middle';

    let cursorY = 64;

    // Header
    ctx.fillStyle = '#0F766E';
    drawRoundedRect(ctx, marginX, cursorY, contentWidth, 96, 16);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'right';
    ctx.font = '700 32px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(`تقرير ساعات الشغل — ${formatMonthLabel(monthKey)}`, pageWidth - marginX - 28, cursorY + 38);

    ctx.fillStyle = '#CCFBF1';
    ctx.font = '500 18px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    ctx.fillText('دفتر الشغل الشخصي', pageWidth - marginX - 28, cursorY + 72);

    ctx.textAlign = 'left';
    ctx.font = '500 18px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(`صفحة ${pageIndex + 1} من ${pages.length}`, marginX + 28, cursorY + 48);

    cursorY += 124;

    // Summary boxes only on page 1
    if (pageIndex === 0) {
      const cardGap = 16;
      const cardW = (contentWidth - cardGap * 3) / 4;
      const cards = [
        { label: 'إجمالي ساعات الشغل', value: summary.totalWorkedFormatted, accent: '#0F766E', bg: '#F0FDFA', border: '#99F6E4' },
        { label: 'إجمالي الأوفر تايم', value: summary.totalOvertimeFormatted, accent: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
        { label: 'أيام الشغل المكتملة', value: String(summary.completedDaysCount), accent: '#0F172A', bg: '#F8FAFC', border: '#E2E8F0' },
        { label: 'المتوسط اليومي', value: summary.averageDailyFormatted, accent: '#0F172A', bg: '#F8FAFC', border: '#E2E8F0' },
      ];

      cards.forEach((card, idx) => {
        const x = pageWidth - marginX - (idx + 1) * cardW - idx * cardGap;
        ctx.fillStyle = card.bg;
        drawRoundedRect(ctx, x, cursorY, cardW, 96, 12);
        ctx.fill();
        ctx.strokeStyle = card.border;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.textAlign = 'right';
        ctx.fillStyle = '#475569';
        ctx.font = '600 16px "IBM Plex Sans Arabic", sans-serif';
        ctx.fillText(card.label, x + cardW - 18, cursorY + 30);

        ctx.fillStyle = card.accent;
        ctx.font = '700 30px "Cairo", sans-serif';
        ctx.fillText(card.value, x + cardW - 18, cursorY + 66);
      });

      cursorY += 124;
    }

    // Table columns (Right to Left)
    const cols = [
      { title: 'التاريخ', width: 200 },
      { title: 'الوردية', width: 170 },
      { title: 'الحضور', width: 130 },
      { title: 'الانصراف', width: 200 },
      { title: 'ساعات الشغل', width: 150 },
      { title: 'الأوفر تايم', width: 150 },
      { title: 'الحالة', width: contentWidth - 1000 },
    ];

    // Table Header
    ctx.fillStyle = '#F1F5F9';
    drawRoundedRect(ctx, marginX, cursorY, contentWidth, 48, 8);
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.font = '700 17px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    let colRight = pageWidth - marginX;
    cols.forEach((col) => {
      ctx.textAlign = 'right';
      ctx.fillText(col.title, colRight - 14, cursorY + 24);
      colRight -= col.width;
    });

    cursorY += 54;

    if (pageRows.length === 0) {
      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'center';
      ctx.font = '500 22px "IBM Plex Sans Arabic", sans-serif';
      ctx.fillText('لا توجد أيام مسجلة في هذا الشهر.', pageWidth / 2, cursorY + 80);
    } else {
      pageRows.forEach((entry, rIdx) => {
        const calc = calculateEntryDuration(entry);
        if (rIdx % 2 === 1) {
          ctx.fillStyle = '#F8FAFC';
          ctx.fillRect(marginX, cursorY, contentWidth, rowHeight);
        }

        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(marginX, cursorY + rowHeight);
        ctx.lineTo(marginX + contentWidth, cursorY + rowHeight);
        ctx.stroke();

        const checkOutLabel = entry.checkOutTime
          ? entry.checkOutDate && entry.checkOutDate !== entry.workDate
            ? `${entry.checkOutTime} (${entry.checkOutDate.slice(5)})`
            : entry.checkOutTime
          : '—';

        const values = [
          entry.workDate,
          SHIFTS[entry.shift].label,
          entry.checkInTime,
          checkOutLabel,
          calc.isComplete && calc.isValid ? calc.workedFormatted : '—',
          calc.isComplete && calc.isValid ? calc.overtimeFormatted : '—',
          calc.isComplete ? 'مكتمل' : 'ناقص انصراف',
        ];

        let cellRight = pageWidth - marginX;
        cols.forEach((col, cIdx) => {
          ctx.textAlign = 'right';
          if (cIdx === 5 && calc.overtimeMinutes > 0) {
            ctx.fillStyle = '#B45309';
            ctx.font = '700 18px "Cairo", sans-serif';
          } else if (cIdx === 6 && !calc.isComplete) {
            ctx.fillStyle = '#C2410C';
            ctx.font = '600 16px "IBM Plex Sans Arabic", sans-serif';
          } else {
            ctx.fillStyle = '#0F172A';
            ctx.font = '500 17px "IBM Plex Sans Arabic", sans-serif';
          }
          ctx.fillText(values[cIdx], cellRight - 14, cursorY + rowHeight / 2);
          cellRight -= col.width;
        });

        cursorY += rowHeight;
      });
    }

    // Footer
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'center';
    ctx.font = '400 14px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(
      'تم استخراج التقرير محليًا من تطبيق دفتر الشغل — الحساب بالدقائق الفعلية',
      pageWidth / 2,
      pageHeight - 40
    );

    if (pageIndex > 0) {
      doc.addPage();
    }
    const imgData = canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  });

  doc.save(`work-report-${monthKey}.pdf`);
}
