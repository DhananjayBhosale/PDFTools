package com.dhananjaytech.zenpdf_allpdftoolsinoneplace;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;

/** Computes the small, explicitly-owned portion of app storage suitable for the bridge. */
public final class AndroidStorageStatsCalculator {
    public static final long MAXIMUM_SAFE_INTEGER = 9_007_199_254_740_991L;

    private static final String DOCUMENTS_DIRECTORY = "pdfchef_documents";
    private static final String OWNED_DIRECTORY = "owned";

    private final SpaceReader spaceReader;

    public AndroidStorageStatsCalculator() {
        this(new SpaceReader() {
            @Override public long usableSpace(Path path) {
                return path.toFile().getUsableSpace();
            }

            @Override public long capacitySpace(Path path) {
                return path.toFile().getTotalSpace();
            }
        });
    }

    AndroidStorageStatsCalculator(SpaceReader spaceReader) {
        this.spaceReader = spaceReader;
    }

    public StorageStats calculate(Path filesDirectory) throws Failure {
        if (filesDirectory == null) throw new Failure();
        BasicFileAttributes expectedFilesDirectory = requireDirectory(filesDirectory);

        Path documentsDirectory = filesDirectory.resolve(DOCUMENTS_DIRECTORY);
        if (!Files.exists(documentsDirectory, LinkOption.NOFOLLOW_LINKS)) {
            return result(filesDirectory, expectedFilesDirectory, 0);
        }

        BasicFileAttributes expectedDocumentsDirectory = requireDirectory(documentsDirectory);
        Path ownedDirectory = documentsDirectory.resolve(OWNED_DIRECTORY);
        if (!Files.exists(ownedDirectory, LinkOption.NOFOLLOW_LINKS)) {
            if (!sameDirectory(documentsDirectory, expectedDocumentsDirectory)) throw new Failure();
            return result(filesDirectory, expectedFilesDirectory, 0);
        }

        BasicFileAttributes expectedRoot = requireDirectory(ownedDirectory);
        long retainedBytes = 0;
        try (DirectoryStream<Path> children = Files.newDirectoryStream(ownedDirectory)) {
            for (Path child : children) {
                if (!ownedDirectory.equals(child.getParent())) throw new Failure();
                BasicFileAttributes before = requireRegularFile(child);
                long size = before.size();
                if (size < 0) throw new Failure();
                try {
                    retainedBytes = Math.addExact(retainedBytes, size);
                } catch (ArithmeticException failure) {
                    throw new Failure();
                }
                if (retainedBytes > MAXIMUM_SAFE_INTEGER || !sameRegularFile(child, before)) {
                    throw new Failure();
                }
            }
        } catch (IOException failure) {
            throw new Failure();
        }
        if (!sameDirectory(ownedDirectory, expectedRoot)
                || !sameDirectory(documentsDirectory, expectedDocumentsDirectory)) {
            throw new Failure();
        }
        return result(filesDirectory, expectedFilesDirectory, retainedBytes);
    }

    private StorageStats result(Path filesDirectory, BasicFileAttributes expected, long retainedBytes)
            throws Failure {
        Long availableBytes = safeUsable(filesDirectory);
        Long capacityBytes = safeCapacity(filesDirectory);
        if (availableBytes != null && capacityBytes != null && availableBytes > capacityBytes) {
            availableBytes = null;
            capacityBytes = null;
        }
        if (!sameDirectory(filesDirectory, expected)) throw new Failure();
        return new StorageStats(retainedBytes, availableBytes, capacityBytes);
    }

    private Long safeUsable(Path filesDirectory) {
        try {
            return safePublicBytes(spaceReader.usableSpace(filesDirectory));
        } catch (Exception ignored) {
            return null;
        }
    }

    private Long safeCapacity(Path filesDirectory) {
        try {
            return safePublicBytes(spaceReader.capacitySpace(filesDirectory));
        } catch (Exception ignored) {
            return null;
        }
    }

    private static Long safePublicBytes(long value) {
        return value >= 0 && value <= MAXIMUM_SAFE_INTEGER ? value : null;
    }

    private static BasicFileAttributes requireDirectory(Path path) throws Failure {
        if (Files.isSymbolicLink(path)) throw new Failure();
        try {
            BasicFileAttributes attributes = Files.readAttributes(
                    path, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
            if (!attributes.isDirectory()) throw new Failure();
            return attributes;
        } catch (IOException failure) {
            throw new Failure();
        }
    }

    private static BasicFileAttributes requireRegularFile(Path path) throws Failure {
        if (Files.isSymbolicLink(path)) throw new Failure();
        try {
            BasicFileAttributes attributes = Files.readAttributes(
                    path, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
            if (!attributes.isRegularFile()) throw new Failure();
            return attributes;
        } catch (IOException failure) {
            throw new Failure();
        }
    }

    private static boolean sameDirectory(Path path, BasicFileAttributes expected) {
        try {
            if (Files.isSymbolicLink(path)) return false;
            BasicFileAttributes current = Files.readAttributes(
                    path, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
            return current.isDirectory() && sameIdentity(expected, current);
        } catch (IOException failure) {
            return false;
        }
    }

    private static boolean sameRegularFile(Path path, BasicFileAttributes expected) {
        try {
            if (Files.isSymbolicLink(path)) return false;
            BasicFileAttributes current = Files.readAttributes(
                    path, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
            return current.isRegularFile() && current.size() == expected.size()
                    && sameIdentity(expected, current);
        } catch (IOException failure) {
            return false;
        }
    }

    private static boolean sameIdentity(BasicFileAttributes expected, BasicFileAttributes current) {
        Object expectedKey = expected.fileKey();
        Object currentKey = current.fileKey();
        return expectedKey == null || currentKey == null || expectedKey.equals(currentKey);
    }

    interface SpaceReader {
        long usableSpace(Path path) throws Exception;
        long capacitySpace(Path path) throws Exception;
    }

    public static final class StorageStats {
        private final long retainedBytes;
        private final Long availableBytes;
        private final Long capacityBytes;

        StorageStats(long retainedBytes, Long availableBytes, Long capacityBytes) {
            this.retainedBytes = retainedBytes;
            this.availableBytes = availableBytes;
            this.capacityBytes = capacityBytes;
        }

        public long retainedBytes() {
            return retainedBytes;
        }

        public Long availableBytes() {
            return availableBytes;
        }

        public Long capacityBytes() {
            return capacityBytes;
        }
    }

    public static final class Failure extends Exception {
        Failure() {
            super();
        }
    }
}
