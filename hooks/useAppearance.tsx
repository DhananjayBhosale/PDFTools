import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar';
import {
  androidThemeModeFor,
  createAndroidThemePersistence,
  type AndroidLegacyThemeResolution,
  type AndroidThemePersistence,
} from '../services/platform/android/androidSettings';

/**
 * Presentation preferences: colour scheme and readable text size.
 *
 * These are appearance, not document data, so they live next to the interface
 * rather than in the workspace store: nothing here describes a file, a history
 * record, or anything that survives a reinstall. `theme` keeps the existing
 * `theme` key so a returning user's choice is not silently reset; the readable
 * text size is stored alongside it.
 *
 * On Android the same preference also exists in the older app's own settings
 * store, which is a second place the truth can live. The rules below are what
 * keeps the two from drifting apart: this store stays authoritative once it
 * holds a real choice, the older store is read once when it does not, and an
 * explicit choice is not called saved until the device says it was written. The
 * one marker below exists because a process can die between those two moments.
 */

export type ThemePreference = 'system' | 'light' | 'dark';
export type TextScale = 'small' | 'default' | 'large' | 'larger';

const THEME_KEY = 'theme';
const TEXT_SCALE_KEY = 'pdfchef.appearance.text-scale.v1';
/** One in-flight Android theme write. Bounded, strict, and cleared on landing. */
export const THEME_MARKER_KEY = 'pdfchef.appearance.android-theme-write.v1';
/** Nothing legitimate approaches this; anything longer is not ours to trust. */
const THEME_MARKER_MAXIMUM_LENGTH = 96;

export const TEXT_SCALE_LABELS: Record<TextScale, string> = {
  small: 'Compact',
  default: 'Default',
  large: 'Large',
  larger: 'Largest',
};

const isTheme = (value: unknown): value is ThemePreference =>
  value === 'system' || value === 'light' || value === 'dark';

const isTextScale = (value: unknown): value is TextScale =>
  value === 'small' || value === 'default' || value === 'large' || value === 'larger';

const readTheme = (): ThemePreference => {
  if (typeof window === 'undefined') return 'system';
  const saved = window.localStorage.getItem(THEME_KEY);
  return isTheme(saved) ? saved : 'system';
};

/* --------------------------------------------- the two-store contract --- */

/**
 * What the Appearance surface is allowed to say about a theme choice.
 *
 * `failed` is a choice the device would not take, so the last saved theme comes
 * back. `unsaved` is the narrower truth that the theme is in use but this app
 * could not finish storing it here, which a restart can undo. Neither is ever
 * called saved.
 */
export type ThemeSyncState = 'idle' | 'saving' | 'saved' | 'imported' | 'failed' | 'unsaved';

/** The exact shape of the in-flight marker. Two known keys, nothing else. */
export interface ThemeMarker {
  readonly target: ThemePreference;
  readonly confirmed: ThemePreference;
}

/**
 * Strict on purpose. The marker decides what happens to a person's settings
 * after a process death, so anything that is not exactly what this app wrote is
 * treated as no marker at all rather than as a half-understood instruction.
 */
export const parseThemeMarker = (raw: unknown): ThemeMarker | null => {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > THEME_MARKER_MAXIMUM_LENGTH) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  if (Object.getPrototypeOf(value) !== Object.prototype) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 2 || keys.some((key) => typeof key !== 'string')) return null;
  const sorted = (keys as string[]).slice().sort();
  if (sorted[0] !== 'confirmed' || sorted[1] !== 'target') return null;
  const record = value as Record<string, unknown>;
  if (!isTheme(record.target) || !isTheme(record.confirmed)) return null;
  return Object.freeze({ target: record.target, confirmed: record.confirmed });
};

export const serializeThemeMarker = (marker: ThemeMarker): string =>
  JSON.stringify({ confirmed: marker.confirmed, target: marker.target });

/** What a launch should do about a write that never reported back. */
export type ThemeReconciliation =
  /** The device holds exactly what was asked for: the choice landed. */
  | { readonly action: 'commit-target'; readonly theme: ThemePreference }
  /** The device holds another real choice: that one is the confirmed truth. */
  | { readonly action: 'adopt-native'; readonly theme: ThemePreference }
  /** Nothing readable to compare against: keep what was confirmed and retry later. */
  | { readonly action: 'retain' };

export const reconcilePendingTheme = (
  marker: ThemeMarker,
  resolution: AndroidLegacyThemeResolution | null,
): ThemeReconciliation => {
  if (!resolution || resolution.preference === null || resolution.legacyMode === null) {
    return { action: 'retain' };
  }
  if (resolution.legacyMode === androidThemeModeFor(marker.target)) {
    return { action: 'commit-target', theme: marker.target };
  }
  return { action: 'adopt-native', theme: resolution.preference };
};

/** A first launch with nothing of our own: take the older app's choice, once. */
export type ThemeImport =
  | { readonly action: 'apply'; readonly theme: ThemePreference }
  /** Missing, blank, corrupt or simply no theme. Not a default, not a success. */
  | { readonly action: 'none' };

export const importLegacyTheme = (resolution: AndroidLegacyThemeResolution | null): ThemeImport =>
  resolution && resolution.preference !== null
    ? { action: 'apply', theme: resolution.preference }
    : { action: 'none' };

/**
 * Storage that answers for itself. A preference this app could not actually
 * store is not a saved preference, and the only way to know that is for the
 * port to say so rather than to swallow it.
 */
export interface AppearanceStorage {
  read(key: string): string | null;
  /** True only when the value is durably stored. */
  write(key: string, value: string): boolean;
  /** True only when the key is gone. */
  remove(key: string): boolean;
}

export interface ThemeBridgePorts {
  /**
   * The accepted Android reader and writer. Absent on the browser and on iOS,
   * where this store is the only store — and absent on an Android build that
   * cannot reach them, which is a different thing entirely.
   */
  persistence: Pick<AndroidThemePersistence, 'readLegacyTheme' | 'writeTheme'> | null;
  /**
   * True on Android. Without it, an Android build that cannot reach its own
   * settings store would be indistinguishable from a browser, and a choice that
   * never reached the device would be reported as an ordinary local save.
   */
  isAndroid: boolean;
  storage: AppearanceStorage;
  /** Paint a theme. Called for the press, and again if a write comes back refused. */
  apply(theme: ThemePreference): void;
  report(state: ThemeSyncState): void;
  /** False once the surface is gone, so nothing lands on an unmounted tree. */
  isAlive(): boolean;
}

/**
 * The ordered bridge between this store and the device's own.
 *
 * A press paints immediately and is only called saved when the device confirms
 * it. Until then the marker records what was attempted and what to fall back
 * to, so a process that dies mid-write is reconciled on the next launch rather
 * than leaving the two stores quietly disagreeing. Under rapid presses only the
 * newest one may finish visibly; an older write that confirms first is still
 * real, so it becomes the fallback the newest one would roll back to.
 */
export const createThemeBridge = ({
  persistence,
  isAndroid,
  storage,
  apply,
  report,
  isAlive,
}: ThemeBridgePorts) => {
  let confirmed: ThemePreference = 'system';
  let pendingTarget: ThemePreference | null = null;
  let sequence = 0;

  const readConfirmedLocal = (): ThemePreference | null => {
    const saved = storage.read(THEME_KEY);
    return isTheme(saved) ? saved : null;
  };

  /**
   * Land a preference here: store it, and only then let go of the marker that
   * was standing in for it. A store that refuses keeps the marker, so the next
   * launch tries again instead of losing the choice, and the caller is told the
   * landing was not clean so nothing claims a save that did not happen.
   */
  const settle = (theme: ThemePreference, clearMarker: boolean): boolean => {
    if (!storage.write(THEME_KEY, theme)) return false;
    confirmed = theme;
    return clearMarker ? storage.remove(THEME_MARKER_KEY) : true;
  };

  const readLegacy = async (): Promise<AndroidLegacyThemeResolution | null> => {
    if (!persistence) return null;
    try {
      return await persistence.readLegacyTheme();
    } catch {
      // An unreadable store is an unhealthy store. It is never a preference.
      return null;
    }
  };

  return {
    /** The launch decision: reconcile a pending write, or import once, or neither. */
    async start(): Promise<void> {
      const local = readConfirmedLocal();
      const marker = parseThemeMarker(storage.read(THEME_MARKER_KEY));
      if (!marker) storage.remove(THEME_MARKER_KEY);
      confirmed = local ?? marker?.confirmed ?? 'system';

      if (!persistence) return;

      if (marker) {
        // A write was in flight when this app last stopped, so the device is
        // asked what actually happened even though this store holds a theme.
        const decision = reconcilePendingTheme(marker, await readLegacy());
        if (decision.action === 'retain') {
          if (!isAlive()) return;
          // Nothing readable to settle against. The last confirmed preference is
          // put back on screen — including when this store no longer holds it —
          // and the marker stays for a later attempt.
          apply(confirmed);
          report('failed');
          return;
        }
        const clean = settle(decision.theme, true);
        if (!isAlive()) return;
        apply(decision.theme);
        // A launch that simply agrees with the device has nothing to announce.
        if (!clean) report('unsaved');
        return;
      }

      // A real choice already lives here, so the older store is not consulted.
      if (local) return;

      const outcome = importLegacyTheme(await readLegacy());
      if (outcome.action === 'none') return;
      // Read only: the older store is never written during an import, so a
      // DYNAMIC theme there stays DYNAMIC there.
      const clean = settle(outcome.theme, false);
      if (!isAlive()) return;
      apply(outcome.theme);
      report(clean ? 'imported' : 'unsaved');
    },

    /** An explicit choice, including Reset's return to System. */
    async choose(next: ThemePreference): Promise<void> {
      apply(next);
      if (!persistence) {
        if (isAndroid) {
          // An Android build that cannot reach its own settings store has not
          // saved anything, and saying nothing would be the same as claiming it
          // had. The choice goes back to the last confirmed one.
          const fallback = confirmed;
          if (!isAlive()) return;
          apply(fallback);
          report('failed');
          return;
        }
        // Browser and iOS: this store is the only store, exactly as before.
        if (!settle(next, false) && isAlive()) report('unsaved');
        return;
      }

      const ticket = (sequence += 1);
      pendingTarget = next;
      // The marker is published before the device is asked for anything. It is
      // the only record that could reconcile a process death between the device
      // accepting a theme and this store learning of it, so without it the two
      // stores could diverge with nothing left to notice. No marker, no write.
      if (!storage.write(THEME_MARKER_KEY, serializeThemeMarker({ target: next, confirmed }))) {
        pendingTarget = null;
        const fallback = confirmed;
        if (!isAlive()) return;
        apply(fallback);
        report('failed');
        return;
      }
      report('saving');

      try {
        await persistence.writeTheme(next);
      } catch {
        // The device's own words never reach the surface.
        if (ticket !== sequence) return;
        pendingTarget = null;
        storage.remove(THEME_MARKER_KEY);
        const fallback = confirmed;
        if (!isAlive()) return;
        apply(fallback);
        report('failed');
        return;
      }

      const latest = ticket === sequence;
      const clean = settle(next, latest);
      if (!latest) {
        // An older write landed while a newer one is still out. It is confirmed
        // truth now, so it becomes what the newer one falls back to.
        if (pendingTarget) {
          storage.write(THEME_MARKER_KEY, serializeThemeMarker({ target: pendingTarget, confirmed }));
        }
        return;
      }
      pendingTarget = null;
      if (!isAlive()) return;
      report(clean ? 'saved' : 'unsaved');
    },
  };
};

const browserStorage: AppearanceStorage = {
  read(key) {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  write(key, value) {
    if (typeof window === 'undefined') return false;
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      // A full or blocked store is a real outcome, not something to hide.
      return false;
    }
  },
  remove(key) {
    if (typeof window === 'undefined') return false;
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
};

const readTextScale = (): TextScale => {
  if (typeof window === 'undefined') return 'default';
  const saved = window.localStorage.getItem(TEXT_SCALE_KEY);
  return isTextScale(saved) ? saved : 'default';
};

const prefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

interface AppearanceValue {
  theme: ThemePreference;
  /** What the interface is actually painting right now. */
  resolvedTheme: 'light' | 'dark';
  /**
   * Where an explicit theme choice has got to. `idle` everywhere the choice is
   * kept in one place only, which is the browser and iOS.
   */
  themeSync: ThemeSyncState;
  setTheme: (next: ThemePreference) => void;
  textScale: TextScale;
  setTextScale: (next: TextScale) => void;
  /** True when the platform asks for reduced motion. Live, not read once. */
  reducedMotion: boolean;
  resetAppearance: () => void;
}

const AppearanceContext = createContext<AppearanceValue | null>(null);

export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemePreference>(readTheme);
  const [textScale, setTextScaleState] = useState<TextScale>(readTextScale);
  const [systemDark, setSystemDark] = useState<boolean>(prefersDark);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [themeSync, setThemeSync] = useState<ThemeSyncState>('idle');
  const alive = useRef(true);

  const bridge = useMemo(
    () =>
      createThemeBridge({
        persistence: createAndroidThemePersistence(),
        isAndroid: Capacitor.getPlatform() === 'android',
        storage: browserStorage,
        apply: setThemeState,
        report: setThemeSync,
        isAlive: () => alive.current,
      }),
    [],
  );

  useEffect(() => {
    alive.current = true;
    void bridge.start();
    return () => {
      alive.current = false;
    };
  }, [bridge]);

  // A settled outcome states itself and then stops taking up room. A failure
  // stays, because it is the only thing telling the person the device still
  // disagrees with what they chose.
  useEffect(() => {
    if (themeSync !== 'saved' && themeSync !== 'imported') return undefined;
    const timer = window.setTimeout(() => setThemeSync((current) => (current === themeSync ? 'idle' : current)), 5000);
    return () => window.clearTimeout(timer);
  }, [themeSync]);

  useEffect(() => {
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncScheme = () => setSystemDark(scheme.matches);
    const syncMotion = () => setReducedMotion(motion.matches);

    syncScheme();
    syncMotion();
    scheme.addEventListener('change', syncScheme);
    motion.addEventListener('change', syncMotion);
    return () => {
      scheme.removeEventListener('change', syncScheme);
      motion.removeEventListener('change', syncMotion);
    };
  }, []);

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    // Keeps native form controls, scrollbars and the WKWebView background in step.
    root.style.colorScheme = resolvedTheme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.setAttribute('content', resolvedTheme === 'dark' ? '#16140f' : '#f8f5ef');
    }
    if (Capacitor.getPlatform() === 'android') {
      void StatusBar.setStyle({
        style: resolvedTheme === 'dark' ? StatusBarStyle.Dark : StatusBarStyle.Light,
      }).catch(() => undefined);
    }
  }, [resolvedTheme]);

  useEffect(() => {
    document.documentElement.dataset.textScale = textScale;
  }, [textScale]);

  const setTheme = useCallback(
    (next: ThemePreference) => {
      void bridge.choose(next);
    },
    [bridge],
  );

  const setTextScale = useCallback((next: TextScale) => {
    setTextScaleState(next);
    window.localStorage.setItem(TEXT_SCALE_KEY, next);
  }, []);

  // Reset is an explicit choice of System, so it takes the same path a press
  // does rather than a quiet second way of writing the same preference.
  const resetAppearance = useCallback(() => {
    setTheme('system');
    setTextScale('default');
  }, [setTextScale, setTheme]);

  const value = useMemo<AppearanceValue>(
    () => ({
      theme,
      resolvedTheme,
      themeSync,
      setTheme,
      textScale,
      setTextScale,
      reducedMotion,
      resetAppearance,
    }),
    [reducedMotion, resetAppearance, resolvedTheme, setTextScale, setTheme, textScale, theme, themeSync],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
};

export const useAppearance = (): AppearanceValue => {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error('useAppearance must be used inside AppearanceProvider.');
  return value;
};
