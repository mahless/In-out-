import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-4 z-40 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 shadow-sm lg:bottom-4"
    >
      <WifiOff className="h-4 w-4 text-amber-700 shrink-0" aria-hidden="true" />
      <span>شغال من غير إنترنت — بياناتك محفوظة على الجهاز</span>
    </div>
  );
};
