package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy;

import java.io.IOException;
import java.nio.file.Path;

/** Debug-only one-shot crash decorator around the production atomic I/O implementation. */
public final class LegacyThemeCrashController implements LegacyMutationCoordinator.AtomicIo {
    public static final String BEFORE_MOVE = "BEFORE_MOVE";
    public static final String AFTER_MOVE = "AFTER_MOVE";
    public static final String AFTER_DIRECTORY_FSYNC = "AFTER_DIRECTORY_FSYNC";

    private final LegacyMutationCoordinator.SystemIo delegate =
            new LegacyMutationCoordinator.SystemIo();
    private Stage armedStage;
    private boolean coordinatorCreated;

    public synchronized LegacyMutationCoordinator createCoordinator() {
        if (coordinatorCreated) throw new IllegalStateException("COORDINATOR_ALREADY_CREATED");
        coordinatorCreated = true;
        return new LegacyMutationCoordinator(new LegacyThemeModeWirePatcher(), this);
    }

    public synchronized void arm(String requestedStage) {
        Stage validated = Stage.fromWire(requestedStage);
        if (armedStage != null) throw new IllegalStateException("CRASH_STAGE_ALREADY_ARMED");
        armedStage = validated;
    }

    @Override
    public LegacyMutationCoordinator.SourceRead readSnapshot(Path source, int limit)
            throws IOException, InterruptedException {
        return delegate.readSnapshot(source, limit);
    }

    @Override
    public void revalidateSource(
            Path source, LegacyMutationCoordinator.SourceSnapshot expected, int limit)
            throws IOException, InterruptedException {
        delegate.revalidateSource(source, expected, limit);
    }

    @Override
    public void createDirectory(Path directory) throws IOException {
        delegate.createDirectory(directory);
    }

    @Override
    public LegacyMutationCoordinator.OwnedTemp createTemp(Path directory) throws IOException {
        return delegate.createTemp(directory);
    }

    @Override
    public void atomicMove(Path temp, Path source) throws IOException, InterruptedException {
        crashIfArmed(Stage.BEFORE_MOVE);
        delegate.atomicMove(temp, source);
        crashIfArmed(Stage.AFTER_MOVE);
    }

    @Override
    public void fsyncDirectory(Path directory) throws IOException, InterruptedException {
        boolean datastoreDirectory = directory.getFileName() != null
                && "datastore".equals(directory.getFileName().toString());
        delegate.fsyncDirectory(directory);
        if (datastoreDirectory) crashIfArmed(Stage.AFTER_DIRECTORY_FSYNC);
    }

    @Override
    public void deleteOwnedTemp(Path temp) {
        delegate.deleteOwnedTemp(temp);
    }

    private void crashIfArmed(Stage reached) {
        boolean crash;
        synchronized (this) {
            crash = armedStage == reached;
            if (crash) armedStage = null;
        }
        if (crash) {
            android.os.Process.killProcess(android.os.Process.myPid());
            throw new AssertionError("SELF_SIGKILL_RETURNED");
        }
    }

    private enum Stage {
        BEFORE_MOVE,
        AFTER_MOVE,
        AFTER_DIRECTORY_FSYNC;

        static Stage fromWire(String value) {
            if (LegacyThemeCrashController.BEFORE_MOVE.equals(value)) return BEFORE_MOVE;
            if (LegacyThemeCrashController.AFTER_MOVE.equals(value)) return AFTER_MOVE;
            if (LegacyThemeCrashController.AFTER_DIRECTORY_FSYNC.equals(value)) {
                return AFTER_DIRECTORY_FSYNC;
            }
            throw new IllegalArgumentException("INVALID_CRASH_STAGE");
        }
    }
}
