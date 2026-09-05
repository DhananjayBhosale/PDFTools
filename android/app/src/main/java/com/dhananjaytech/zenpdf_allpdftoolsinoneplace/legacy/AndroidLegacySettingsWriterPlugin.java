package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy;

import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.PdfChefApplication;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AndroidLegacySettingsWriter")
public final class AndroidLegacySettingsWriterPlugin extends Plugin {
    @PluginMethod
    public void setThemeMode(PluginCall call) {
        try {
            JSObject data = call.getData();
            if (data == null || data.length() != 1 || !data.has("mode")) {
                call.reject("Invalid theme mode.", "LEGACY_THEME_INVALID_ARGUMENT");
                return;
            }
            Object rawMode = data.get("mode");
            if (!(rawMode instanceof String)) {
                call.reject("Invalid theme mode.", "LEGACY_THEME_INVALID_ARGUMENT");
                return;
            }
            String mode = (String) rawMode;
            if (!("SYSTEM".equals(mode) || "DYNAMIC".equals(mode)
                    || "LIGHT".equals(mode) || "DARK".equals(mode))) {
                call.reject("Invalid theme mode.", "LEGACY_THEME_INVALID_ARGUMENT");
                return;
            }

            PdfChefApplication application =
                    (PdfChefApplication) getContext().getApplicationContext();
            LegacyMutationCoordinator.Result result = application.getLegacyMutationCoordinator()
                    .setThemeMode(application.getFilesDir(), mode);
            JSObject output = new JSObject();
            output.put("mode", result.mode);
            output.put("changed", result.changed);
            call.resolve(output);
        } catch (LegacyMutationCoordinator.Failure failure) {
            call.reject("Theme update could not be completed.", failure.code);
        } catch (Exception ignored) {
            call.reject("Theme update could not be completed.",
                    "LEGACY_THEME_WRITE_FAILED");
        }
    }
}
