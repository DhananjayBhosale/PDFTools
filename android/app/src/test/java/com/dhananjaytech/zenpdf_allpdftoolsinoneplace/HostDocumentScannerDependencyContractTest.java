package com.dhananjaytech.zenpdf_allpdftoolsinoneplace;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.Test;

/** Scanner-specific dependency contract; generated-component checks live in the verifier. */
public final class HostDocumentScannerDependencyContractTest {
    private static final String SCANNER =
            "com.google.android.gms:play-services-mlkit-document-scanner:16.0.0";
    private static final String DELEGATE =
            "com.google.mlkit.vision.documentscanner.internal.GmsDocumentScanningDelegateActivity";

    @Test public void scannerDependencyIsPinnedOfficialAndUnmodified() throws Exception {
        String build = source("android/app/build.gradle");
        String proguard = source("android/app/proguard-rules.pro");

        assertEquals(1, occurrences(build, SCANNER));
        assertFalse(build.contains("implementation(" + "'" + SCANNER));
        assertFalse(build.contains("exclude group:"));
        assertTrue(proguard.contains("-keepclassmembers class "
                + "com.google.mlkit.common.internal.CommonComponentRegistrar"));
        assertTrue(proguard.contains("public <init>();"));
        assertFalse(proguard.contains("com.google.mlkit.**"));
        assertFalse(proguard.contains("com.google.android.gms.**"));
    }

    @Test public void sourceManifestAddsNoCameraOrStoragePermission()
            throws Exception {
        String manifest = source("android/app/src/main/AndroidManifest.xml");
        assertFalse(manifest.contains("<uses-permission"));
        for (String permission : new String[] {
                "android.permission.CAMERA", "android.permission.READ_EXTERNAL_STORAGE",
                "android.permission.WRITE_EXTERNAL_STORAGE",
                "android.permission.MANAGE_EXTERNAL_STORAGE"}) {
            assertFalse(permission, manifest.contains(permission));
        }
    }

    private static int occurrences(String source, String value) {
        int count = 0;
        for (int at = 0; (at = source.indexOf(value, at)) >= 0; at += value.length()) count++;
        return count;
    }

    private static String source(String relative) throws Exception {
        Path directory = Path.of(System.getProperty("user.dir")).toAbsolutePath();
        while (directory != null) {
            Path file = directory.resolve(relative);
            if (Files.isRegularFile(file)) {
                return new String(Files.readAllBytes(file), StandardCharsets.UTF_8);
            }
            directory = directory.getParent();
        }
        throw new AssertionError("Could not locate source: " + relative);
    }
}
