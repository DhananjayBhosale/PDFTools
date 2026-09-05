package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.Test;

public final class AndroidDocumentSharerTest {
    private static final byte[] PDF = "%PDF-1.7\nshare\n%%EOF".getBytes();
    private static final String AUTHORITY = "com.dhananjaytech.pdfchef.debug.fileprovider";

    @Test public void constructorIsIoFreeAndCancellationDeletesExactUndispatchedStage()
            throws Exception {
        Path files = Files.createTempDirectory("share-stage");
        AndroidDocumentSharer sharer = sharer(files, () -> 10,
                tokens("abcdefghijklmnopqrstuv"), ignored -> {});
        assertEquals(0, Files.list(files).count());
        AndroidDocumentSharer.Stage stage = sharer.prepare(source(PDF), () -> false);
        Path path = sharer.stagedPathForProvider(stage);
        assertEquals(files.resolve("pdfchef_documents/share").toRealPath(),
                path.getParent().toRealPath());
        assertArrayEquals(PDF, Files.readAllBytes(path));
        sharer.cancelBeforeDispatch(stage);
        assertFalse(Files.exists(path));
    }

    @Test public void dispatchedStageSurvivesCancellationUntilExpiry() throws Exception {
        Path files = Files.createTempDirectory("share-dispatched");
        AtomicLong clock = new AtomicLong(10);
        AndroidDocumentSharer sharer = sharer(files, clock::get,
                tokens("abcdefghijklmnopqrstuv"), ignored -> {});
        AndroidDocumentSharer.Stage stage = sharer.prepare(source(PDF), () -> false);
        Path path = sharer.stagedPathForProvider(stage);
        sharer.markDispatched(stage);
        sharer.cancelBeforeDispatch(stage);
        assertTrue(Files.exists(path));

        clock.set(10 + AndroidDocumentSharer.STAGE_EXPIRY_MILLIS + 1);
        AndroidDocumentSharer restarted = sharer(files, clock::get,
                tokens("zyxwvutsrqponmlkjihgfe"), ignored -> {});
        AndroidDocumentSharer.Stage next = restarted.prepare(source(PDF), () -> false);
        assertFalse(Files.exists(path));
        assertTrue(Files.exists(restarted.stagedPathForProvider(next)));
    }

    @Test public void processDeathDuringPreparationIsBusyThenExpires() throws Exception {
        Path files = Files.createTempDirectory("share-crash");
        AtomicLong clock = new AtomicLong(100);
        AndroidDocumentSharer crashing = sharer(files, clock::get,
                tokens("abcdefghijklmnopqrstuv"), checkpoint -> {
                    if (checkpoint == AndroidDocumentSharer.Checkpoint.AFTER_STAGE_MOVE) {
                        throw new AssertionError("simulated process death");
                    }
                });
        try { crashing.prepare(source(PDF), () -> false); fail("Expected process death"); }
        catch (AssertionError expected) { }

        AndroidDocumentSharer restarted = sharer(files, clock::get,
                tokens("zyxwvutsrqponmlkjihgfe"), ignored -> {});
        assertFailure("DOCUMENT_LIMIT_EXCEEDED",
                () -> restarted.prepare(source(PDF), () -> false));
        clock.set(100 + AndroidDocumentSharer.STAGE_EXPIRY_MILLIS + 1);
        assertTrue(restarted.prepare(source(PDF), () -> false).sizeBytes > 0);
    }

    @Test public void retainedStageCountIsExactlyBoundedToEight() throws Exception {
        Path files = Files.createTempDirectory("share-count");
        List<String> values = new ArrayList<>();
        for (int index = 0; index < 9; index++) {
            values.add(String.format("%022d", index + 1));
        }
        AndroidDocumentSharer sharer = sharer(files, () -> 10,
                tokens(values.toArray(String[]::new)), ignored -> {});
        for (int index = 0; index < AndroidDocumentSharer.MAXIMUM_RETAINED_STAGES; index++) {
            sharer.prepare(source(PDF), () -> false);
        }
        assertFailure("DOCUMENT_LIMIT_EXCEEDED",
                () -> sharer.prepare(source(PDF), () -> false));
    }

    @Test public void cancellationAndStorageReserveFailBeforePublishingStage() throws Exception {
        Path files = Files.createTempDirectory("share-low-space");
        AndroidDocumentSharer low = new AndroidDocumentSharer(files, AUTHORITY, () -> 1,
                tokens("abcdefghijklmnopqrstuv"), required -> required - 1, ignored -> {});
        assertFailure("DOCUMENT_STORAGE_FULL", () -> low.prepare(source(PDF), () -> false));
        assertFailure("DOCUMENT_CANCELLED", () -> low.prepare(source(PDF), () -> true));
        Path share = files.resolve("pdfchef_documents/share");
        if (Files.exists(share)) assertEquals(0, Files.list(share).count());
    }

    @Test public void collectionStagesOneBoundedGroupAndCancellationRemovesEveryChild()
            throws Exception {
        Path files = Files.createTempDirectory("share-collection");
        LegacyDocumentOpenResolver.CollectionSource collection = imageCollection(files);
        AndroidDocumentSharer sharer = sharer(files, () -> 10,
                tokens("abcdefghijklmnopqrstuv"), ignored -> {});
        AndroidDocumentSharer.Stage stage = sharer.prepareCollection(collection, () -> false);
        List<Path> paths = sharer.stagedPathsForProvider(stage);
        assertEquals(2, paths.size());
        assertEquals(2, sharer.stagedDisplayNames(stage).size());
        assertArrayEquals(new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff, 1},
                Files.readAllBytes(paths.get(0)));
        assertArrayEquals(new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff, 2},
                Files.readAllBytes(paths.get(1)));
        sharer.cancelBeforeDispatch(stage);
        assertFalse(Files.exists(paths.get(0)));
        assertFalse(Files.exists(paths.get(1)));
    }

    @Test public void dispatchedCollectionSurvivesCancelAndPreparationCancellationCleansGroup()
            throws Exception {
        Path files = Files.createTempDirectory("share-collection-dispatch");
        AndroidDocumentSharer sharer = sharer(files, () -> 10,
                tokens("abcdefghijklmnopqrstuv", "zyxwvutsrqponmlkjihgfe"), ignored -> {});
        AndroidDocumentSharer.Stage stage = sharer.prepareCollection(
                imageCollection(files), () -> false);
        List<Path> paths = sharer.stagedPathsForProvider(stage);
        sharer.markDispatched(stage);
        sharer.cancelBeforeDispatch(stage);
        assertTrue(Files.exists(paths.get(0)));
        assertTrue(Files.exists(paths.get(1)));

        Path cancelledFiles = Files.createTempDirectory("share-collection-cancelled");
        AndroidDocumentSharer cancelled = sharer(cancelledFiles, () -> 10,
                tokens("mnopqrstuvabcdefghijkl"), ignored -> {});
        java.util.concurrent.atomic.AtomicInteger checks = new java.util.concurrent.atomic.AtomicInteger();
        assertFailure("DOCUMENT_CANCELLED", () -> cancelled.prepareCollection(
                imageCollection(cancelledFiles), () -> checks.incrementAndGet() > 4));
        Path root = cancelledFiles.resolve("pdfchef_documents/share");
        if (Files.exists(root)) assertEquals(0, Files.list(root).count());
    }

    private static LegacyDocumentOpenResolver.CollectionSource imageCollection(Path files)
            throws Exception {
        Path processed = files.resolve("processed");
        if (!Files.exists(processed)) Files.createDirectory(processed);
        Path album = processed.resolve("album");
        if (!Files.exists(album)) Files.createDirectory(album);
        byte[] first = new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff, 1};
        byte[] second = new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff, 2};
        Files.write(album.resolve("01.jpg"), first);
        Files.write(album.resolve("02.jpg"), second);
        String index = "[{\"id\":7,\"displayName\":\"Scanned pages\","
                + "\"toolName\":\"PDF_TO_IMAGE\",\"sizeBytes\":8,"
                + "\"createdAtMillis\":1,\"storedFileName\":\"album\","
                + "\"mimeType\":\"image/jpeg\",\"isDirectory\":true,\"itemCount\":2}]";
        Files.writeString(files.resolve("processed_index.json"), index);
        return new LegacyDocumentOpenResolver(files.toFile()).openCollection("a1_7");
    }

    private static AndroidDocumentSharer sharer(Path files, OwnedDocumentWriter.Clock clock,
            OwnedDocumentWriter.TokenSource tokens, AndroidDocumentSharer.FaultInjector faults) {
        return new AndroidDocumentSharer(files, AUTHORITY, clock, tokens,
                required -> required + 1_000_000, faults);
    }

    private static OwnedDocumentWriter.DocumentSource source(byte[] bytes) {
        return new OwnedDocumentWriter.DocumentSource() {
            @Override public String mimeType() { return AndroidDocumentIngressPolicy.MIME_PDF; }
            @Override public long sizeBytes() { return bytes.length; }
            @Override public int read(long offset, byte[] target) {
                if (offset >= bytes.length) return 0;
                int count = Math.min(target.length, bytes.length - (int) offset);
                System.arraycopy(bytes, (int) offset, target, 0, count);
                return count;
            }
        };
    }

    private static OwnedDocumentWriter.TokenSource tokens(String... values) {
        ArrayDeque<String> queue = new ArrayDeque<>(List.of(values));
        return queue::removeFirst;
    }

    private static void assertFailure(String code, ThrowingRunnable action) {
        try { action.run(); fail("Expected " + code); }
        catch (AndroidDocumentSharer.Failure failure) { assertEquals(code, failure.code()); }
        catch (Exception failure) { throw new AssertionError(failure); }
    }

    private interface ThrowingRunnable { void run() throws Exception; }
}
