package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.scanner;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.junit.Test;

public final class AndroidDocumentScannerImporterTest {
    @Test public void streamsPdfInBoundedChunksAndReturnsTheCommittedOwnedItem()
            throws Exception {
        byte[] bytes = new byte[AndroidDocumentScannerImporter.MAXIMUM_CHUNK_BYTES + 31];
        Arrays.fill(bytes, (byte) 'x');
        byte[] prefix = "%PDF-1.7\n".getBytes(StandardCharsets.US_ASCII);
        System.arraycopy(prefix, 0, bytes, 0, prefix.length);
        FakeWriter writer = new FakeWriter();

        AndroidDocumentScannerImporter.OwnedItem item =
                new AndroidDocumentScannerImporter(writer)
                        .importPdf(new ByteArrayInputStream(bytes), () -> false);

        assertEquals(2, writer.appendCount);
        assertEquals(AndroidDocumentScannerImporter.MAXIMUM_CHUNK_BYTES,
                writer.maximumAppendBytes);
        assertArrayEquals(bytes, writer.bytes.toByteArray());
        assertFalse(writer.aborted);
        assertTrue(item.ref().startsWith("d1_"));
        assertEquals("Scanned document.pdf", item.displayName());
        assertEquals("application/pdf", item.mimeType());
        assertEquals(bytes.length, item.sizeBytes());
    }

    @Test public void cancellationBeforeBeginDoesNotCreateAWriteSession() throws Exception {
        FakeWriter writer = new FakeWriter();
        assertFailure(AndroidDocumentScannerImporter.Code.INTERRUPTED,
                () -> new AndroidDocumentScannerImporter(writer).importPdf(
                        new ByteArrayInputStream(pdf()), () -> true));
        assertFalse(writer.begun);
        assertFalse(writer.aborted);
    }

    @Test public void cancellationAfterPartialCopyAbortsTheExactSession() throws Exception {
        FakeWriter writer = new FakeWriter();
        int[] checks = {0};
        assertFailure(AndroidDocumentScannerImporter.Code.INTERRUPTED,
                () -> new AndroidDocumentScannerImporter(writer).importPdf(
                        new ByteArrayInputStream(pdf()), () -> ++checks[0] >= 3));
        assertTrue(writer.begun);
        assertTrue(writer.aborted);
        assertEquals(FakeWriter.SESSION, writer.abortedSession);
    }

    @Test public void emptyAndUnreadableSourcesAbortWithoutLeakingDetails() throws Exception {
        for (InputStream input : new InputStream[] {
                new ByteArrayInputStream(new byte[0]),
                new InputStream() {
                    @Override public int read() throws IOException { throw new IOException("private"); }
                    @Override public int read(byte[] bytes) throws IOException {
                        throw new IOException("private");
                    }
                },
        }) {
            FakeWriter writer = new FakeWriter();
            try {
                new AndroidDocumentScannerImporter(writer).importPdf(input, () -> false);
                fail("expected scanner import failure");
            } catch (AndroidDocumentScannerImporter.Failure failure) {
                assertTrue(failure.code() == AndroidDocumentScannerImporter.Code.INVALID_RESULT
                        || failure.code() == AndroidDocumentScannerImporter.Code.IMPORT_FAILED);
                assertEquals(null, failure.getMessage());
            }
            assertTrue(writer.aborted);
        }
    }

    @Test public void partialAcceptanceAndWriterFailuresAbortTheSession() throws Exception {
        FakeWriter partial = new FakeWriter();
        partial.partialAppend = true;
        assertFailure(AndroidDocumentScannerImporter.Code.IMPORT_FAILED,
                () -> new AndroidDocumentScannerImporter(partial).importPdf(
                        new ByteArrayInputStream(pdf()), () -> false));
        assertTrue(partial.aborted);

        FakeWriter full = new FakeWriter();
        full.appendFailure = new AndroidDocumentScannerImporter.Failure(
                AndroidDocumentScannerImporter.Code.STORAGE_FULL);
        assertFailure(AndroidDocumentScannerImporter.Code.STORAGE_FULL,
                () -> new AndroidDocumentScannerImporter(full).importPdf(
                        new ByteArrayInputStream(pdf()), () -> false));
        assertTrue(full.aborted);
    }

    @Test public void sourceAboveTheOwnedLimitStopsAndAborts() throws Exception {
        FakeWriter writer = new FakeWriter();
        InputStream oversized = new RepeatedInputStream(
                AndroidDocumentScannerImporter.MAXIMUM_FILE_BYTES + 1);
        assertFailure(AndroidDocumentScannerImporter.Code.LIMIT_EXCEEDED,
                () -> new AndroidDocumentScannerImporter(writer)
                        .importPdf(oversized, () -> false));
        assertTrue(writer.aborted);
        assertEquals(AndroidDocumentScannerImporter.MAXIMUM_FILE_BYTES,
                writer.acceptedBytes);
    }

    @Test public void repeatedZeroLengthReadsFailBoundedlyAndAbort() throws Exception {
        FakeWriter writer = new FakeWriter();
        InputStream stalled = new InputStream() {
            @Override public int read() { return 0; }
            @Override public int read(byte[] bytes) { return 0; }
            @Override public int read(byte[] bytes, int offset, int length) { return 0; }
        };
        assertFailure(AndroidDocumentScannerImporter.Code.IMPORT_FAILED,
                () -> new AndroidDocumentScannerImporter(writer)
                        .importPdf(stalled, () -> false));
        assertTrue(writer.aborted);
    }

    @Test public void fragmentedProviderReadsAreCoalescedIntoBoundedAppendWindows()
            throws Exception {
        byte[] bytes = new byte[AndroidDocumentScannerImporter.MAXIMUM_CHUNK_BYTES + 17];
        Arrays.fill(bytes, (byte) 'x');
        System.arraycopy("%PDF-1.7\n".getBytes(StandardCharsets.US_ASCII), 0, bytes, 0, 9);
        InputStream fragmented = new InputStream() {
            private int offset;
            @Override public int read() {
                return offset == bytes.length ? -1 : bytes[offset++] & 0xff;
            }
            @Override public int read(byte[] target, int targetOffset, int length) {
                if (offset == bytes.length) return -1;
                int count = Math.min(Math.min(length, 7), bytes.length - offset);
                System.arraycopy(bytes, offset, target, targetOffset, count);
                offset += count;
                return count;
            }
        };
        FakeWriter writer = new FakeWriter();

        new AndroidDocumentScannerImporter(writer).importPdf(fragmented, () -> false);

        assertEquals(2, writer.appendCount);
        assertEquals(AndroidDocumentScannerImporter.MAXIMUM_CHUNK_BYTES,
                writer.maximumAppendBytes);
        assertArrayEquals(bytes, writer.bytes.toByteArray());
    }

    private static byte[] pdf() {
        return "%PDF-1.7\nscanner\n%%EOF".getBytes(StandardCharsets.US_ASCII);
    }

    private static void assertFailure(AndroidDocumentScannerImporter.Code code,
            ThrowingRunnable operation) throws Exception {
        try {
            operation.run();
            fail("expected scanner import failure");
        } catch (AndroidDocumentScannerImporter.Failure failure) {
            assertEquals(code, failure.code());
        }
    }

    private interface ThrowingRunnable { void run() throws Exception; }

    private static final class FakeWriter implements AndroidDocumentScannerImporter.Writer {
        static final String SESSION = "w1_AAAAAAAAAAAAAAAAAAAAAA";
        final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        boolean begun;
        boolean aborted;
        String abortedSession;
        boolean partialAppend;
        AndroidDocumentScannerImporter.Failure appendFailure;
        int appendCount;
        int maximumAppendBytes;
        long acceptedBytes;

        @Override public String begin() {
            begun = true;
            return SESSION;
        }

        @Override public int append(String sessionRef, byte[] chunk,
                AndroidDocumentScannerImporter.CancellationSignal cancellation)
                throws AndroidDocumentScannerImporter.Failure {
            assertEquals(SESSION, sessionRef);
            if (appendFailure != null) throw appendFailure;
            appendCount++;
            maximumAppendBytes = Math.max(maximumAppendBytes, chunk.length);
            acceptedBytes += chunk.length;
            if (acceptedBytes <= 2L * AndroidDocumentScannerImporter.MAXIMUM_CHUNK_BYTES) {
                bytes.write(chunk, 0, chunk.length);
            }
            return partialAppend ? chunk.length - 1 : chunk.length;
        }

        @Override public AndroidDocumentScannerImporter.OwnedItem finish(String sessionRef,
                AndroidDocumentScannerImporter.CancellationSignal cancellation) {
            return new AndroidDocumentScannerImporter.OwnedItem(
                    "d1_AAAAAAAAAAAAAAAAAAAAAA", "Scanned document.pdf", "application/pdf",
                    acceptedBytes, "a".repeat(64), 1);
        }

        @Override public boolean abort(String sessionRef) {
            aborted = true;
            abortedSession = sessionRef;
            return true;
        }
    }

    private static final class RepeatedInputStream extends InputStream {
        private long remaining;
        RepeatedInputStream(long remaining) { this.remaining = remaining; }
        @Override public int read() {
            if (remaining == 0) return -1;
            remaining--;
            return 'x';
        }
        @Override public int read(byte[] bytes) {
            if (remaining == 0) return -1;
            int count = (int) Math.min(remaining, bytes.length);
            Arrays.fill(bytes, 0, count, (byte) 'x');
            remaining -= count;
            return count;
        }
        @Override public int read(byte[] bytes, int offset, int length) {
            if (remaining == 0) return -1;
            int count = (int) Math.min(remaining, length);
            Arrays.fill(bytes, offset, offset + count, (byte) 'x');
            remaining -= count;
            return count;
        }
    }
}
