package com.dhananjaytech.zenpdf_allpdftoolsinoneplace;

import android.app.Application;
import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents.DocumentLifecycleCoordinator;
import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy.LegacyMutationCoordinator;

/** Allocates the sole writer coordinator; construction deliberately performs no storage I/O. */
public final class PdfChefApplication extends Application {
    private final LegacyMutationCoordinator legacyMutationCoordinator = new LegacyMutationCoordinator();
    private final DocumentLifecycleCoordinator documentLifecycleCoordinator =
            new DocumentLifecycleCoordinator(this);
    public LegacyMutationCoordinator getLegacyMutationCoordinator() { return legacyMutationCoordinator; }
    public DocumentLifecycleCoordinator getDocumentLifecycleCoordinator() {
        return documentLifecycleCoordinator;
    }
}
