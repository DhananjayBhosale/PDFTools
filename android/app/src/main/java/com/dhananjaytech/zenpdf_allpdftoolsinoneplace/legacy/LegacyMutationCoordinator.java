package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.FileAlreadyExistsException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantLock;

/** The single Application-owned writer lock and atomic persistence state machine. */
public final class LegacyMutationCoordinator {
    private static final String DATASTORE = "datastore";
    private static final String SETTINGS = "app_settings.preferences_pb";
    private static final int WRITE_CHUNK_BYTES = 4096;

    private static final ReentrantLock APPLICATION_LOCK = new ReentrantLock(true);
    private final LegacyThemeModeWirePatcher patcher;
    private final AtomicIo io;

    public LegacyMutationCoordinator() {
        this(new LegacyThemeModeWirePatcher(), new SystemIo());
    }

    LegacyMutationCoordinator(
            LegacyThemeModeWirePatcher patcher,
            AtomicIo io) {
        this.patcher = Objects.requireNonNull(patcher);
        this.io = Objects.requireNonNull(io);
    }

    public Result setThemeMode(File filesDir, String mode) throws Failure {
        if (!isMode(mode)) {
            throw new Failure("LEGACY_THEME_INVALID_ARGUMENT");
        }
        try {
            APPLICATION_LOCK.lockInterruptibly();
        } catch (InterruptedException cancelled) {
            Thread.currentThread().interrupt();
            throw new Failure("LEGACY_THEME_CANCELLED");
        }

        OwnedTemp ownedTemp = null;
        boolean linearized = false;
        try {
            checkInterrupted();
            Path root = requireDirectory(filesDir.toPath());
            Path directory = requireDirectChild(root, root.resolve(DATASTORE));
            if (!Files.exists(directory, LinkOption.NOFOLLOW_LINKS)) {
                io.createDirectory(directory);
                requireDirectory(directory);
                io.fsyncDirectory(root);
            }
            directory = requireDirectory(directory);
            requireDirectChild(root, directory);

            Path source = requireDirectChild(directory, directory.resolve(SETTINGS));
            SourceRead before = io.readSnapshot(source, LegacyThemeModeWirePatcher.MAX_BYTES);
            checkInterrupted();

            LegacyThemeModeWirePatcher.PatchResult patch = patcher.patchResult(before.bytes, mode);
            if (!patch.changed) {
                return new Result(mode, false);
            }

            ownedTemp = io.createTemp(directory);
            requireOwnedTemp(directory, ownedTemp.path());
            checkInterrupted();
            ownedTemp.writeFully(patch.bytes);
            checkInterrupted();
            ownedTemp.forceAndClose();
            checkInterrupted();

            io.revalidateSource(source, before.snapshot, LegacyThemeModeWirePatcher.MAX_BYTES);
            ownedTemp.revalidateForMove();
            checkInterrupted();
            try {
                io.atomicMove(ownedTemp.path(), source);
            } catch (AtomicMoveNotSupportedException unsupported) {
                throw new Failure("LEGACY_THEME_ATOMIC_MOVE_UNAVAILABLE");
            }
            linearized = true;
            ownedTemp = null;
            checkInterrupted();

            io.fsyncDirectory(directory);
            return new Result(mode, true);
        } catch (LegacyThemeModeWirePatcher.PatchFailure failure) {
            if (failure.reason == LegacyThemeModeWirePatcher.FailureReason.TOO_LARGE) {
                throw new Failure("LEGACY_SETTINGS_TOO_LARGE");
            }
            if (failure.reason == LegacyThemeModeWirePatcher.FailureReason.INVALID_ARGUMENT) {
                throw new Failure("LEGACY_THEME_INVALID_ARGUMENT");
            }
            throw new Failure("LEGACY_SETTINGS_CORRUPT");
        } catch (InputTooLargeException tooLarge) {
            throw new Failure("LEGACY_SETTINGS_TOO_LARGE");
        } catch (SourceChangedException changed) {
            throw new Failure("LEGACY_SETTINGS_CONCURRENT_MODIFICATION");
        } catch (UnsafePathException unsafe) {
            throw new Failure("LEGACY_SETTINGS_UNSAFE_PATH");
        } catch (InterruptedException cancelled) {
            Thread.currentThread().interrupt();
            throw new Failure(linearized
                    ? "LEGACY_THEME_DURABILITY_UNCERTAIN"
                    : "LEGACY_THEME_CANCELLED");
        } catch (Failure failure) {
            throw failure;
        } catch (IOException failure) {
            throw new Failure(linearized
                    ? "LEGACY_THEME_DURABILITY_UNCERTAIN"
                    : "LEGACY_THEME_WRITE_FAILED");
        } finally {
            if (ownedTemp != null && !linearized) {
                Path ownedPath = ownedTemp.path();
                try {
                    ownedTemp.close();
                } catch (IOException ignored) {
                    // The mutation result is already determined; cleanup remains best effort.
                }
                try {
                    if (ownedTemp.isOwnedPath()) io.deleteOwnedTemp(ownedPath);
                } catch (IOException ignored) {
                    // Never delete a path whose current identity cannot be proven owned.
                }
            }
            APPLICATION_LOCK.unlock();
        }
    }

    private static void checkInterrupted() throws InterruptedException {
        if (Thread.interrupted()) {
            throw new InterruptedException();
        }
    }

    private static boolean isMode(String mode) {
        return "SYSTEM".equals(mode)
                || "DYNAMIC".equals(mode)
                || "LIGHT".equals(mode)
                || "DARK".equals(mode);
    }

    private static Path requireDirectory(Path path) throws UnsafePathException {
        Path normalized = path.toAbsolutePath().normalize();
        try {
            if (Files.isSymbolicLink(normalized)
                    || !Files.isDirectory(normalized, LinkOption.NOFOLLOW_LINKS)) {
                throw new UnsafePathException();
            }
            return normalized.toRealPath(LinkOption.NOFOLLOW_LINKS);
        } catch (UnsafePathException failure) {
            throw failure;
        } catch (IOException failure) {
            throw new UnsafePathException(failure);
        }
    }

    private static Path requireDirectChild(Path parent, Path child) throws UnsafePathException {
        Path normalizedParent = parent.toAbsolutePath().normalize();
        Path normalizedChild = child.toAbsolutePath().normalize();
        if (!normalizedParent.equals(normalizedChild.getParent())) {
            throw new UnsafePathException();
        }
        return normalizedChild;
    }

    private static void requireOwnedTemp(Path directory, Path temp) throws UnsafePathException {
        requireDirectChild(directory, temp);
        try {
            if (Files.isSymbolicLink(temp)
                    || !Files.isRegularFile(temp, LinkOption.NOFOLLOW_LINKS)) {
                throw new UnsafePathException();
            }
        } catch (SecurityException failure) {
            throw new UnsafePathException(failure);
        }
    }

    public static final class Result {
        public final String mode;
        public final boolean changed;

        Result(String mode, boolean changed) {
            this.mode = mode;
            this.changed = changed;
        }
    }

    public static final class Failure extends Exception {
        public final String code;

        Failure(String code) {
            this.code = code;
        }
    }

    interface OwnedTemp extends AutoCloseable {
        Path path();
        void writeFully(byte[] bytes) throws IOException, InterruptedException;
        void forceAndClose() throws IOException;
        void revalidateForMove() throws IOException;
        boolean isOwnedPath() throws IOException;
        @Override void close() throws IOException;
    }

    interface AtomicIo {
        SourceRead readSnapshot(Path source, int limit) throws IOException, InterruptedException;
        void revalidateSource(Path source, SourceSnapshot expected, int limit)
                throws IOException, InterruptedException;
        void createDirectory(Path directory) throws IOException;
        OwnedTemp createTemp(Path directory) throws IOException;
        void atomicMove(Path temp, Path source) throws IOException, InterruptedException;
        void fsyncDirectory(Path directory) throws IOException, InterruptedException;
        void deleteOwnedTemp(Path temp);
    }

    static final class SourceSnapshot {
        final boolean existed;
        final Object key;
        final long size;
        final long modified;
        final byte[] sha;

        SourceSnapshot(boolean existed, Object key, long size, long modified, byte[] sha) {
            this.existed = existed;
            this.key = key;
            this.size = size;
            this.modified = modified;
            this.sha = sha;
        }

        @Override public boolean equals(Object other) {
            if (!(other instanceof SourceSnapshot)) return false;
            SourceSnapshot snapshot = (SourceSnapshot) other;
            return existed == snapshot.existed
                    && size == snapshot.size
                    && modified == snapshot.modified
                    && Objects.equals(key, snapshot.key)
                    && Arrays.equals(sha, snapshot.sha);
        }

        @Override public int hashCode() {
            return 31 * Objects.hash(existed, key, size, modified) + Arrays.hashCode(sha);
        }
    }

    static final class SourceRead {
        final SourceSnapshot snapshot;
        final byte[] bytes;
        SourceRead(SourceSnapshot snapshot, byte[] bytes) {
            this.snapshot = snapshot;
            this.bytes = bytes;
        }
    }

    static final class UnsafePathException extends IOException {
        UnsafePathException() { }
        UnsafePathException(Throwable cause) { super(cause); }
    }
    static final class SourceChangedException extends IOException {
        SourceChangedException() { }
        SourceChangedException(Throwable cause) { super(cause); }
    }
    static final class InputTooLargeException extends IOException { }

    static final class SystemIo implements AtomicIo {
        @Override public SourceRead readSnapshot(Path path, int limit) throws IOException {
            if (!Files.exists(path, LinkOption.NOFOLLOW_LINKS)) return absent();
            if (Files.isSymbolicLink(path)
                    || !Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) {
                throw new UnsafePathException();
            }
            BasicFileAttributes before;
            BasicFileAttributes afterOpen;
            BasicFileAttributes afterRead;
            byte[] bytes;
            try {
                before = attributes(path);
                if (before.size() > limit) throw new InputTooLargeException();
                try (FileChannel input = FileChannel.open(
                        path, StandardOpenOption.READ, LinkOption.NOFOLLOW_LINKS)) {
                    afterOpen = attributes(path);
                    requireSameIdentity(before, afterOpen);
                    bytes = readBounded(input, limit);
                    afterRead = attributes(path);
                    requireSameIdentity(afterOpen, afterRead);
                }
            } catch (NoSuchFileException disappeared) {
                throw new SourceChangedException(disappeared);
            }
            return new SourceRead(
                    new SourceSnapshot(true, afterRead.fileKey(), afterRead.size(),
                            afterRead.lastModifiedTime().toMillis(), sha(bytes)),
                    bytes);
        }

        @Override public void revalidateSource(Path source, SourceSnapshot expected, int limit)
                throws IOException {
            SourceRead current;
            try {
                current = readSnapshot(source, limit);
            } catch (UnsafePathException unsafe) {
                throw unsafe;
            } catch (InputTooLargeException changed) {
                throw new SourceChangedException(changed);
            }
            if (!expected.equals(current.snapshot)) throw new SourceChangedException();
        }

        @Override public void createDirectory(Path directory) throws IOException {
            try {
                Files.createDirectory(directory);
            } catch (FileAlreadyExistsException collision) {
                throw new UnsafePathException(collision);
            }
        }

        @Override public OwnedTemp createTemp(Path directory) throws IOException {
            for (int attempt = 0; attempt < 32; attempt++) {
                Path path = directory.resolve(".pdfchef-theme-" + UUID.randomUUID() + ".tmp");
                try {
                    FileChannel channel = FileChannel.open(path, StandardOpenOption.CREATE_NEW,
                            StandardOpenOption.WRITE, LinkOption.NOFOLLOW_LINKS);
                    try {
                        BasicFileAttributes attributes = attributes(path);
                        if (!attributes.isRegularFile()) throw new UnsafePathException();
                        return new SystemOwnedTemp(path, channel, attributes.fileKey());
                    } catch (IOException failure) {
                        try { channel.close(); } catch (IOException closeFailure) {
                            failure.addSuppressed(closeFailure);
                        }
                        try { Files.deleteIfExists(path); } catch (IOException cleanupFailure) {
                            failure.addSuppressed(cleanupFailure);
                        }
                        throw failure;
                    }
                } catch (FileAlreadyExistsException retry) {
                    // A random-name collision is harmless; existing entries are never opened.
                }
            }
            throw new IOException("Could not allocate owned temporary file");
        }

        @Override public void atomicMove(Path temp, Path source) throws IOException {
            Files.move(temp, source, StandardCopyOption.ATOMIC_MOVE,
                    StandardCopyOption.REPLACE_EXISTING);
        }

        @Override public void fsyncDirectory(Path directory) throws IOException {
            try (FileChannel channel = FileChannel.open(directory, StandardOpenOption.READ)) {
                channel.force(true);
            }
        }

        @Override public void deleteOwnedTemp(Path temp) {
            try { Files.deleteIfExists(temp); } catch (IOException ignored) { }
        }

        private static SourceRead absent() {
            return new SourceRead(
                    new SourceSnapshot(false, null, 0, 0, new byte[0]), new byte[0]);
        }

        private static BasicFileAttributes attributes(Path path) throws IOException {
            return Files.readAttributes(path, BasicFileAttributes.class,
                    LinkOption.NOFOLLOW_LINKS);
        }

        private static void requireSameIdentity(
                BasicFileAttributes first, BasicFileAttributes second)
                throws SourceChangedException {
            if (!Objects.equals(first.fileKey(), second.fileKey())
                    || first.size() != second.size()
                    || first.lastModifiedTime().toMillis()
                    != second.lastModifiedTime().toMillis()) {
                throw new SourceChangedException();
            }
        }

        private static byte[] readBounded(FileChannel input, int limit) throws IOException {
            try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                ByteBuffer buffer = ByteBuffer.allocate(8192);
                int total = 0;
                while (true) {
                    int read = input.read(buffer);
                    if (read < 0) break;
                    if (read == 0) continue;
                    total += read;
                    if (total > limit) throw new InputTooLargeException();
                    buffer.flip();
                    byte[] chunk = new byte[buffer.remaining()];
                    buffer.get(chunk);
                    output.write(chunk);
                    buffer.clear();
                }
                return output.toByteArray();
            }
        }

        private static byte[] sha(byte[] bytes) throws IOException {
            try {
                return MessageDigest.getInstance("SHA-256").digest(bytes);
            } catch (NoSuchAlgorithmException impossible) {
                throw new IOException(impossible);
            }
        }
    }

    static final class SystemOwnedTemp implements OwnedTemp {
        private final Path path;
        private final Object fileKey;
        private FileChannel channel;
        private long writtenSize;

        SystemOwnedTemp(Path path, FileChannel channel, Object fileKey) {
            this.path = path;
            this.channel = channel;
            this.fileKey = fileKey;
        }

        @Override public Path path() { return path; }

        @Override public void writeFully(byte[] bytes)
                throws IOException, InterruptedException {
            FileChannel output = requireOpen();
            int offset = 0;
            while (offset < bytes.length) {
                int length = Math.min(WRITE_CHUNK_BYTES, bytes.length - offset);
                ByteBuffer buffer = ByteBuffer.wrap(bytes, offset, length);
                try {
                    while (buffer.hasRemaining()) output.write(buffer);
                } finally {
                    writtenSize = output.position();
                }
                offset += length;
                checkInterrupted();
            }
        }

        @Override public void forceAndClose() throws IOException {
            FileChannel output = requireOpen();
            IOException failure = null;
            try {
                output.force(true);
            } catch (IOException forceFailure) {
                failure = forceFailure;
            }
            try {
                close();
            } catch (IOException closeFailure) {
                if (failure == null) failure = closeFailure;
                else failure.addSuppressed(closeFailure);
            }
            if (failure != null) throw failure;
        }

        @Override public void revalidateForMove() throws IOException {
            if (!isOwnedPath()) throw new UnsafePathException();
        }

        @Override public boolean isOwnedPath() throws IOException {
            if (!Files.exists(path, LinkOption.NOFOLLOW_LINKS)
                    || Files.isSymbolicLink(path)) return false;
            BasicFileAttributes current = Files.readAttributes(
                    path, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
            return current.isRegularFile()
                    && current.size() == writtenSize
                    && (fileKey == null || Objects.equals(fileKey, current.fileKey()));
        }

        @Override public void close() throws IOException {
            if (channel != null) {
                FileChannel closing = channel;
                channel = null;
                closing.close();
            }
        }

        private FileChannel requireOpen() throws IOException {
            if (channel == null || !channel.isOpen()) {
                throw new IOException("Owned temporary file is closed");
            }
            return channel;
        }
    }
}
