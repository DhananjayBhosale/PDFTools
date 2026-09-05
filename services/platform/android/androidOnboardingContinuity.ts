import {
  AndroidLegacyInspectorClient,
  isAndroidLegacyInspectorAvailable,
} from './androidLegacyInspector.ts';
import type { AndroidLegacySettingsSnapshot } from './legacyCompatibilityContracts.ts';
import {
  getExplicitWorkspaceInterfaceFont,
  getWorkspaceSettings,
  hasCheckedAndroidLegacyInterfaceFont,
  markAndroidLegacyInterfaceFontChecked,
  updateWorkspaceSettings,
  type WorkspaceInterfaceFont,
} from '../../workspace.ts';

export const ANDROID_ONBOARDING_CONTINUITY_BUDGET_MS = 1500;

export type AndroidOnboardingContinuityStatus =
  | 'already-complete'
  | 'imported'
  | 'unchanged'
  | 'abandoned'
  | 'unavailable';

export interface AndroidOnboardingContinuityPorts {
  readonly readLegacySettings: () => Promise<AndroidLegacySettingsSnapshot>;
  readonly readSharedOnboardingComplete: () => boolean;
  readonly markSharedOnboardingComplete: () => void;
  /** Optional as a group so older focused callers keep the original onboarding-only seam. */
  readonly readExplicitSharedInterfaceFont?: () => WorkspaceInterfaceFont | null;
  readonly isLegacyInterfaceFontChecked?: () => boolean;
  readonly markSharedInterfaceFont?: (font: WorkspaceInterfaceFont) => void;
  readonly markLegacyInterfaceFontChecked?: () => void;
  /** False after first render wins the race; a late native read may no longer write. */
  readonly isCommitAllowed: () => boolean;
}

export type AndroidOnboardingContinuityRun = (
  isCommitAllowed: () => boolean,
) => Promise<AndroidOnboardingContinuityStatus>;

export type AndroidOnboardingSettle = (
  run: () => Promise<AndroidOnboardingContinuityStatus>,
  fallback: AndroidOnboardingContinuityStatus,
  budgetMs: number,
) => Promise<unknown>;

/**
 * `partial_invalid` means the native reader omitted another invalid preference;
 * every returned value was independently type-checked. Future health states fail
 * closed because only the two readable states are accepted here.
 */
export const legacyOnboardingIsComplete = (
  snapshot: AndroidLegacySettingsSnapshot,
): boolean => (
  (snapshot.health === 'ok' || snapshot.health === 'partial_invalid')
  && snapshot.values.onboarding_completed === true
);

export interface AndroidLegacyInterfaceFontResolution {
  readonly font: WorkspaceInterfaceFont | null;
  /** True means the readable legacy state was fully classified and need not be retried. */
  readonly settled: boolean;
}

/** Only exact families shared by both applications are imported; no visual approximation is made. */
export const resolveAndroidLegacyInterfaceFont = (
  snapshot: AndroidLegacySettingsSnapshot,
): AndroidLegacyInterfaceFontResolution => {
  if (snapshot.health === 'missing' || snapshot.health === 'blank') {
    return Object.freeze({ font: null, settled: true });
  }
  if (snapshot.health !== 'ok' && snapshot.health !== 'partial_invalid') {
    return Object.freeze({ font: null, settled: false });
  }
  const legacy = snapshot.values.app_font_option;
  const font = legacy === 'DEFAULT'
    ? 'system'
    : legacy === 'INTER'
      ? 'inter'
      : legacy === 'MANROPE'
        ? 'manrope'
        : null;
  return Object.freeze({ font, settled: true });
};

const fontPortsOf = (ports: AndroidOnboardingContinuityPorts) => {
  const {
    readExplicitSharedInterfaceFont,
    isLegacyInterfaceFontChecked,
    markSharedInterfaceFont,
    markLegacyInterfaceFontChecked,
  } = ports;
  if (!readExplicitSharedInterfaceFont || !isLegacyInterfaceFontChecked
      || !markSharedInterfaceFont || !markLegacyInterfaceFontChecked) return null;
  return {
    readExplicitSharedInterfaceFont,
    isLegacyInterfaceFontChecked,
    markSharedInterfaceFont,
    markLegacyInterfaceFontChecked,
  };
};

export const importAndroidOnboardingContinuity = async (
  ports: AndroidOnboardingContinuityPorts,
): Promise<AndroidOnboardingContinuityStatus> => {
  let alreadyComplete: boolean;
  try {
    alreadyComplete = ports.readSharedOnboardingComplete();
  } catch {
    return 'unavailable';
  }
  const fontPorts = fontPortsOf(ports);
  let inspectLegacyFont = false;
  if (fontPorts) {
    try {
      inspectLegacyFont = !fontPorts.isLegacyInterfaceFontChecked()
        && fontPorts.readExplicitSharedInterfaceFont() === null;
    } catch {
      return 'unavailable';
    }
  }
  if (alreadyComplete && !inspectLegacyFont) return 'already-complete';

  let snapshot: AndroidLegacySettingsSnapshot;
  try {
    snapshot = await ports.readLegacySettings();
  } catch {
    return 'unavailable';
  }
  const importOnboarding = !alreadyComplete && legacyOnboardingIsComplete(snapshot);
  const fontResolution = inspectLegacyFont
    ? resolveAndroidLegacyInterfaceFont(snapshot)
    : Object.freeze({ font: null, settled: false });
  const settleLegacyFont = inspectLegacyFont && fontResolution.settled;
  if (!importOnboarding && !settleLegacyFont) return 'unchanged';
  if (!ports.isCommitAllowed()) return 'abandoned';

  try {
    if (importOnboarding) ports.markSharedOnboardingComplete();
    if (settleLegacyFont && fontPorts) {
      if (fontResolution.font !== null) fontPorts.markSharedInterfaceFont(fontResolution.font);
      fontPorts.markLegacyInterfaceFontChecked();
    }
  } catch {
    return 'unavailable';
  }
  return importOnboarding || fontResolution.font !== null ? 'imported' : 'unchanged';
};

/** Production composition. The shared true flag short-circuits before any native read. */
export const runAndroidOnboardingContinuity: AndroidOnboardingContinuityRun =
  isCommitAllowed => importAndroidOnboardingContinuity({
    readSharedOnboardingComplete: () => getWorkspaceSettings().onboardingComplete,
    readLegacySettings: async () => {
      if (!isAndroidLegacyInspectorAvailable()) {
        throw new TypeError('Android legacy settings are unavailable.');
      }
      return new AndroidLegacyInspectorClient().readSettings();
    },
    markSharedOnboardingComplete: () => {
      updateWorkspaceSettings({ onboardingComplete: true });
    },
    readExplicitSharedInterfaceFont: getExplicitWorkspaceInterfaceFont,
    isLegacyInterfaceFontChecked: hasCheckedAndroidLegacyInterfaceFont,
    markSharedInterfaceFont: interfaceFont => {
      updateWorkspaceSettings({ interfaceFont });
    },
    markLegacyInterfaceFontChecked: markAndroidLegacyInterfaceFontChecked,
    isCommitAllowed,
  });

/**
 * Always commits first render after the bounded settle seam. The window closes
 * synchronously before render, so a read that resolves after timeout cannot write.
 */
export const startAndroidOnboardingContinuity = async (
  settle: AndroidOnboardingSettle,
  commit: () => void,
  run: AndroidOnboardingContinuityRun = runAndroidOnboardingContinuity,
  budgetMs: number = ANDROID_ONBOARDING_CONTINUITY_BUDGET_MS,
): Promise<void> => {
  let importWindowOpen = true;
  try {
    await settle(() => run(() => importWindowOpen), 'unavailable', budgetMs);
  } catch {
    // Rendering is fail-open; the ordinary first-run sheet remains the fallback.
  }
  importWindowOpen = false;
  commit();
};
