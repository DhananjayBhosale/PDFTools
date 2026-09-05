package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.scanner;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.Test;

public final class AndroidDocumentScannerResultSourceTest {
    @Test public void officialPrivateCacheFilesStreamAndAreDeletedInFinally()
            throws Exception {
        Path cache = Files.createTempDirectory("scanner-cache");
        Path staging = Files.createDirectory(cache.resolve("mlkit_docscan_ui_client"));
        Path pdf = Files.write(staging.resolve("scan.pdf"), pdf());
        Path jpegOne = Files.write(staging.resolve("page-1.jpg"), new byte[] {1, 2});
        Path jpegTwo = Files.write(staging.resolve("page-2.jpg"), new byte[] {3, 4});

        AndroidDocumentScannerResultSource.Batch batch =
                AndroidDocumentScannerResultSource.resolve(cache, pdf.toUri().toString(),
                        List.of(jpegOne.toUri().toString(), jpegTwo.toUri().toString()));
        assertEquals(3, batch.trustedFileCount());
        try (InputStream input = batch.openPdf(() -> {
            throw new AssertionError("content opener must not be used");
        })) {
            assertArrayEquals(pdf(), input.readAllBytes());
        } finally {
            batch.close();
        }

        assertFalse(Files.exists(pdf));
        assertFalse(Files.exists(jpegOne));
        assertFalse(Files.exists(jpegTwo));
    }

    @Test public void contentResultsStreamWithoutDeletingProviderData() throws Exception {
        byte[] bytes = pdf();
        AndroidDocumentScannerResultSource.Batch batch =
                AndroidDocumentScannerResultSource.resolve(
                        Files.createTempDirectory("scanner-content"),
                        "content://scanner.private/result.pdf",
                        List.of("content://scanner.private/page-1.jpg"));
        assertEquals(0, batch.trustedFileCount());
        try (InputStream input = batch.openPdf(() -> new ByteArrayInputStream(bytes))) {
            assertArrayEquals(bytes, input.readAllBytes());
        } finally {
            batch.close();
        }
    }

    @Test public void traversalOutsideCacheAndSymlinksAreRejectedWithoutDeletion()
            throws Exception {
        Path outer = Files.createTempDirectory("scanner-unsafe");
        Path cache = Files.createDirectory(outer.resolve("cache"));
        Path staging = Files.createDirectory(cache.resolve("mlkit_docscan_ui_client"));
        Path outside = Files.write(outer.resolve("outside.pdf"), pdf());
        Path link = staging.resolve("linked.pdf");
        Files.createSymbolicLink(link, outside);

        assertFailure(AndroidDocumentScannerResultSource.Code.INVALID_RESULT,
                () -> AndroidDocumentScannerResultSource.resolve(cache,
                        outside.toUri().toString(), List.of("content://scanner/page.jpg")));
        assertFailure(AndroidDocumentScannerResultSource.Code.INVALID_RESULT,
                () -> AndroidDocumentScannerResultSource.resolve(cache,
                        link.toUri().toString(), List.of("content://scanner/page.jpg")));
        assertFailure(AndroidDocumentScannerResultSource.Code.INVALID_RESULT,
                () -> AndroidDocumentScannerResultSource.resolve(cache,
                        "file://" + staging + "/../outside.pdf",
                        List.of("content://scanner/page.jpg")));
        assertTrue(Files.exists(outside));
        assertTrue(Files.isSymbolicLink(link));
    }

    @Test public void validationFailureStillDeletesEarlierTrustedMlKitFiles()
            throws Exception {
        Path cache = Files.createTempDirectory("scanner-partial-cleanup");
        Path staging = Files.createDirectory(cache.resolve("mlkit_docscan_ui_client"));
        Path pdf = Files.write(staging.resolve("scan.pdf"), pdf());
        Path outside = Files.write(cache.resolve("outside.jpg"), new byte[] {1});

        assertFailure(AndroidDocumentScannerResultSource.Code.INVALID_RESULT,
                () -> AndroidDocumentScannerResultSource.resolve(cache,
                        pdf.toUri().toString(), List.of(outside.toUri().toString())));
        assertFalse(Files.exists(pdf));
        assertTrue(Files.exists(outside));
    }

    private static byte[] pdf() {
        return "%PDF-1.7\nscanner\n%%EOF".getBytes(StandardCharsets.US_ASCII);
    }

    private static void assertFailure(AndroidDocumentScannerResultSource.Code expected,
            ThrowingRunnable operation) throws Exception {
        try {
            operation.run();
            fail("Expected " + expected);
        } catch (AndroidDocumentScannerResultSource.Failure failure) {
            assertEquals(expected, failure.code());
            assertEquals(null, failure.getMessage());
        }
    }

    private interface ThrowingRunnable { void run() throws Exception; }
}
