package com.dhananjaytech.zenpdf_allpdftoolsinoneplace;

import android.app.Service;
import android.content.Intent;
import android.os.Binder;
import android.os.IBinder;
import android.os.Parcel;
import android.os.RemoteException;
import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy.LegacyMutationCoordinator;
import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy.LegacyThemeCrashController;

/** Debug-only, non-exported remote-process entry point for one bounded crash transaction. */
public final class LegacyThemeCrashService extends Service {
    private static final String DESCRIPTOR =
            "com.dhananjaytech.zenpdf_allpdftoolsinoneplace.LegacyThemeCrashService";
    private static final int TRANSACTION_CRASH = IBinder.FIRST_CALL_TRANSACTION;

    private final Binder binder = new Binder() {
        @Override
        protected boolean onTransact(int code, Parcel data, Parcel reply, int flags)
                throws RemoteException {
            if (code != TRANSACTION_CRASH) return super.onTransact(code, data, reply, flags);
            data.enforceInterface(DESCRIPTOR);
            String stage = data.readString();
            if (data.dataAvail() != 0) throw new SecurityException("INVALID_CRASH_REQUEST");

            PdfChefApplication application = (PdfChefApplication) getApplication();
            LegacyThemeCrashController controller =
                    application.getLegacyThemeCrashController();
            controller.arm(stage);
            try {
                LegacyMutationCoordinator coordinator =
                        application.getLegacyMutationCoordinator();
                coordinator.setThemeMode(application.getFilesDir(), "DARK");
            } catch (LegacyMutationCoordinator.Failure failure) {
                throw new IllegalStateException("CRASH_WRITE_FAILED");
            }
            throw new IllegalStateException("CRASH_PROCESS_SURVIVED");
        }
    };

    @Override
    public IBinder onBind(Intent intent) {
        if (intent == null || intent.getComponent() == null
                || !getPackageName().equals(intent.getComponent().getPackageName())
                || !getClass().getName().equals(intent.getComponent().getClassName())) {
            throw new SecurityException("INVALID_CRASH_BIND");
        }
        return binder;
    }
}
