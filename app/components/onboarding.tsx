"use client";

// The first thing a person sees. Someone landing here has no reason to know
// what a token is, and without that the two counts on the page are just two
// numbers. This says what the tool is for in one screen, then gets out of
// the way and does not come back.

import { useCallback, useState, useSyncExternalStore } from "react";
import { Button } from "@/app/components/entrepta/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogLabel,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/entrepta/dialog";

const SEEN_KEY = "nomatch:intro-seen";

const STEPS = [
  "One search runs under two configurations. A is the defaults. B has a single option changed.",
  "Compare the two counts. Every document that did not come back is listed under missing.",
  "Open a missing document. It names the stage that dropped it, and the one option that brings it back.",
];

/**
 * Whether this browser has seen the intro. Read through
 * useSyncExternalStore rather than an effect: the server has no
 * localStorage, and this is the documented way to render one thing during
 * hydration and another once the real value is known, without a flash of
 * the dialog on every visit.
 */
function useHasSeenIntro(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return window.localStorage.getItem(SEEN_KEY) !== null;
      } catch {
        // Storage can be refused. Treating that as "seen" is the quiet
        // failure: better than showing the dialog on every single visit.
        return true;
      }
    },
    () => true,
  );
}

export function Onboarding() {
  const seen = useHasSeenIntro();
  const [dismissed, setDismissed] = useState(false);
  const [reopened, setReopened] = useState(false);

  const open = reopened || (!seen && !dismissed);

  const handleOpenChange = useCallback((next: boolean) => {
    setReopened(next);
    if (!next) {
      setDismissed(true);
      try {
        window.localStorage.setItem(SEEN_KEY, "1");
      } catch {
        // Nothing to do. The dialog stays closed for this session either way.
      }
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded-[var(--radius-sm)] px-2 py-1 font-mono text-[11px] text-[var(--fg-secondary)] transition-colors duration-150 hover:bg-[var(--bg-hover-soft)] hover:text-[var(--fg-primary)]"
        >
          how it works
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-lg gap-5">
        <DialogLabel>nomatch</DialogLabel>

        <DialogTitle className="text-[28px] text-balance">
          A search engine never reads your <em>words</em>.
        </DialogTitle>

        <DialogDescription>
          It cuts text into pieces called tokens and stores the pieces. Your search gets cut the
          same way, and the two piles are compared piece by piece. Two words that look identical
          to you can come out as different tokens, and then nothing comes back. Search for{" "}
          <code className="font-mono text-[var(--fg-primary)]">cafe</code> and a document holding{" "}
          <code className="font-mono text-[var(--fg-primary)]">café</code> stays hidden.
        </DialogDescription>

        <ol className="flex flex-col gap-2.5">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span
                aria-hidden
                className="mt-px shrink-0 font-mono text-[11px] tabular-nums text-[var(--fg-brand)]"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="font-sans text-[13px] leading-relaxed text-[var(--fg-secondary)]">
                {step}
              </span>
            </li>
          ))}
        </ol>

        <p className="font-mono text-[11px] leading-relaxed text-[var(--fg-muted)]">
          {"// "}The analyzer runs in this tab, compiled to WebAssembly. No account, no upload,
          nothing sent anywhere.
        </p>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="primary" size="sm">
              Start searching
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
