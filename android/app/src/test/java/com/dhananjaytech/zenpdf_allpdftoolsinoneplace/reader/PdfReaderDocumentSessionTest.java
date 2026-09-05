package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.reader;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.nio.file.attribute.PosixFilePermission;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.Test;

public final class PdfReaderDocumentSessionTest {
    @Test public void stagesOneAtomicReadOnlySnapshotInBoundedWindowsAndClosesIdempotently()
            throws Exception {
        Path files = Files.createTempDirectory("reader-session");
        byte[] pdf = new byte[600_000];
        System.arraycopy("%PDF-1.7\n".getBytes(StandardCharsets.US_ASCII), 0, pdf, 0, 9);
        AtomicInteger reads = new AtomicInteger();
        PdfReaderDocumentSession.Source source = source(pdf, reads);
        PdfReaderDocumentSession session = PdfReaderDocumentSession.prepare(files,
                "d1_abcdefghijklmnopqrstuv", "Scan.pdf", source, () -> 1_000,
                () -> "abcdefghijklmnopqrstuv", required -> required + 1_000_000);

        assertEquals(2, reads.get());
        assertEquals(pdf.length, session.sizeBytes());
        assertEquals("Scan.pdf", session.displayName());
        Path snapshot = session.snapshotForTest();
        assertTrue(Files.isRegularFile(snapshot, LinkOption.NOFOLLOW_LINKS));
        assertArrayEquals(pdf, Files.readAllBytes(snapshot));
        assertEquals(0, Files.list(snapshot.getParent())
                .filter(path -> path.getFileName().toString().endsWith(".part")).count());
        try {
            Set<PosixFilePermission> permissions = Files.getPosixFilePermissions(snapshot);
            assertFalse(permissions.contains(PosixFilePermission.OWNER_WRITE));
        } catch (UnsupportedOperationException ignored) { }
        session.close();
        session.close();
        assertFalse(Files.exists(snapshot, LinkOption.NOFOLLOW_LINKS));
    }

    @Test public void stalePartAndSnapshotAreCleanedButUnsafeChildrenFailClosed()
            throws Exception {
        Path files = Files.createTempDirectory("reader-recovery");
        Path root = Files.createDirectories(files.resolve("pdfchef_documents/reader"));
        Path stale = Files.write(root.resolve("r1_abcdefghijklmnopqrstuv.pdf"),
                "%PDF-old".getBytes(StandardCharsets.US_ASCII));
        Path part = Files.write(root.resolve("r1_zyxwvutsrqponmlkjihgfe.part"), new byte[] {1});
        Files.setLastModifiedTime(stale,
                FileTime.fromMillis(1_000 - PdfReaderDocumentSession.SESSION_EXPIRY_MILLIS));
        PdfReaderDocumentSession session = PdfReaderDocumentSession.prepare(files,
                "a1_7", "Legacy.pdf", source("%PDF-new".getBytes(StandardCharsets.US_ASCII),
                        new AtomicInteger()), () -> 1_000,
                () -> "mnopqrstuvabcdefghijkl", required -> required + 1_000_000);
        assertFalse(Files.exists(stale));
        assertFalse(Files.exists(part));
        session.close();

        Files.createDirectory(root.resolve("nested"));
        assertFailure("DOCUMENT_UNSAFE_STATE", () -> PdfReaderDocumentSession.prepare(files,
                "a1_7", "Legacy.pdf", source("%PDF-new".getBytes(StandardCharsets.US_ASCII),
                        new AtomicInteger()), () -> 2_000,
                () -> "ponmlkjihgfedcbazyxwvu", required -> required + 1_000_000));
    }

    @Test public void interruptionStopsAtWindowBoundaryAndCleansPartialSnapshot()
            throws Exception {
        Path files = Files.createTempDirectory("reader-interrupted");
        byte[] pdf = new byte[PdfReaderDocumentSession.COPY_CHUNK_BYTES + 64];
        System.arraycopy("%PDF-1.7\n".getBytes(StandardCharsets.US_ASCII), 0, pdf, 0, 9);
        AtomicInteger reads = new AtomicInteger();
        PdfReaderDocumentSession.Source source = new PdfReaderDocumentSession.Source() {
            @Override public String mimeType() { return "application/pdf"; }
            @Override public long sizeBytes() { return pdf.length; }
            @Override public int read(long offset, byte[] target) {
                reads.incrementAndGet();
                int count = (int) Math.min(target.length, pdf.length - offset);
                System.arraycopy(pdf, (int) offset, target, 0, count);
                Thread.currentThread().interrupt();
                return count;
            }
        };
        try {
            assertFailure("DOCUMENT_INTERRUPTED", () -> PdfReaderDocumentSession.prepare(files,
                    "d1_abcdefghijklmnopqrstuv", "Scan.pdf", source, () -> 1_000,
                    () -> "abcdefghijklmnopqrstuv", required -> required + 1_000_000));
        } finally {
            Thread.interrupted();
        }

        assertEquals(1, reads.get());
        Path root = files.resolve("pdfchef_documents/reader");
        try (var children = Files.list(root)) {
            assertEquals(0, children.count());
        }
    }

    @Test public void sourceFailureWhileInterruptedIsNormalizedAndCleansPart()
            throws Exception {
        Path files = Files.createTempDirectory("reader-source-interrupted");
        PdfReaderDocumentSession.Source source = new PdfReaderDocumentSession.Source() {
            @Override public String mimeType() { return "application/pdf"; }
            @Override public long sizeBytes() { return 32; }
            @Override public int read(long offset, byte[] target)
                    throws PdfReaderDocumentSession.Failure {
                Thread.currentThread().interrupt();
                throw new PdfReaderDocumentSession.Failure(
                        "DOCUMENT_CORRUPT", "The document could not be validated.");
            }
        };
        try {
            assertFailure("DOCUMENT_INTERRUPTED", () -> PdfReaderDocumentSession.prepare(files,
                    "d1_abcdefghijklmnopqrstuv", "Scan.pdf", source, () -> 1_000,
                    () -> "abcdefghijklmnopqrstuv", required -> required + 1_000_000));
        } finally {
            Thread.interrupted();
        }
        try (var children = Files.list(files.resolve("pdfchef_documents/reader"))) {
            assertEquals(0, children.count());
        }
    }

    @Test public void interruptionImmediatelyBeforeAndAfterAtomicPublishRemovesEveryStage()
            throws Exception {
        for (PdfReaderDocumentSession.Checkpoint checkpoint : new PdfReaderDocumentSession.Checkpoint[] {
                PdfReaderDocumentSession.Checkpoint.BEFORE_ATOMIC_PUBLISH,
                PdfReaderDocumentSession.Checkpoint.AFTER_ATOMIC_PUBLISH,
        }) {
            Path files = Files.createTempDirectory("reader-publish-interrupted");
            try {
                assertFailure("DOCUMENT_INTERRUPTED", () -> PdfReaderDocumentSession.prepare(
                        files, "d1_abcdefghijklmnopqrstuv", "Scan.pdf",
                        source(pdf(), new AtomicInteger()), () -> 1_000,
                        () -> "abcdefghijklmnopqrstuv", required -> required + 1_000_000,
                        observed -> {
                            if (observed == checkpoint) Thread.currentThread().interrupt();
                        }));
            } finally {
                Thread.interrupted();
            }
            try (var children = Files.list(files.resolve("pdfchef_documents/reader"))) {
                assertEquals(checkpoint.name(), 0, children.count());
            }
        }
    }

    @Test public void writableRecoveredFinalIsRejectedAndRemovedBeforeReuse()
            throws Exception {
        Path files = Files.createTempDirectory("reader-writable-recovery");
        Path root = Files.createDirectories(files.resolve("pdfchef_documents/reader"));
        Path writable = Files.write(root.resolve("r1_abcdefghijklmnopqrstuv.pdf"), pdf());
        Files.setLastModifiedTime(writable, FileTime.fromMillis(1_000));
        assertTrue(Files.getPosixFilePermissions(writable)
                .contains(PosixFilePermission.OWNER_WRITE));

        PdfReaderDocumentSession session = PdfReaderDocumentSession.prepare(files,
                "d1_abcdefghijklmnopqrstuv", "Scan.pdf",
                source(pdf(), new AtomicInteger()), () -> 1_000,
                () -> "zyxwvutsrqponmlkjihgfe", required -> required + 1_000_000);
        assertFalse(Files.exists(writable));
        assertFalse(Files.getPosixFilePermissions(session.snapshotForTest())
                .contains(PosixFilePermission.OWNER_WRITE));
        session.close();
    }

    @Test public void closeFailureKeepsSessionOpenAndRetryFsyncsDirectory()
            throws Exception {
        Path files = Files.createTempDirectory("reader-close-retry");
        AtomicBoolean failDelete = new AtomicBoolean();
        AtomicInteger directorySyncs = new AtomicInteger();
        PdfReaderDocumentSession session = PdfReaderDocumentSession.prepare(files,
                "d1_abcdefghijklmnopqrstuv", "Scan.pdf",
                source(pdf(), new AtomicInteger()), () -> 1_000,
                () -> "abcdefghijklmnopqrstuv", required -> required + 1_000_000,
                checkpoint -> {
                    if (checkpoint == PdfReaderDocumentSession.Checkpoint.BEFORE_CLOSE_DELETE
                            && failDelete.get()) throw new java.io.IOException("unlink");
                    if (checkpoint
                            == PdfReaderDocumentSession.Checkpoint.AFTER_CLOSE_DIRECTORY_FSYNC) {
                        directorySyncs.incrementAndGet();
                    }
                });
        Path snapshot = session.snapshotForTest();
        failDelete.set(true);
        try {
            session.close();
            fail("Expected retryable close failure");
        } catch (IllegalStateException expected) {
            assertTrue(Files.exists(snapshot));
        }
        failDelete.set(false);
        session.close();
        assertFalse(Files.exists(snapshot));
        assertEquals(1, directorySyncs.get());
    }

    @Test public void boundedStalePartRecoveryConvergesAcrossExplicitCalls()
            throws Exception {
        Path files = Files.createTempDirectory("reader-recovery-converges");
        Path root = Files.createDirectories(files.resolve("pdfchef_documents/reader"));
        for (int index = 0; index < PdfReaderDocumentSession.RECOVERY_BATCH_LIMIT + 1; index++) {
            Files.write(root.resolve("r1_" + "a".repeat(21) + index + ".part"),
                    new byte[] {1});
        }
        assertFailure("DOCUMENT_LIMIT_EXCEEDED", () -> PdfReaderDocumentSession.prepare(files,
                "d1_abcdefghijklmnopqrstuv", "Scan.pdf",
                source(pdf(), new AtomicInteger()), () -> 1_000,
                () -> "abcdefghijklmnopqrstuv", required -> required + 1_000_000));
        try (var children = Files.list(root)) { assertEquals(0, children.count()); }

        PdfReaderDocumentSession session = PdfReaderDocumentSession.prepare(files,
                "d1_abcdefghijklmnopqrstuv", "Scan.pdf",
                source(pdf(), new AtomicInteger()), () -> 1_000,
                () -> "abcdefghijklmnopqrstuv", required -> required + 1_000_000);
        session.close();
    }

    private static byte[] pdf() {
        return "%PDF-1.7\nreader\n%%EOF".getBytes(StandardCharsets.US_ASCII);
    }

    private static PdfReaderDocumentSession.Source source(byte[] bytes, AtomicInteger reads) {
        return new PdfReaderDocumentSession.Source() {
            @Override public String mimeType() { return "application/pdf"; }
            @Override public long sizeBytes() { return bytes.length; }
            @Override public int read(long offset, byte[] target) {
                reads.incrementAndGet();
                int count = (int) Math.min(target.length, bytes.length - offset);
                if (count <= 0) return 0;
                System.arraycopy(bytes, (int) offset, target, 0, count);
                return count;
            }
        };
    }

    private static void assertFailure(String code, ThrowingRunnable action) {
        try { action.run(); fail("Expected " + code); }
        catch (PdfReaderDocumentSession.Failure failure) { assertEquals(code, failure.code()); }
        catch (Exception failure) { throw new AssertionError(failure); }
    }

    private interface ThrowingRunnable { void run() throws Exception; }
}
