package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.FileTime;
import java.util.Arrays;
import java.util.Objects;

/** Package-private path reader. Public callers can read only through an opaque legacy ref. */
public final class BoundedDocumentReader {
    public static final int MAXIMUM_CHUNK_BYTES = 524_288;
    static final long MAXIMUM_SAFE_OFFSET = 9_007_199_254_740_991L;

    private final ReadObserver observer;

    public BoundedDocumentReader() {
        this(checkpoint -> {});
    }

    BoundedDocumentReader(ReadObserver observer) {
        this.observer = Objects.requireNonNull(observer);
    }

    Identity identity(Path path) throws IOException, UnsafeReadException {
        return Identity.capture(path);
    }

    Chunk read(Path path, Identity expected, long offset, int length)
            throws IOException, UnsafeReadException {
        if (path == null || expected == null || offset < 0 || offset > MAXIMUM_SAFE_OFFSET
                || length < 1 || length > MAXIMUM_CHUNK_BYTES) {
            throw new IllegalArgumentException("Invalid bounded read");
        }
        BasicFileAttributes before;
        try {
            before = attributes(path);
            requireRegular(before, path);
            expected.requireSame(before);
            observer.checkpoint(Checkpoint.AFTER_PRECHECK);
            try (FileChannel channel = FileChannel.open(
                    path, StandardOpenOption.READ, LinkOption.NOFOLLOW_LINKS)) {
                BasicFileAttributes afterOpen = attributes(path);
                expected.requireSame(afterOpen);
                observer.checkpoint(Checkpoint.AFTER_OPEN);
                long size = channel.size();
                if (size < 0 || size > MAXIMUM_SAFE_OFFSET || size != expected.size) {
                    throw new UnsafeReadException();
                }
                if (offset > size) throw new IllegalArgumentException("Offset beyond end");
                int requested = (int) Math.min((long) length, size - offset);
                byte[] bytes = readExactWindow(channel, offset, requested);
                observer.checkpoint(Checkpoint.AFTER_READ);
                BasicFileAttributes afterRead = attributes(path);
                expected.requireSame(afterRead);
                long nextOffset = offset + bytes.length;
                return new Chunk(bytes, nextOffset, nextOffset == size);
            }
        } catch (NoSuchFileException disappeared) {
            throw new UnsafeReadException(disappeared);
        }
    }

    private static byte[] readExactWindow(FileChannel channel, long offset, int requested)
            throws IOException, UnsafeReadException {
        channel.position(offset);
        ByteBuffer buffer = ByteBuffer.allocate(Math.min(requested, 64 * 1024));
        ByteArrayOutputStream output = new ByteArrayOutputStream(requested);
        int remaining = requested;
        while (remaining > 0) {
            buffer.clear();
            buffer.limit(Math.min(buffer.capacity(), remaining));
            int read = channel.read(buffer);
            if (read < 0) throw new UnsafeReadException();
            if (read == 0) continue;
            output.write(buffer.array(), 0, read);
            remaining -= read;
        }
        return output.toByteArray();
    }

    private static BasicFileAttributes attributes(Path path) throws IOException {
        return Files.readAttributes(path, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
    }

    private static void requireRegular(BasicFileAttributes attributes, Path path)
            throws UnsafeReadException {
        if (Files.isSymbolicLink(path) || !attributes.isRegularFile()) {
            throw new UnsafeReadException();
        }
    }

    public static final class Chunk {
        private final byte[] bytes;
        private final long nextOffset;
        private final boolean done;

        Chunk(byte[] bytes, long nextOffset, boolean done) {
            this.bytes = bytes.clone();
            this.nextOffset = nextOffset;
            this.done = done;
        }

        public byte[] bytes() { return bytes.clone(); }
        public long nextOffset() { return nextOffset; }
        public boolean done() { return done; }

        @Override public boolean equals(Object other) {
            if (!(other instanceof Chunk)) return false;
            Chunk chunk = (Chunk) other;
            return nextOffset == chunk.nextOffset
                    && done == chunk.done
                    && Arrays.equals(bytes, chunk.bytes);
        }

        @Override public int hashCode() {
            return 31 * Objects.hash(nextOffset, done) + Arrays.hashCode(bytes);
        }
    }

    static final class Identity {
        final Object key;
        final long size;
        final FileTime modified;
        final FileTime created;

        private Identity(Object key, long size, FileTime modified, FileTime created) {
            this.key = key;
            this.size = size;
            this.modified = modified;
            this.created = created;
        }

        static Identity capture(Path path) throws IOException, UnsafeReadException {
            BasicFileAttributes attributes = BoundedDocumentReader.attributes(path);
            requireRegular(attributes, path);
            return new Identity(attributes.fileKey(), attributes.size(),
                    attributes.lastModifiedTime(), attributes.creationTime());
        }

        void requireSame(BasicFileAttributes attributes) throws UnsafeReadException {
            if (!attributes.isRegularFile()
                    || !Objects.equals(key, attributes.fileKey())
                    || size != attributes.size()
                    || !modified.equals(attributes.lastModifiedTime())
                    || !created.equals(attributes.creationTime())) {
                throw new UnsafeReadException();
            }
        }
    }

    enum Checkpoint { AFTER_PRECHECK, AFTER_OPEN, AFTER_READ }

    @FunctionalInterface interface ReadObserver {
        void checkpoint(Checkpoint checkpoint) throws IOException;
    }

    static final class UnsafeReadException extends IOException {
        UnsafeReadException() { }
        UnsafeReadException(Throwable cause) { super(cause); }
    }
}
