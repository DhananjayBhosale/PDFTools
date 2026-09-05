package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Deliberately read-only bridge; all parsing remains in pure JVM inspectors. */
@CapacitorPlugin(name = "AndroidLegacyInspector")
public final class AndroidLegacyInspectorPlugin extends Plugin {
    @PluginMethod
    public void readHistory(PluginCall call) {
        try {
            call.resolve(new com.getcapacitor.JSObject(new LegacyHistoryInspector(getContext().getFilesDir()).read().toString()));
        } catch (Exception ignored) {
            call.reject("Legacy history could not be read.", "LEGACY_HISTORY_READ_FAILED");
        }
    }

    @PluginMethod
    public void readSettings(PluginCall call) {
        try {
            call.resolve(new com.getcapacitor.JSObject(new LegacySettingsInspector(getContext().getFilesDir()).read().toString()));
        } catch (Exception ignored) {
            call.reject("Legacy settings could not be read.", "LEGACY_SETTINGS_READ_FAILED");
        }
    }
}
