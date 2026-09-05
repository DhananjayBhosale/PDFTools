package com.dhananjaytech.zenpdf_allpdftoolsinoneplace;

import android.app.Application;
import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents.DocumentLifecycleCoordinator;
import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy.LegacyMutationCoordinator;
import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy.LegacyThemeCrashController;

/** Debug process owner for the real writer coordinator and its initially disarmed crash I/O. */
public final class PdfChefApplication extends Application {
    private final LegacyThemeCrashController legacyThemeCrashController =
            new LegacyThemeCrashController();
    private final LegacyMutationCoordinator legacyMutationCoordinator =
            legacyThemeCrashController.createCoordinator();
    private final DocumentLifecycleCoordinator documentLifecycleCoordinator =
            new DocumentLifecycleCoordinator(this);

    public LegacyMutationCoordinator getLegacyMutationCoordinator() {
        return legacyMutationCoordinator;
    }

    public DocumentLifecycleCoordinator getDocumentLifecycleCoordinator() {
        return documentLifecycleCoordinator;
    }

    LegacyThemeCrashController getLegacyThemeCrashController() {
        return legacyThemeCrashController;
    }
}
