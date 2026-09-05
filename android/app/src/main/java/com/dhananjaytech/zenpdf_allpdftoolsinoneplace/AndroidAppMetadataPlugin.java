package com.dhananjaytech.zenpdf_allpdftoolsinoneplace;

import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

/** Inactive public application-metadata bridge; registration is deliberately owned by a later gate. */
@CapacitorPlugin(name = "AndroidAppMetadata")
public final class AndroidAppMetadataPlugin extends Plugin {
    @PluginMethod
    public void getMetadata(PluginCall call) {
        JSObject request = call.getData();
        if (request == null || request.length() != 0) {
            call.reject("The application metadata request is invalid.", "APP_METADATA_INVALID_ARGUMENT");
            return;
        }
        try {
            PackageManager packageManager = getContext().getPackageManager();
            PackageInfo packageInfo = packageManager.getPackageInfo(getContext().getPackageName(), 0);
            String name = validPublicValue(packageInfo.applicationInfo.loadLabel(packageManager));
            String version = validPublicValue(packageInfo.versionName);
            if (name == null || version == null) {
                unavailable(call);
                return;
            }
            JSObject output = new JSObject();
            output.put("name", name);
            output.put("version", version);
            String build = publicBuild(packageInfo);
            output.put("build", build == null ? JSONObject.NULL : build);
            call.resolve(output);
        } catch (Exception ignored) {
            unavailable(call);
        }
    }

    private static String validPublicValue(CharSequence value) {
        if (value == null) return null;
        String text = value.toString();
        return text.isBlank() || text.indexOf('\0') >= 0 ? null : text;
    }

    private static String publicBuild(PackageInfo packageInfo) {
        long versionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? packageInfo.getLongVersionCode() : packageInfo.versionCode;
        return versionCode < 0 ? null : Long.toString(versionCode);
    }

    private static void unavailable(PluginCall call) {
        call.reject("Application metadata is unavailable.", "APP_METADATA_UNAVAILABLE");
    }
}
