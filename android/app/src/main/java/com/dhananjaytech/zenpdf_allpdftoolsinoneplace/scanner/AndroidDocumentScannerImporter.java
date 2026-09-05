package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.scanner;

import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents.AndroidDocumentIngressPolicy;
import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents.DocumentLifecycleCoordinator;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.Objects;

/** Streams one native scanner PDF into the sole owned-document lifecycle. */
final class AndroidDocumentScannerImporter {
    static final int MAXIMUM_CHUNK_BYTES = 524_288;
    static final long MAXIMUM_FILE_BYTES = 128L * 1024L * 1024L;
    private static final int MAXIMUM_EMPTY_READS = 8;
    private static final String DISPLAY_NAME = "Scanned document.pdf";

    interface CancellationSignal { boolean isCancelled(); }

    interface Writer {
        String begin() throws Failure;
        int append(String sessionRef, byte[] bytes, CancellationSignal cancellation)
                throws Failure;
        OwnedItem finish(String sessionRef, CancellationSignal cancellation) throws Failure;
        boolean abort(String sessionRef) throws Failure;
    }

    enum Code { INVALID_RESULT, STORAGE_FULL, LIMIT_EXCEEDED, INTERRUPTED, IMPORT_FAILED }

    static final class Failure extends Exception {
        private final Code code;
        Failure(Code code) { this.code = Objects.requireNonNull(code); }
        Code code() { return code; }
    }

    static final class OwnedItem {
        private final String ref;
        private final String displayName;
        private final String mimeType;
        private final long sizeBytes;
        private final String contentHash;
        private final long createdAtMillis;

        OwnedItem(String ref, String displayName, String mimeType, long sizeBytes,
                String contentHash, long createdAtMillis) {
            this.ref = Objects.requireNonNull(ref);
            this.displayName = Objects.requireNonNull(displayName);
            this.mimeType = Objects.requireNonNull(mimeType);
            this.sizeBytes = sizeBytes;
            this.contentHash = Objects.requireNonNull(contentHash);
            this.createdAtMillis = createdAtMillis;
        }

        String ref() { return ref; }
        String displayName() { return displayName; }
        String mimeType() { return mimeType; }
        long sizeBytes() { return sizeBytes; }
        String contentHash() { return contentHash; }
        long createdAtMillis() { return createdAtMillis; }
    }

    private final Writer writer;

    AndroidDocumentScannerImporter(Writer writer) {
        this.writer = Objects.requireNonNull(writer);
    }

    static AndroidDocumentScannerImporter forCoordinator(
            DocumentLifecycleCoordinator coordinator) {
        Objects.requireNonNull(coordinator);
        return new AndroidDocumentScannerImporter(new Writer() {
            @Override public String begin() throws Failure {
                try {
                    return coordinator.beginWrite(DISPLAY_NAME,
                            AndroidDocumentIngressPolicy.MIME_PDF).sessionId();
                } catch (DocumentLifecycleCoordinator.Failure failure) {
                    throw map(failure);
                }
            }

            @Override public int append(String sessionRef, byte[] bytes,
                    CancellationSignal cancellation) throws Failure {
                try {
                    return coordinator.appendWrite(sessionRef, bytes,
                            () -> cancellation.isCancelled());
                } catch (DocumentLifecycleCoordinator.Failure failure) {
                    throw map(failure);
                }
            }

            @Override public OwnedItem finish(String sessionRef,
                    CancellationSignal cancellation) throws Failure {
                try {
                    DocumentLifecycleCoordinator.DocumentRecord record =
                            coordinator.finishWrite(sessionRef,
                                    () -> cancellation.isCancelled());
                    return new OwnedItem(record.ref(), record.displayName(), record.mimeType(),
                            record.sizeBytes(), record.contentHash(), record.createdAtMillis());
                } catch (DocumentLifecycleCoordinator.Failure failure) {
                    throw map(failure);
                }
            }

            @Override public boolean abort(String sessionRef) throws Failure {
                try {
                    return coordinator.abortWrite(sessionRef);
                } catch (DocumentLifecycleCoordinator.Failure failure) {
                    throw map(failure);
                }
            }
        });
    }

    OwnedItem importPdf(InputStream input, CancellationSignal cancellation) throws Failure {
        if (input == null || cancellation == null) throw new Failure(Code.INVALID_RESULT);
        checkCancelled(cancellation);
        String sessionRef = null;
        boolean committed = false;
        try {
            sessionRef = writer.begin();
            if (sessionRef == null || sessionRef.length() == 0) {
                throw new Failure(Code.IMPORT_FAILED);
            }

            byte[] buffer = new byte[MAXIMUM_CHUNK_BYTES];
            long total = 0;
            int emptyReads = 0;
            int buffered = 0;
            while (true) {
                checkCancelled(cancellation);
                int read = input.read(buffer, buffered, buffer.length - buffered);
                if (read < 0) {
                    if (buffered > 0) {
                        checkCancelled(cancellation);
                        byte[] chunk = Arrays.copyOf(buffer, buffered);
                        if (writer.append(sessionRef, chunk, cancellation) != buffered) {
                            throw new Failure(Code.IMPORT_FAILED);
                        }
                    }
                    break;
                }
                if (read == 0) {
                    if (++emptyReads > MAXIMUM_EMPTY_READS) {
                        throw new Failure(Code.IMPORT_FAILED);
                    }
                    continue;
                }
                emptyReads = 0;
                if (total > MAXIMUM_FILE_BYTES - read) {
                    throw new Failure(Code.LIMIT_EXCEEDED);
                }
                total += read;
                buffered += read;
                if (buffered == buffer.length) {
                    checkCancelled(cancellation);
                    byte[] chunk = buffer.clone();
                    if (writer.append(sessionRef, chunk, cancellation) != buffered) {
                        throw new Failure(Code.IMPORT_FAILED);
                    }
                    buffered = 0;
                }
            }
            checkCancelled(cancellation);
            if (total == 0) throw new Failure(Code.INVALID_RESULT);
            OwnedItem item = writer.finish(sessionRef, cancellation);
            if (!isCanonicalCompletedItem(item, total)) {
                throw new Failure(Code.IMPORT_FAILED);
            }
            committed = true;
            return item;
        } catch (Failure failure) {
            throw failure;
        } catch (IOException | RuntimeException failure) {
            throw new Failure(Code.IMPORT_FAILED);
        } finally {
            if (sessionRef != null && !committed) {
                try { writer.abort(sessionRef); } catch (Failure ignored) { }
            }
        }
    }

    private static boolean isCanonicalCompletedItem(OwnedItem item, long expectedSize) {
        return item != null
                && item.ref().matches("d1_[A-Za-z0-9_-]{22,64}")
                && DISPLAY_NAME.equals(item.displayName())
                && AndroidDocumentIngressPolicy.MIME_PDF.equals(item.mimeType())
                && item.sizeBytes() == expectedSize
                && item.contentHash().matches("[0-9a-f]{64}")
                && item.createdAtMillis() >= 0;
    }

    private static void checkCancelled(CancellationSignal cancellation) throws Failure {
        if (Thread.currentThread().isInterrupted() || cancellation.isCancelled()) {
            throw new Failure(Code.INTERRUPTED);
        }
    }

    private static Failure map(DocumentLifecycleCoordinator.Failure failure) {
        if ("DOCUMENT_STORAGE_FULL".equals(failure.code())) {
            return new Failure(Code.STORAGE_FULL);
        }
        if ("DOCUMENT_LIMIT_EXCEEDED".equals(failure.code())) {
            return new Failure(Code.LIMIT_EXCEEDED);
        }
        if ("DOCUMENT_INTERRUPTED".equals(failure.code())
                || "DOCUMENT_CANCELLED".equals(failure.code())) {
            return new Failure(Code.INTERRUPTED);
        }
        return new Failure(Code.IMPORT_FAILED);
    }
}
