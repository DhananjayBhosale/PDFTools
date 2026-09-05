import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  ANDROID_LEGACY_READ_CAPABILITIES,
  parseAndroidLegacyHistorySnapshot,
  parseAndroidLegacySettingsSnapshot,
  type AndroidLegacyHistorySnapshot,
  type AndroidLegacyReadCapabilities,
  type AndroidLegacySettingsSnapshot,
} from './legacyCompatibilityContracts.ts';

export interface AndroidLegacyInspectorNativePlugin {
  readHistory(): Promise<unknown>;
  readSettings(): Promise<unknown>;
}

export const AndroidLegacyInspector =
  registerPlugin<AndroidLegacyInspectorNativePlugin>('AndroidLegacyInspector');

export const isAndroidLegacyInspectorAvailable = (): boolean =>
  Capacitor.getPlatform() === 'android'
  && Capacitor.isPluginAvailable('AndroidLegacyInspector');

export class AndroidLegacyInspectorClient {
  readonly capabilities: AndroidLegacyReadCapabilities = ANDROID_LEGACY_READ_CAPABILITIES;
  private readonly native: AndroidLegacyInspectorNativePlugin;

  constructor(native: AndroidLegacyInspectorNativePlugin = AndroidLegacyInspector) {
    this.native = native;
  }

  async readHistory(): Promise<AndroidLegacyHistorySnapshot> {
    return parseAndroidLegacyHistorySnapshot(await this.native.readHistory());
  }

  async readSettings(): Promise<AndroidLegacySettingsSnapshot> {
    return parseAndroidLegacySettingsSnapshot(await this.native.readSettings());
  }
}
