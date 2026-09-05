package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import androidx.datastore.preferences.PreferencesProto;
import java.io.File;
import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.FileTime;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.Assume;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public final class LegacyMutationCoordinatorTest {
    private static final String PREFIX = ".pdfchef-theme-";

    @Rule public final TemporaryFolder temporary = new TemporaryFolder();
    private final AtomicInteger roots = new AtomicInteger();

    @Test public void invalidModesPerformZeroIoAndZeroDiskMutation() throws Exception {
        Path root = root();
        Map<String, String> before = manifest(root);
        CountingIo io = new CountingIo();
        LegacyMutationCoordinator coordinator = coordinator(io);

        for (String mode : Arrays.asList(null, "", "dark", " DARK", "DARK ", "AUTO")) {
            assertFailure("LEGACY_THEME_INVALID_ARGUMENT",
                    () -> coordinator.setThemeMode(root.toFile(), mode));
        }

        assertEquals(0, io.calls);
        assertEquals(before, manifest(root));
    }

    @Test public void missingZeroAndValidStoresApplyAndSurviveRecreation() throws Exception {
        for (byte[] initial : Arrays.asList(null, new byte[0],
                map("SYSTEM", "future_setting", "opaque").toByteArray())) {
            Path root = root();
            if (initial != null) writeSource(root, initial);

            LegacyMutationCoordinator.Result first =
                    new LegacyMutationCoordinator().setThemeMode(root.toFile(), "DARK");
            assertTrue(first.changed);
            assertEquals("DARK", readMode(root));
            if (initial != null && initial.length > 0) {
                assertEquals("opaque", readMap(root).getPreferencesMap()
                        .get("future_setting").getString());
            }
            assertEquals("DARK", new LegacySettingsInspector(root.toFile()).read()
                    .getAsJsonObject("values").get("theme_mode").getAsString());

            LegacyMutationCoordinator.Result recreated =
                    new LegacyMutationCoordinator().setThemeMode(root.toFile(), "LIGHT");
            assertTrue(recreated.changed);
            assertEquals("LIGHT", readMode(root));
            assertNoOwnedTemps(root);
        }
    }

    @Test public void noOpPreservesExactBytesMtimeAndFullTreeWithoutTempIo() throws Exception {
        Path root = root();
        byte[] bytes = map("DARK", "future_setting", "opaque").toByteArray();
        Path source = writeSource(root, bytes);
        Files.setLastModifiedTime(source, FileTime.fromMillis(1_700_000_000_123L));
        Map<String, String> before = manifest(root);
        FaultingIo io = new FaultingIo();

        LegacyMutationCoordinator.Result result = coordinator(io)
                .setThemeMode(root.toFile(), "DARK");

        assertFalse(result.changed);
        assertArrayEquals(bytes, Files.readAllBytes(source));
        assertEquals(before, manifest(root));
        assertEquals(0, io.tempCreates);
        assertEquals(0, io.moves);
        assertEquals(0, io.deletes.size());
    }

    @Test public void corruptAndTooLargeInputsAreTypedAndPreserved() throws Exception {
        Path corruptRoot = root();
        byte[] corrupt = new byte[] {0};
        Path corruptSource = writeSource(corruptRoot, corrupt);
        assertFailure("LEGACY_SETTINGS_CORRUPT",
                () -> new LegacyMutationCoordinator().setThemeMode(
                        corruptRoot.toFile(), "DARK"));
        assertArrayEquals(corrupt, Files.readAllBytes(corruptSource));
        assertNoOwnedTemps(corruptRoot);

        Path largeRoot = root();
        byte[] tooLarge = new byte[LegacyThemeModeWirePatcher.MAX_BYTES + 1];
        Arrays.fill(tooLarge, (byte) 7);
        Path largeSource = writeSource(largeRoot, tooLarge);
        assertFailure("LEGACY_SETTINGS_TOO_LARGE",
                () -> new LegacyMutationCoordinator().setThemeMode(
                        largeRoot.toFile(), "LIGHT"));
        assertArrayEquals(tooLarge, Files.readAllBytes(largeSource));
        assertNoOwnedTemps(largeRoot);
    }

    @Test public void rootDatastoreAndSourceWrongTypesAreUnsafe() throws Exception {
        Path outer = root();
        Path rootFile = outer.resolve("not-a-directory");
        Files.write(rootFile, new byte[] {1});
        assertFailure("LEGACY_SETTINGS_UNSAFE_PATH",
                () -> new LegacyMutationCoordinator().setThemeMode(rootFile.toFile(), "DARK"));

        Path badDatastore = root();
        Files.write(badDatastore.resolve("datastore"), new byte[] {1});
        assertFailure("LEGACY_SETTINGS_UNSAFE_PATH",
                () -> new LegacyMutationCoordinator().setThemeMode(
                        badDatastore.toFile(), "DARK"));

        Path badSource = root();
        Files.createDirectories(source(badSource));
        assertFailure("LEGACY_SETTINGS_UNSAFE_PATH",
                () -> new LegacyMutationCoordinator().setThemeMode(
                        badSource.toFile(), "DARK"));
    }

    @Test public void rootDatastoreAndSourceSymlinksNeverEscape() throws Exception {
        Path probeRoot = root();
        Assume.assumeTrue("Host does not support symbolic links", symlinksSupported(probeRoot));

        Path victimRoot = root();
        Path victim = writeSource(victimRoot, map("SYSTEM").toByteArray());
        byte[] victimBefore = Files.readAllBytes(victim);

        Path rootTarget = root();
        Path rootLink = rootTarget.getParent().resolve("linked-root-" + roots.incrementAndGet());
        Files.createSymbolicLink(rootLink, rootTarget);
        assertFailure("LEGACY_SETTINGS_UNSAFE_PATH",
                () -> new LegacyMutationCoordinator().setThemeMode(rootLink.toFile(), "DARK"));

        Path datastoreRoot = root();
        Files.createSymbolicLink(datastoreRoot.resolve("datastore"),
                victimRoot.resolve("datastore"));
        assertFailure("LEGACY_SETTINGS_UNSAFE_PATH",
                () -> new LegacyMutationCoordinator().setThemeMode(
                        datastoreRoot.toFile(), "DARK"));

        Path sourceRoot = root();
        Path store = Files.createDirectories(sourceRoot.resolve("datastore"));
        Files.createSymbolicLink(store.resolve("app_settings.preferences_pb"), victim);
        assertFailure("LEGACY_SETTINGS_UNSAFE_PATH",
                () -> new LegacyMutationCoordinator().setThemeMode(
                        sourceRoot.toFile(), "DARK"));

        assertArrayEquals(victimBefore, Files.readAllBytes(victim));
    }

    @Test public void sourceModificationAtBeforeMoveIsConcurrentAndNotOverwritten()
            throws Exception {
        Path root = root();
        byte[] old = map("SYSTEM").toByteArray();
        byte[] external = map("LIGHT").toByteArray();
        Path source = writeSource(root, old);
        FaultingIo io = new FaultingIo();
        io.beforeRevalidate = () ->
                Files.write(source, external, StandardOpenOption.TRUNCATE_EXISTING);

        assertFailure("LEGACY_SETTINGS_CONCURRENT_MODIFICATION",
                () -> coordinator(io).setThemeMode(root.toFile(), "DARK"));

        assertArrayEquals(external, Files.readAllBytes(source));
        assertEquals("LIGHT", readMode(root));
        assertNoOwnedTemps(root);
    }

    @Test public void tempCreatePartialWriteAndForceFailuresPreserveOldSource()
            throws Exception {
        for (Fault fault : Arrays.asList(Fault.CREATE_TEMP, Fault.PARTIAL_WRITE, Fault.TEMP_FSYNC)) {
            Path root = root();
            byte[] old = largeValidMap("SYSTEM");
            Path source = writeSource(root, old);
            FileTime mtime = Files.getLastModifiedTime(source, LinkOption.NOFOLLOW_LINKS);
            FaultingIo io = new FaultingIo();
            io.fault = fault;

            assertFailure("LEGACY_THEME_WRITE_FAILED",
                    () -> coordinator(io)
                            .setThemeMode(root.toFile(), "DARK"));

            assertArrayEquals(old, Files.readAllBytes(source));
            assertEquals(mtime, Files.getLastModifiedTime(source, LinkOption.NOFOLLOW_LINKS));
            if (fault == Fault.PARTIAL_WRITE) assertTrue(io.partialBytes > 0);
            assertNoOwnedTemps(root);
        }
    }

    @Test public void atomicUnsupportedAndOrdinaryMoveFailuresPreserveOldSource()
            throws Exception {
        for (Fault fault : Arrays.asList(Fault.ATOMIC_UNSUPPORTED, Fault.ATOMIC_FAILURE)) {
            Path root = root();
            byte[] old = map("SYSTEM").toByteArray();
            Path source = writeSource(root, old);
            FaultingIo io = new FaultingIo();
            io.fault = fault;

            assertFailure(fault == Fault.ATOMIC_UNSUPPORTED
                            ? "LEGACY_THEME_ATOMIC_MOVE_UNAVAILABLE"
                            : "LEGACY_THEME_WRITE_FAILED",
                    () -> coordinator(io)
                            .setThemeMode(root.toFile(), "DARK"));

            assertArrayEquals(old, Files.readAllBytes(source));
            assertNoOwnedTemps(root);
        }
    }

    @Test public void postMoveDirectoryFsyncFailuresLeaveCompleteNewSource()
            throws Exception {
        for (Fault fault : Arrays.asList(Fault.DIRECTORY_FSYNC, Fault.AFTER_DIRECTORY_FSYNC)) {
            Path root = root();
            writeSource(root, map("SYSTEM").toByteArray());
            FaultingIo io = new FaultingIo();
            io.fault = fault;

            assertFailure("LEGACY_THEME_DURABILITY_UNCERTAIN",
                    () -> coordinator(io).setThemeMode(root.toFile(), "DARK"));

            assertEquals("DARK", readMode(root));
            assertNoOwnedTemps(root);
        }
    }

    @Test public void interruptionBeforeLinearizationKeepsOldAndAfterMoveKeepsNew()
            throws Exception {
        for (InterruptPoint target : InterruptPoint.values()) {
            Path root = root();
            byte[] old = map("SYSTEM").toByteArray();
            Path source = writeSource(root, old);
            FaultingIo io = new FaultingIo();
            io.interruptPoint = target;
            try {
                assertFailure(target == InterruptPoint.AFTER_MOVE
                                ? "LEGACY_THEME_DURABILITY_UNCERTAIN"
                                : "LEGACY_THEME_CANCELLED",
                        () -> coordinator(io).setThemeMode(root.toFile(), "DARK"));
                assertTrue("coordinator restores interrupt status after classification",
                        Thread.currentThread().isInterrupted());
            } finally {
                Thread.interrupted();
            }

            if (target == InterruptPoint.AFTER_MOVE) {
                assertEquals("DARK", readMode(root));
            } else {
                assertArrayEquals(old, Files.readAllBytes(source));
            }
            assertNoOwnedTemps(root);
        }
    }

    @Test public void applicationLockSerializesSeparateCoordinatorInstancesInOrder()
            throws Exception {
        Path root = root();
        writeSource(root, map("SYSTEM").toByteArray());
        CountDownLatch firstRead = new CountDownLatch(1);
        CountDownLatch releaseFirst = new CountDownLatch(1);
        CountDownLatch secondRead = new CountDownLatch(1);
        FaultingIo firstIo = new FaultingIo();
        firstIo.afterRead = () -> {
            firstRead.countDown();
            releaseFirst.await();
        };
        FaultingIo secondIo = new FaultingIo();
        secondIo.afterRead = secondRead::countDown;
        LegacyMutationCoordinator first = coordinator(firstIo);
        LegacyMutationCoordinator second = coordinator(secondIo);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<LegacyMutationCoordinator.Result> dark =
                    executor.submit(() -> first.setThemeMode(root.toFile(), "DARK"));
            assertTrue(firstRead.await(5, TimeUnit.SECONDS));
            Future<LegacyMutationCoordinator.Result> light =
                    executor.submit(() -> second.setThemeMode(root.toFile(), "LIGHT"));
            assertFalse("Second instance entered while first held the Application lock",
                    secondRead.await(150, TimeUnit.MILLISECONDS));
            releaseFirst.countDown();
            assertTrue(dark.get(5, TimeUnit.SECONDS).changed);
            assertTrue(light.get(5, TimeUnit.SECONDS).changed);
            assertTrue(secondRead.await(5, TimeUnit.SECONDS));
        } finally {
            releaseFirst.countDown();
            executor.shutdownNow();
        }
        assertEquals("LIGHT", readMode(root));
        assertNoOwnedTemps(root);
    }

    @Test public void cleanupDeletesOnlyOwnedTempAndLeavesForeignLookalike()
            throws Exception {
        Path root = root();
        byte[] old = map("SYSTEM").toByteArray();
        writeSource(root, old);
        Path foreign = root.resolve("datastore/" + PREFIX + "foreign.tmp");
        byte[] foreignBytes = new byte[] {9, 8, 7};
        Files.write(foreign, foreignBytes);
        FaultingIo io = new FaultingIo();
        io.fault = Fault.ATOMIC_FAILURE;

        assertFailure("LEGACY_THEME_WRITE_FAILED",
                () -> coordinator(io)
                        .setThemeMode(root.toFile(), "DARK"));

        assertArrayEquals(foreignBytes, Files.readAllBytes(foreign));
        assertEquals(1, io.deletes.size());
        assertNotEquals(foreign, io.deletes.get(0));
        assertFalse(Files.exists(io.deletes.get(0), LinkOption.NOFOLLOW_LINKS));
        assertEquals(1, ownedTemps(root).size());
    }

    @Test public void ownedTempDescriptorCannotBeRetargetedAfterCreateNew() throws Exception {
        Path root = root();
        Path directory = Files.createDirectory(root.resolve("datastore"));
        Path victim = root.resolve("victim");
        byte[] victimBytes = new byte[] {3, 1, 4};
        Files.write(victim, victimBytes);
        LegacyMutationCoordinator.SystemIo io = new LegacyMutationCoordinator.SystemIo();
        LegacyMutationCoordinator.OwnedTemp owned = io.createTemp(directory);
        Path allocated = owned.path();
        Files.delete(allocated);
        Assume.assumeTrue("Host does not support symbolic links", symlink(allocated, victim));
        try {
            owned.writeFully(new byte[] {8, 8, 8, 8});
            owned.forceAndClose();
        } finally {
            owned.close();
            Files.deleteIfExists(allocated);
        }
        assertArrayEquals(victimBytes, Files.readAllBytes(victim));
    }

    @Test public void swappedTempNameIsUnsafeAndNeitherMovedNorCleanedAsOwned()
            throws Exception {
        Path root = root();
        Assume.assumeTrue("Host does not support symbolic links", symlinksSupported(root));
        byte[] old = map("SYSTEM").toByteArray();
        Path source = writeSource(root, old);
        Path victim = root.resolve("victim");
        byte[] victimBytes = new byte[] {5, 4, 3, 2, 1};
        Files.write(victim, victimBytes);
        Path[] swapped = new Path[1];
        FaultingIo io = new FaultingIo();
        io.beforeRevalidate = () -> {
            swapped[0] = ownedTemps(root).get(0);
            Files.delete(swapped[0]);
            Files.createSymbolicLink(swapped[0], victim);
        };

        assertFailure("LEGACY_SETTINGS_UNSAFE_PATH",
                () -> coordinator(io).setThemeMode(root.toFile(), "DARK"));

        assertArrayEquals(old, Files.readAllBytes(source));
        assertArrayEquals(victimBytes, Files.readAllBytes(victim));
        assertTrue(Files.isSymbolicLink(swapped[0]));
        Files.delete(swapped[0]);
    }

    private LegacyMutationCoordinator coordinator(LegacyMutationCoordinator.AtomicIo io) {
        return new LegacyMutationCoordinator(new LegacyThemeModeWirePatcher(), io);
    }

    private Path root() throws IOException {
        return temporary.newFolder("case-" + roots.incrementAndGet()).toPath();
    }

    private static Path source(Path root) {
        return root.resolve("datastore/app_settings.preferences_pb");
    }

    private static Path writeSource(Path root, byte[] bytes) throws IOException {
        Files.createDirectories(root.resolve("datastore"));
        return Files.write(source(root), bytes);
    }

    private static PreferencesProto.PreferenceMap map(String mode, String... unknownPairs) {
        PreferencesProto.PreferenceMap.Builder builder =
                PreferencesProto.PreferenceMap.newBuilder();
        builder.putPreferences("theme_mode", string(mode));
        for (int index = 0; index < unknownPairs.length; index += 2) {
            builder.putPreferences(unknownPairs[index], string(unknownPairs[index + 1]));
        }
        return builder.build();
    }

    private static byte[] largeValidMap(String mode) {
        char[] chars = new char[12_000];
        Arrays.fill(chars, 'x');
        return map(mode, "future_setting", new String(chars)).toByteArray();
    }

    private static PreferencesProto.Value string(String value) {
        return PreferencesProto.Value.newBuilder().setString(value).build();
    }

    private static PreferencesProto.PreferenceMap readMap(Path root) throws IOException {
        return PreferencesProto.PreferenceMap.parseFrom(Files.readAllBytes(source(root)));
    }

    private static String readMode(Path root) throws IOException {
        return readMap(root).getPreferencesMap().get("theme_mode").getString();
    }

    private static void assertFailure(String expected, ThrowingCall call) throws Exception {
        try {
            call.run();
            fail("Expected " + expected);
        } catch (LegacyMutationCoordinator.Failure failure) {
            assertEquals(expected, failure.code);
        }
    }

    private static void assertNoOwnedTemps(Path root) throws IOException {
        assertTrue(ownedTemps(root).isEmpty());
    }

    private static List<Path> ownedTemps(Path root) throws IOException {
        Path directory = root.resolve("datastore");
        List<Path> result = new ArrayList<>();
        if (!Files.isDirectory(directory, LinkOption.NOFOLLOW_LINKS)) return result;
        try (java.util.stream.Stream<Path> entries = Files.list(directory)) {
            entries.filter(path -> path.getFileName().toString().startsWith(PREFIX))
                    .forEach(result::add);
        }
        return result;
    }

    private static Map<String, String> manifest(Path root) throws Exception {
        Map<String, String> result = new LinkedHashMap<>();
        try (java.util.stream.Stream<Path> walk = Files.walk(root)) {
            Path[] paths = walk.sorted().toArray(Path[]::new);
            for (Path path : paths) {
                String relative = root.relativize(path).toString().replace(File.separatorChar, '/');
                BasicFileAttributes attributes = Files.readAttributes(
                        path, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
                String type = Files.isSymbolicLink(path) ? "link"
                        : attributes.isDirectory() ? "directory"
                        : attributes.isRegularFile() ? "file" : "other";
                String sha = attributes.isRegularFile()
                        ? hex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(path)))
                        : "-";
                String target = Files.isSymbolicLink(path) ? Files.readSymbolicLink(path).toString() : "-";
                result.put(relative, type + "|" + attributes.size() + "|"
                        + attributes.lastModifiedTime().toMillis() + "|" + sha + "|" + target);
            }
        }
        return result;
    }

    private static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) result.append(String.format("%02x", value & 0xff));
        return result.toString();
    }

    private static boolean symlinksSupported(Path root) throws IOException {
        Path target = Files.write(root.resolve("symlink-target"), new byte[] {1});
        Path link = root.resolve("symlink-probe");
        boolean supported = symlink(link, target);
        Files.deleteIfExists(link);
        return supported;
    }

    private static boolean symlink(Path link, Path target) {
        try {
            Files.createSymbolicLink(link, target);
            return true;
        } catch (IOException | UnsupportedOperationException | SecurityException unsupported) {
            return false;
        }
    }

    private interface ThrowingCall { void run() throws Exception; }
    private interface IoHook { void run() throws IOException, InterruptedException; }

    private enum Fault {
        NONE,
        CREATE_TEMP,
        PARTIAL_WRITE,
        TEMP_FSYNC,
        ATOMIC_UNSUPPORTED,
        ATOMIC_FAILURE,
        DIRECTORY_FSYNC,
        AFTER_DIRECTORY_FSYNC
    }

    private enum InterruptPoint { AFTER_READ, DURING_WRITE, BEFORE_MOVE, AFTER_MOVE }

    private static final class CountingIo implements LegacyMutationCoordinator.AtomicIo {
        int calls;
        @Override public LegacyMutationCoordinator.SourceRead readSnapshot(Path p, int l) { calls++; return null; }
        @Override public void revalidateSource(Path p, LegacyMutationCoordinator.SourceSnapshot s, int l) { calls++; }
        @Override public void createDirectory(Path p) { calls++; }
        @Override public LegacyMutationCoordinator.OwnedTemp createTemp(Path p) { calls++; return null; }
        @Override public void atomicMove(Path t, Path s) { calls++; }
        @Override public void fsyncDirectory(Path p) { calls++; }
        @Override public void deleteOwnedTemp(Path p) { calls++; }
    }

    private static final class FaultingIo implements LegacyMutationCoordinator.AtomicIo {
        final LegacyMutationCoordinator.SystemIo delegate = new LegacyMutationCoordinator.SystemIo();
        final List<Path> deletes = new ArrayList<>();
        Fault fault = Fault.NONE;
        int tempCreates;
        int moves;
        long partialBytes;
        InterruptPoint interruptPoint;
        IoHook afterRead = () -> { };
        IoHook beforeRevalidate = () -> { };

        @Override public LegacyMutationCoordinator.SourceRead readSnapshot(Path source, int limit)
                throws IOException, InterruptedException {
            LegacyMutationCoordinator.SourceRead result = delegate.readSnapshot(source, limit);
            afterRead.run();
            if (interruptPoint == InterruptPoint.AFTER_READ) Thread.currentThread().interrupt();
            return result;
        }

        @Override public void revalidateSource(
                Path source, LegacyMutationCoordinator.SourceSnapshot expected, int limit)
                throws IOException, InterruptedException {
            beforeRevalidate.run();
            delegate.revalidateSource(source, expected, limit);
            if (interruptPoint == InterruptPoint.BEFORE_MOVE) Thread.currentThread().interrupt();
        }

        @Override public void createDirectory(Path directory) throws IOException {
            delegate.createDirectory(directory);
        }

        @Override public LegacyMutationCoordinator.OwnedTemp createTemp(Path directory)
                throws IOException {
            tempCreates++;
            if (fault == Fault.CREATE_TEMP) throw new IOException("temp create");
            LegacyMutationCoordinator.OwnedTemp owned = delegate.createTemp(directory);
            return new LegacyMutationCoordinator.OwnedTemp() {
                @Override public Path path() { return owned.path(); }

                @Override public void writeFully(byte[] bytes)
                        throws IOException, InterruptedException {
                    if (fault == Fault.PARTIAL_WRITE) {
                        owned.writeFully(Arrays.copyOf(bytes, Math.min(4096, bytes.length)));
                        partialBytes = Files.size(owned.path());
                        throw new IOException("partial write");
                    }
                    if (interruptPoint == InterruptPoint.DURING_WRITE) {
                        owned.writeFully(Arrays.copyOf(bytes, Math.min(1, bytes.length)));
                        partialBytes = Files.size(owned.path());
                        throw new InterruptedException("deterministic temp-write interruption");
                    }
                    owned.writeFully(bytes);
                }

                @Override public void forceAndClose() throws IOException {
                    if (fault == Fault.TEMP_FSYNC) throw new IOException("temp fsync");
                    owned.forceAndClose();
                }

                @Override public void revalidateForMove() throws IOException {
                    owned.revalidateForMove();
                }

                @Override public boolean isOwnedPath() throws IOException {
                    return owned.isOwnedPath();
                }

                @Override public void close() throws IOException { owned.close(); }
            };
        }

        @Override public void atomicMove(Path temp, Path source)
                throws IOException, InterruptedException {
            moves++;
            if (fault == Fault.ATOMIC_UNSUPPORTED) {
                throw new AtomicMoveNotSupportedException(
                        temp.toString(), source.toString(), "forced");
            }
            if (fault == Fault.ATOMIC_FAILURE) throw new IOException("atomic move");
            delegate.atomicMove(temp, source);
            if (interruptPoint == InterruptPoint.AFTER_MOVE) Thread.currentThread().interrupt();
        }

        @Override public void fsyncDirectory(Path directory)
                throws IOException, InterruptedException {
            if (fault == Fault.DIRECTORY_FSYNC
                    && directory.getFileName().toString().equals("datastore")) {
                throw new IOException("directory fsync");
            }
            delegate.fsyncDirectory(directory);
            if (fault == Fault.AFTER_DIRECTORY_FSYNC
                    && directory.getFileName().toString().equals("datastore")) {
                throw new IOException("after directory fsync");
            }
        }

        @Override public void deleteOwnedTemp(Path temp) {
            deletes.add(temp);
            delegate.deleteOwnedTemp(temp);
        }
    }
}
