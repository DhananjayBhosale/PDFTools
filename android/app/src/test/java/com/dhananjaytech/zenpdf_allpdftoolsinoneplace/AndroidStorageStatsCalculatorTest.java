package com.dhananjaytech.zenpdf_allpdftoolsinoneplace;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.fail;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.Test;

public final class AndroidStorageStatsCalculatorTest {
    private static final AndroidStorageStatsCalculator.SpaceReader NORMAL_SPACE =
            new AndroidStorageStatsCalculator.SpaceReader() {
                @Override public long usableSpace(Path ignored) { return 100; }
                @Override public long capacitySpace(Path ignored) { return 200; }
            };

    @Test public void countsOnlyImmediateRegularOwnedFiles() throws Exception {
        Path filesDirectory = Files.createTempDirectory("storage-stats-");
        Path owned = Files.createDirectories(filesDirectory.resolve("pdfchef_documents/owned"));
        Files.write(owned.resolve("first"), new byte[] {1, 2, 3});
        Files.write(owned.resolve("second"), new byte[] {4, 5, 6, 7});

        AndroidStorageStatsCalculator.StorageStats stats = calculator(NORMAL_SPACE)
                .calculate(filesDirectory);
        assertEquals(7, stats.retainedBytes());
        assertEquals(Long.valueOf(100), stats.availableBytes());
        assertEquals(Long.valueOf(200), stats.capacityBytes());
    }

    @Test public void missingOwnedRootReturnsZeroWithoutCreatingAnything() throws Exception {
        Path filesDirectory = Files.createTempDirectory("storage-stats-");
        Path documents = filesDirectory.resolve("pdfchef_documents");

        AndroidStorageStatsCalculator.StorageStats stats = calculator(NORMAL_SPACE)
                .calculate(filesDirectory);
        assertEquals(0, stats.retainedBytes());
        assertEquals(false, Files.exists(documents));
    }

    @Test public void unsafeEntriesAndUnsafeRootsFailInsteadOfBeingCounted() throws Exception {
        Path filesDirectory = Files.createTempDirectory("storage-stats-");
        Path owned = Files.createDirectories(filesDirectory.resolve("pdfchef_documents/owned"));
        Files.createDirectory(owned.resolve("nested"));
        expectFailure(filesDirectory);

        Path anotherFilesDirectory = Files.createTempDirectory("storage-stats-");
        Path documents = Files.createDirectories(anotherFilesDirectory.resolve("pdfchef_documents"));
        Path target = Files.createTempDirectory("storage-stats-target-");
        try {
            Files.createSymbolicLink(documents.resolve("owned"), target);
            expectFailure(anotherFilesDirectory);
        } catch (UnsupportedOperationException ignored) {
            // Symbolic links are unavailable on a few constrained JVM filesystems.
        }

        Path thirdFilesDirectory = Files.createTempDirectory("storage-stats-");
        Path thirdOwned = Files.createDirectories(thirdFilesDirectory.resolve("pdfchef_documents/owned"));
        Path fileTarget = Files.write(Files.createTempFile("storage-stats-file-", ".bin"), new byte[] {1});
        try {
            Files.createSymbolicLink(thirdOwned.resolve("linked.bin"), fileTarget);
            expectFailure(thirdFilesDirectory);
        } catch (UnsupportedOperationException ignored) {
            // Symbolic links are unavailable on a few constrained JVM filesystems.
        }

        Path linkParent = Files.createTempDirectory("storage-stats-links-");
        Path linkTarget = Files.createTempDirectory("storage-stats-root-");
        try {
            Path linkedFilesDirectory = linkParent.resolve("files");
            Files.createSymbolicLink(linkedFilesDirectory, linkTarget);
            expectFailure(linkedFilesDirectory);
        } catch (UnsupportedOperationException ignored) {
            // Symbolic links are unavailable on a few constrained JVM filesystems.
        }
    }

    @Test public void unsafeOrExceptionalFilesystemValuesBecomeNull() throws Exception {
        Path filesDirectory = Files.createTempDirectory("storage-stats-");
        AndroidStorageStatsCalculator.SpaceReader unsafe =
                new AndroidStorageStatsCalculator.SpaceReader() {
                    @Override public long usableSpace(Path ignored) {
                        return AndroidStorageStatsCalculator.MAXIMUM_SAFE_INTEGER + 1;
                    }

                    @Override public long capacitySpace(Path ignored) throws Exception {
                        throw new Exception("not public");
                    }
                };
        AndroidStorageStatsCalculator.StorageStats stats = calculator(unsafe).calculate(filesDirectory);
        assertEquals(0, stats.retainedBytes());
        assertNull(stats.availableBytes());
        assertNull(stats.capacityBytes());
    }

    @Test public void inconsistentFilesystemValuesBecomeNullTogether() throws Exception {
        Path filesDirectory = Files.createTempDirectory("storage-stats-");
        AndroidStorageStatsCalculator.SpaceReader inconsistent =
                new AndroidStorageStatsCalculator.SpaceReader() {
                    @Override public long usableSpace(Path ignored) { return 201; }
                    @Override public long capacitySpace(Path ignored) { return 200; }
                };
        AndroidStorageStatsCalculator.StorageStats stats = calculator(inconsistent)
                .calculate(filesDirectory);
        assertNull(stats.availableBytes());
        assertNull(stats.capacityBytes());
    }

    private static AndroidStorageStatsCalculator calculator(
            AndroidStorageStatsCalculator.SpaceReader reader) {
        return new AndroidStorageStatsCalculator(reader);
    }

    private static void expectFailure(Path filesDirectory) throws Exception {
        try {
            calculator(NORMAL_SPACE).calculate(filesDirectory);
            fail("Unsafe storage state must not be counted");
        } catch (AndroidStorageStatsCalculator.Failure expected) {
            // Expected generic calculation failure.
        }
    }
}
