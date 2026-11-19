import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useModalBackHandler } from '../hooks/useNavigationHistory';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  useModalBackHandler('ios-install-guide', showGuide, () => {
    setShowGuide(false);
  });

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        <span>{compact ? 'تثبيت' : 'تثبيت التطبيق'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Smartphone className="h-4 w-4 text-teal-700" aria-hidden="true" />
          <span>{compact ? 'تثبيت' : 'تثبيت على الموبايل'}</span>
        </button>

        {showGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between gap-4">
                <h3 id="ios-install-title" className="text-lg font-bold text-slate-900">
                  تثبيت التطبيق على الآيفون
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="إغلاق"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ol className="mt-4 space-y-2.5 text-sm leading-relaxed text-slate-700">
                <li>1. اضغط على زر المشاركة (Share) من شريط سفاري تحت.</li>
                <li>2. انزل تحت واختار &quot;إضافة إلى الشاشة الرئيسية&quot; (Add to Home Screen).</li>
                <li>3. اضغط &quot;إضافة&quot; وهيشتغل معاك من غير إنترنت.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-6 w-full min-h-[44px] rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 cursor-pointer"
              >
                تمام، فهمت
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
