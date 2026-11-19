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
      className={`relative flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-900 transition-colors focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/20 ${className}`}
    >
      <span className="tabular-time text-slate-900">
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
      className={`relative flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 transition-colors focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/20 ${className}`}
    >
      {value ? (
        <span className="flex items-center gap-1.5 text-slate-900">
          <span className="tabular-time">{value}</span>
          <span className="text-xs font-normal text-slate-500">
            ({formatTime12hEgyptian(value)})
          </span>
        </span>
      ) : (
        <span className="text-xs font-medium text-slate-400">{placeholder}</span>
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
