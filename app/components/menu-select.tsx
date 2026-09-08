"use client";

// One picker, used for every choice on the page that is a choice between
// named values. Built on entrepta's dropdown rather than a native select
// so the options carry a line of explanation, which a native option
// cannot hold.

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/app/components/entrepta/dropdown";

export interface MenuOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface MenuSelectProps<T extends string> {
  /** Read by a screen reader in place of the trigger's visible text. */
  label: string;
  value: T;
  options: MenuOption<T>[];
  onChange: (value: T) => void;
  /** Shown before the value, muted, e.g. "language:". */
  prefix?: string;
  align?: "start" | "end";
}

export function MenuSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  prefix,
  align = "end",
}: MenuSelectProps<T>) {
  const current = options.find((option) => option.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className="group inline-flex max-w-full items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-2 py-1 font-mono text-[11px] text-[var(--fg-secondary)] transition-colors duration-150 hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)] focus-visible:border-[var(--fg-brand)] focus-visible:outline-none data-[state=open]:border-[var(--fg-brand)] data-[state=open]:text-[var(--fg-primary)]"
      >
        {prefix && (
          <span aria-hidden className="text-[var(--fg-muted)]">
            {prefix}
          </span>
        )}
        <span className="truncate">{current?.label ?? value}</span>
        <ChevronDown
          aria-hidden
          style={{ width: 12, height: 12, strokeWidth: 1.5 }}
          className="shrink-0 text-[var(--fg-muted)] transition-transform duration-150 group-data-[state=open]:rotate-180"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} className="min-w-[220px]">
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(next as T)}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate">{option.label}</span>
                {option.hint && (
                  <span className="text-[11px] text-[var(--fg-muted)]">{option.hint}</span>
                )}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
