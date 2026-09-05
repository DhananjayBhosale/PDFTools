package com.dhananjaytech.zenpdf_allpdftoolsinoneplace;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Inactive storage-statistics bridge; registration is deliberately owned by a later gate. */
@CapacitorPlugin(name = "AndroidStorageStats")
public final class AndroidStorageStatsPlugin extends Plugin {
    @PluginMethod
    public void getStorageStats(PluginCall call) {
        JSObject request = call.getData();
        if (request == null || request.length() != 0) {
            call.reject("The storage stats request is invalid.", "STORAGE_STATS_INVALID_ARGUMENT");
            return;
        }
        try {
            AndroidStorageStatsCalculator.StorageStats stats = new AndroidStorageStatsCalculator()
                    .calculate(getContext().getFilesDir().toPath());
            JSObject output = new JSObject();
            output.put("retainedBytes", stats.retainedBytes());
            output.put("availableBytes", stats.availableBytes());
            output.put("capacityBytes", stats.capacityBytes());
            call.resolve(output);
        } catch (Exception ignored) {
            call.reject("Storage statistics are unavailable.", "STORAGE_STATS_FAILED");
        }
    }
}
