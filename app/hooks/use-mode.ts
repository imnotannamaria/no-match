"use client";

// Dark and light mode. Copied from entrepta and owned here, with one
// change: entrepta resolves the stored mode inside a mount effect, which
// this project's lint rejects (react-hooks/set-state-in-effect) and which
// costs a second render on every page load. localStorage is an external
// store, so it is read through useSyncExternalStore instead. Same API,
// same behaviour, no state write on mount.

import * as React from "react";

type ThemeMode = "dark" | "light";

interface UseModeOptions {
  /** Mode used when nothing is stored. Default `"dark"`. */
  defaultMode?: ThemeMode;
  /**
   * localStorage key prefix. The hook stores `${storageKey}:mode`. Default
   * `"entrepta"`. Keep it in sync with `ModeScript`.
   */
  storageKey?: string;
  /** Lock the mode to `defaultMode`. Setters become no-ops. */
  disableMode?: boolean;
}

interface UseModeReturn {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

function applyModeAttribute(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  if (mode === "light") document.documentElement.setAttribute("data-mode", "light");
  else document.documentElement.removeAttribute("data-mode");
}

function safeRead(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    // Storage can be refused. The default mode is the answer then.
    return null;
  }
}

function safeWrite(key: string, value: string) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  } catch {
    // The mode still applies to this page. It just will not survive a reload.
  }
}

// Every hook instance sharing a storage key also shares this list, so a
// toggle in the nav and one in a corner never drift apart.
const listeners = new Map<string, Set<() => void>>();

function subscribe(key: string, listener: () => void) {
  const forKey = listeners.get(key) ?? new Set<() => void>();
  forKey.add(listener);
  listeners.set(key, forKey);
  return () => {
    forKey.delete(listener);
    if (forKey.size === 0) listeners.delete(key);
  };
}

function broadcast(key: string) {
  for (const listener of listeners.get(key) ?? []) listener();
}

/**
 * Dark and light mode. Drives `data-mode` on `<html>` and persists the
 * choice. Pair it with `ModeScript` in the document head so the stored mode
 * is applied before first paint.
 */
function useMode(options: UseModeOptions = {}): UseModeReturn {
  const { defaultMode = "dark", storageKey = "entrepta", disableMode } = options;
  const modeKey = `${storageKey}:mode`;

  const subscribeToMode = React.useCallback(
    (onChange: () => void) => {
      const unsubscribe = subscribe(modeKey, onChange);
      // Another tab writing the same key.
      const onStorage = (event: StorageEvent) => {
        if (event.key === modeKey) onChange();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        unsubscribe();
        window.removeEventListener("storage", onStorage);
      };
    },
    [modeKey],
  );

  const mode = React.useSyncExternalStore(
    subscribeToMode,
    () => {
      if (disableMode) return defaultMode;
      const stored = safeRead(modeKey);
      return stored === "dark" || stored === "light" ? stored : defaultMode;
    },
    // The server has no storage, and neither does the first hydration pass.
    () => defaultMode,
  );

  // ModeScript only ever adds the attribute before paint, so clearing a
  // stale one is on us: without this, `disableMode` over a stored "light"
  // leaves the page light while the hook reports dark, with no way back.
  React.useEffect(() => {
    applyModeAttribute(mode);
  }, [mode]);

  const setMode = React.useCallback(
    (next: ThemeMode) => {
      if (disableMode) return;
      applyModeAttribute(next);
      safeWrite(modeKey, next);
      broadcast(modeKey);
    },
    [modeKey, disableMode],
  );

  const toggleMode = React.useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  return { mode, setMode, toggleMode };
}

export { useMode };
export type { ThemeMode, UseModeOptions, UseModeReturn };
