"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "flex items-stretch overflow-x-auto",
      "bg-[var(--bg-canvas)] border-b border-[var(--border-subtle)]",
      "scrollbar-none",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

interface TabsTriggerProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  onClose?: () => void;
  icon?: React.ReactNode;
}

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, children, onClose, icon, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "group relative inline-flex items-center gap-2 shrink-0 whitespace-nowrap",
      "px-4 py-3 font-mono text-[12px] text-[var(--fg-muted)]",
      "border-r border-[var(--border-subtle)]",
      "transition-colors duration-150",
      "hover:text-[var(--fg-secondary)]",
      "data-[state=active]:text-[var(--fg-primary)]",
      "data-[state=active]:bg-[var(--bg-surface)]",
      "data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed",
      className
    )}
    {...props}
  >
    {icon ? (
      <span className="shrink-0 text-[var(--fg-muted)] group-data-[state=active]:text-[var(--fg-brand)]">
        {icon}
      </span>
    ) : (
      <span
        aria-hidden
        className={cn(
          "shrink-0 text-[9px] leading-none",
          "text-transparent group-data-[state=active]:text-[var(--fg-brand)]"
        )}
      >
        ◆
      </span>
    )}
    <span>{children}</span>
    {onClose && (
      // biome-ignore lint/a11y/useSemanticElements: HTML forbids nesting <button> inside <button>; the Radix Trigger is already a button, so the close affordance must be a span.
      // biome-ignore lint/a11y/useFocusableInteractive: Same reason — the parent Trigger handles tab focus; the close acts on mousedown only by design.
      <span
        role="button"
        aria-label="Close tab"
        title="Close tab"
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onClose();
        }}
        className={cn(
          "ml-1 inline-grid place-items-center size-3.5 rounded-[3px]",
          "text-[var(--fg-muted)] opacity-0 cursor-pointer",
          "transition-opacity duration-150",
          "group-hover:opacity-60 group-data-[state=active]:opacity-60",
          "hover:!opacity-100 hover:bg-[var(--bg-hover-strong)] hover:text-[var(--fg-primary)]"
        )}
      >
        <span aria-hidden className="text-sm leading-none">
          ×
        </span>
      </span>
    )}
  </TabsPrimitive.Trigger>
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-canvas)] rounded-[var(--radius-sm)]",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsContent, TabsList, TabsTrigger };
