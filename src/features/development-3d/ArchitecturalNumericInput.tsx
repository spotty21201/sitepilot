'use client';

import React, { useState, useEffect, useRef } from 'react';

interface ArchitecturalNumericInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  helperText?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function ArchitecturalNumericInput({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  helperText,
  onChange,
  disabled = false
}: ArchitecturalNumericInputProps) {
  const [draft, setDraft] = useState<string>(value.toString());
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Synchronize draft when incoming canonical value changes (and not actively editing)
  useEffect(() => {
    if (!isFocused) {
      setDraft(value.toString());
      setValidationError(null);
    }
  }, [value, isFocused]);

  const validateDraft = (str: string): { valid: boolean; num: number; error: string | null } => {
    const trimmed = str.trim();
    if (trimmed === '') {
      return { valid: false, num: NaN, error: 'Value required' };
    }

    const num = parseFloat(trimmed);
    if (isNaN(num)) {
      return { valid: false, num: NaN, error: 'Invalid number' };
    }

    if (num < min) {
      return { valid: false, num, error: `Minimum is ${min}${unit}` };
    }

    if (num > max) {
      return { valid: false, num, error: `Maximum is ${max}${unit}` };
    }

    return { valid: true, num, error: null };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDraft = e.target.value;
    setDraft(newDraft);

    const result = validateDraft(newDraft);
    setValidationError(result.error);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    e.target.select();
  };

  const handleBlur = () => {
    setIsFocused(false);
    const result = validateDraft(draft);

    if (result.valid) {
      const rounded = Math.round(result.num * 100) / 100;
      setDraft(rounded.toString());
      setValidationError(null);
      if (rounded !== value) {
        onChange(rounded);
      }
    } else {
      // Revert to canonical value if invalid on blur
      setDraft(value.toString());
      setValidationError(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setDraft(value.toString());
      setValidationError(null);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-400 font-medium">{label}</span>
        {helperText && <span className="text-slate-500 font-mono">{helperText}</span>}
      </div>

      <div
        className={`flex items-center bg-[#182030] border rounded-lg px-2.5 py-1.5 transition-all ${
          validationError
            ? 'border-rose-500 ring-1 ring-rose-500/30'
            : isFocused
            ? 'border-[#38bdf8] ring-1 ring-[#38bdf8]/20'
            : 'border-[#2b3952] hover:border-[#3b4c6b]'
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={draft}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent text-slate-100 font-mono text-xs font-semibold focus:outline-none disabled:opacity-50"
        />
        <span className="text-[11px] font-mono text-slate-400 shrink-0 ml-1 font-bold">{unit}</span>
      </div>

      {validationError && (
        <div className="text-[9px] text-rose-400 font-mono flex items-center gap-1 mt-0.5 animate-in fade-in duration-150">
          <span>⚠️ {validationError}</span>
        </div>
      )}
    </div>
  );
}
