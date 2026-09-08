"use client";

import { type VariantProps, cva } from "class-variance-authority";
import { Moon, Sun } from "lucide-react";
import * as React from "react";
import { type ThemeMode, useMode } from "@/app/hooks/use-mode";
import { cn } from "@/lib/utils";

type TogglePosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";

const POSITION_CLASS: Record<TogglePosition, string> = {
  "bottom-right": "bottom-12 right-5",
  "bottom-left": "bottom-12 left-5",
  "top-right": "top-5 right-5",
  "top-left": "top-5 left-5",
};

const modeToggle = cva(
  "inline-flex items-center justify-center shrink-0 font-mono uppercase tracking-[0.08em] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--fg-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)] focus-visible:outline-none focus-visible:border-[var(--fg-brand)] focus-visible:shadow-[0_0_0_3px_var(--bg-surface-brand)] transition-colors",
  {
    variants: {
      variant: {
        icon: "",
        labeled: "gap-2",
      },
      size: {
        sm: "h-7 text-[10px]",
        md: "h-9 text-[11px]",
      },
    },
    compoundVariants: [
      { variant: "icon", size: "sm", class: "w-7" },
      { variant: "icon", size: "md", class: "w-9" },
      { variant: "labeled", size: "sm", class: "px-2.5" },
      { variant: "labeled", size: "md", class: "px-3" },
    ],
    defaultVariants: { variant: "icon", size: "md" },
  }
);

interface ModeToggleProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "type">,
    VariantProps<typeof modeToggle> {
  /** Mode used when nothing is stored. Default `"dark"`. */
  defaultMode?: ThemeMode;
  /** localStorage key prefix. The toggle stores `${storageKey}:mode`. Default `"entrepta"`. */
  storageKey?: string;
  /** Anchor the button to a screen corner. Omit to render it inline. */
  position?: TogglePosition;
  /** Fires after the mode changes. */
  onModeChange?: (mode: ThemeMode) => void;
}

const ICON_SIZE: Record<NonNullable<VariantProps<typeof modeToggle>["size"]>, number> = {
  sm: 12,
  md: 14,
};

// Both icons stay mounted and stacked so the swap can cross-fade. They turn in
// opposite directions, which reads like a dial. The globals.css reduced-motion
// block flattens the transition for anyone who asks for less movement.
const ICON_BASE =
  "col-start-1 row-start-1 transition-[opacity,rotate,scale] duration-[var(--motion-base)] ease-[var(--ease-out)]";
const ICON_IN = "opacity-100 rotate-0 scale-100";

/** Sun in light mode, moon in dark mode. Shows the mode you are in, not the one you get. */
function ModeIcon({ mode, size }: { mode: ThemeMode; size: number }) {
  const iconStyle = { width: size, height: size, strokeWidth: 1.5 };
  return (
    <span
      aria-hidden
      className="relative inline-grid place-items-center shrink-0"
      style={{ width: size, height: size }}
    >
      <Moon
        className={cn(ICON_BASE, mode === "dark" ? ICON_IN : "opacity-0 rotate-90 scale-50")}
        style={iconStyle}
      />
      <Sun
        className={cn(ICON_BASE, mode === "light" ? ICON_IN : "opacity-0 -rotate-90 scale-50")}
        style={iconStyle}
      />
    </span>
  );
}

const ModeToggle = React.forwardRef<HTMLButtonElement, ModeToggleProps>(
  (
    {
      defaultMode,
      storageKey,
      position,
      onModeChange,
      variant = "icon",
      size = "md",
      className,
      onClick,
      ...buttonProps
    },
    ref
  ) => {
    const { mode, toggleMode } = useMode({ defaultMode, storageKey });
    const next: ThemeMode = mode === "dark" ? "light" : "dark";

    function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
      onClick?.(event);
      if (event.defaultPrevented) return;
      toggleMode();
      onModeChange?.(next);
    }

    return (
      <button
        ref={ref}
        type="button"
        aria-label={`Mode: ${mode}. Switch to ${next}.`}
        aria-pressed={mode === "light"}
        onClick={handleClick}
        data-mode-toggle
        data-mode={mode}
        className={cn(
          modeToggle({ variant, size }),
          position && `fixed z-50 shadow-[0_4px_12px_rgba(0,0,0,0.3)] ${POSITION_CLASS[position]}`,
          className
        )}
        {...buttonProps}
      >
        <ModeIcon mode={mode} size={ICON_SIZE[size ?? "md"]} />
        {variant === "labeled" && <span>{mode}</span>}
      </button>
    );
  }
);
ModeToggle.displayName = "ModeToggle";

interface ModeScriptProps {
  /** Must match the `storageKey` passed to `ModeToggle` / `useMode`. */
  storageKey?: string;
}

/**
 * Inline script that runs before React hydrates so the saved mode is applied
 * before first paint. Drop this in your root `<head>` to avoid a flash of the
 * default mode on every page load. Skip it if you already render `ThemeScript`,
 * which covers the mode too.
 */
function ModeScript({ storageKey = "entrepta" }: ModeScriptProps) {
  const modeKey = JSON.stringify(`${storageKey}:mode`);
  const script = `(function(){try{var m=localStorage.getItem(${modeKey});if(m==='light')document.documentElement.setAttribute('data-mode','light');}catch(e){}})();`;
  // biome-ignore lint/security/noDangerouslySetInnerHtml: static string we control; no user input is interpolated.
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

export { ModeScript, ModeToggle };
export type { ModeScriptProps, ModeToggleProps, TogglePosition };
