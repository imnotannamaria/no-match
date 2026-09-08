"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { type VariantProps, cva } from "class-variance-authority";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-[4px]",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      "duration-200",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

// Two shapes, one component. The drawer is the same dialog anchored to the
// right edge: same focus trap, same escape key, same overlay. Splitting it
// into a second component would be a second thing to keep accessible.
const dialogContentVariants = cva(
  [
    "fixed z-50 flex flex-col",
    "bg-[var(--bg-surface)] border border-[var(--border-strong)]",
    "shadow-[0_24px_48px_rgba(0,0,0,0.6)]",
    "focus-visible:outline-none",
  ],
  {
    variants: {
      variant: {
        center: [
          "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
          "gap-4 w-[calc(100vw-32px)] max-w-md p-6",
          "rounded-[var(--radius-lg)]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "duration-200 ease-out",
        ],
        drawer: [
          "inset-y-0 right-0 h-full w-full sm:w-[620px] sm:max-w-[94vw]",
          "rounded-none border-y-0 border-r-0 p-0",
          "overscroll-contain nm-drawer",
        ],
      },
    },
    defaultVariants: { variant: "center" },
  }
);

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof dialogContentVariants> {}

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, variant, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(dialogContentVariants({ variant }), className)}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        aria-label="Close"
        className={cn(
          "absolute right-3 top-3 inline-flex items-center justify-center",
          "h-7 w-7 rounded-[var(--radius-sm)]",
          "text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-hover-soft)]",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:[outline:2px_solid_var(--fg-brand)] focus-visible:outline-offset-2"
        )}
      >
        <X aria-hidden style={{ width: 14, height: 14, strokeWidth: 1.5 }} />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-2 pr-8", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex items-center justify-end gap-2 pt-5",
      "border-t border-[var(--border-subtle)] -mx-6 px-6 mt-2",
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "m-0 font-serif font-normal text-2xl leading-snug text-[var(--fg-primary)]",
      "[&_em]:italic [&_em]:text-[var(--fg-brand)]",
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn(
      "m-0 font-sans text-[13px] leading-relaxed text-[var(--fg-secondary)]",
      className
    )}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

/** Optional meta strip (file path / version / status) shown above the title. */
const DialogLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1.5",
        "font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--fg-secondary)]",
        className
      )}
      {...props}
    >
      <span aria-hidden className="text-[10px] text-[var(--fg-brand)] leading-none">
        ◆
      </span>
      {children}
    </div>
  )
);
DialogLabel.displayName = "DialogLabel";

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogLabel,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
