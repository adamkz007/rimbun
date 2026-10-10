"use client";

import { Check } from "lucide-react";
import type { Option } from "@/lib/diagnose/questions";
import { cn } from "@/lib/utils";

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2.5">
      <p className="text-sm font-medium text-[#143632]">{children}</p>
      {hint ? <p className="mt-0.5 text-xs text-[#5f7a76]">{hint}</p> : null}
    </div>
  );
}

function Chip({
  option,
  selected,
  onClick,
  multi,
}: {
  option: Option;
  selected: boolean;
  onClick: () => void;
  multi: boolean;
}) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "group inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-[#0f5a53]/30",
        selected
          ? "border-[#0f5a53] bg-[#0f5a53] text-white"
          : "border-[#e2d9cd] bg-white text-[#143632] hover:border-[#0f5a53]/40 hover:bg-[#f3fbf9]"
      )}
    >
      {multi ? (
        <span
          className={cn(
            "inline-flex size-4 shrink-0 items-center justify-center rounded border",
            selected ? "border-white/70 bg-white/15" : "border-[#c9beb0]"
          )}
        >
          {selected ? <Check className="size-3" /> : null}
        </span>
      ) : null}
      <span>
        {option.label}
        {option.hint ? (
          <span className={cn("ml-1.5 text-xs", selected ? "text-white/70" : "text-[#7b918d]")}>
            {option.hint}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function SingleChoice({
  options,
  value,
  onChange,
  label,
}: {
  options: Option[];
  value: string | null;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Chip
          key={option.value}
          option={option}
          multi={false}
          selected={value === option.value}
          onClick={() => onChange(option.value)}
        />
      ))}
    </div>
  );
}

export function MultiChoice({
  options,
  values,
  onChange,
  label,
  max,
  exclusive,
}: {
  options: Option[];
  values: string[];
  onChange: (values: string[]) => void;
  label: string;
  max?: number;
  /** A value that clears the others when picked (e.g. "None of these"). */
  exclusive?: string;
}) {
  function toggle(value: string) {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
      return;
    }
    if (value === exclusive) {
      onChange([value]);
      return;
    }
    const next = values.filter((v) => v !== exclusive);
    if (max && next.length >= max) {
      onChange([...next.slice(1), value]);
      return;
    }
    onChange([...next, value]);
  }

  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Chip
          key={option.value}
          option={option}
          multi
          selected={values.includes(option.value)}
          onClick={() => toggle(option.value)}
        />
      ))}
    </div>
  );
}
