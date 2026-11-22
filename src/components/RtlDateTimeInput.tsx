import React, { useRef } from 'react';
import { Calendar, Clock } from 'lucide-react';
import {
  formatEgyptianNumericDate,
  formatTime12hEgyptian,
} from '../utils/workCalculations';

interface RtlDateInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  required?: boolean;
  className?: string;
}

export const RtlDateInput: React.FC<RtlDateInputProps> = ({
  id,
  value,
  onChange,
  min,
  required,
  className = 'min-h-[46px]',
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = () => {
    try {
      inputRef.current?.showPicker?.();
    } catch {
      // Fallback: native input click handles focus/picker on browsers without showPicker
    }
  };

  return (
    <div
      className={`relative flex w-full min-w-0 items-center justify-between gap-1.5 rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-900 transition-colors focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/20 sm:gap-2 sm:px-3.5 sm:text-sm ${className}`}
    >
      <span className="tabular-time min-w-0 truncate text-slate-900">
        {value ? formatEgyptianNumericDate(value) : 'اختر التاريخ'}
      </span>
      <Calendar className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
      <input
        ref={inputRef}
        id={id}
        type="date"
        value={value}
        min={min}
        required={required}
        onClick={openPicker}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
};

interface RtlTimeInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export const RtlTimeInput: React.FC<RtlTimeInputProps> = ({
  id,
  value,
  onChange,
  placeholder = 'اختر الوقت',
  required,
  className = 'min-h-[44px]',
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = () => {
    try {
      inputRef.current?.showPicker?.();
    } catch {
      // Fallback handled by native input
    }
  };

  return (
    <div
      className={`relative flex w-full min-w-0 items-center justify-between gap-1.5 rounded-xl border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 transition-colors focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/20 sm:gap-2 sm:px-3 sm:text-sm ${className}`}
    >
      {value ? (
        <span className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-slate-900">
          <span className="tabular-time">{value}</span>
          <span className="text-[11px] font-normal text-slate-500 sm:text-xs">
            ({formatTime12hEgyptian(value)})
          </span>
        </span>
      ) : (
        <span className="min-w-0 truncate text-[11px] font-medium text-slate-400 sm:text-xs">
          {placeholder}
        </span>
      )}
      <Clock className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
      <input
        ref={inputRef}
        id={id}
        type="time"
        value={value}
        required={required}
        onClick={openPicker}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
};
