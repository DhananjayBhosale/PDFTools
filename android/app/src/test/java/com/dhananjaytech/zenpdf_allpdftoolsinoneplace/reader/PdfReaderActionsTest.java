package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.reader;

import static org.junit.Assert.assertEquals;

import java.util.ArrayDeque;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.AbstractExecutorService;
import java.util.concurrent.TimeUnit;
import org.junit.Test;

public final class PdfReaderActionsTest {
    private static final String REF = "d1_abcdefghijklmnopqrstuv";

    @Test public void closeAfterPrepareCancelsAndSuppressesQueuedLaunchAndCallback() {
        FakeBackend backend = new FakeBackend();
        ManualExecutor background = new ManualExecutor();
        ManualMain main = new ManualMain();
        PdfReaderActions actions = new PdfReaderActions(backend, main, background);
        int[] callbacks = {0};
        actions.share(REF, result -> callbacks[0]++);
        background.runNext();
        assertEquals(1, backend.prepares);
        actions.close();
        main.runAll();
        assertEquals(1, backend.cancels);
        assertEquals(0, backend.launches);
        assertEquals(0, callbacks[0]);
    }

    @Test public void closeAfterChooserBeforeMarkNeverDeletesLaunchedStage() {
        FakeBackend backend = new FakeBackend();
        ManualExecutor background = new ManualExecutor();
        ManualMain main = new ManualMain();
        PdfReaderActions actions = new PdfReaderActions(backend, main, background);
        int[] callbacks = {0};
        actions.share(REF, result -> callbacks[0]++);
        background.runNext();
        main.runAll();
        assertEquals(1, backend.launches);
        actions.close();
        background.runAll();
        main.runAll();
        assertEquals(0, backend.cancels);
        assertEquals(0, callbacks[0]);
    }

    @Test public void closeBeforePreparationRunsProducesNoWorkOrCallback() {
        FakeBackend backend = new FakeBackend();
        ManualExecutor background = new ManualExecutor();
        ManualMain main = new ManualMain();
        PdfReaderActions actions = new PdfReaderActions(backend, main, background);
        int[] callbacks = {0};
        actions.share(REF, result -> callbacks[0]++);
        actions.close();
        background.runAll();
        main.runAll();
        assertEquals(0, backend.prepares);
        assertEquals(0, backend.launches);
        assertEquals(0, backend.cancels);
        assertEquals(0, callbacks[0]);
    }

    @Test public void readerShareCarriesValidatedDisplayNameToPreparation() {
        FakeBackend backend = new FakeBackend();
        ManualExecutor background = new ManualExecutor();
        ManualMain main = new ManualMain();
        PdfReaderActions actions = new PdfReaderActions(backend, main, background);
        actions.share(REF, "Scanned document ₹.pdf", result -> { });
        background.runNext();
        assertEquals("Scanned document ₹.pdf", backend.displayName);
        actions.close();
    }

    @Test public void readerShareRejectsUnsafeDisplayNameBeforePreparation() {
        FakeBackend backend = new FakeBackend();
        ManualExecutor background = new ManualExecutor();
        ManualMain main = new ManualMain();
        PdfReaderActions actions = new PdfReaderActions(backend, main, background);
        String[] code = {null};
        actions.share(REF, "../private.pdf", result -> code[0] = result.code());
        main.runAll();
        assertEquals("DOCUMENT_INVALID_ARGUMENT", code[0]);
        assertEquals(0, backend.prepares);
        actions.close();
    }

    private static final class FakeBackend implements PdfReaderActions.Backend {
        int prepares, launches, marks, cancels;
        String displayName;
        final Object handle = new Object();
        @Override public Object prepare(String ref) { prepares++; return handle; }
        @Override public Object prepare(String ref, String value) {
            displayName = value;
            return prepare(ref);
        }
        @Override public void launch(Object value) { launches++; }
        @Override public void markDispatched(Object value) { marks++; }
        @Override public void cancel(Object value) { cancels++; }
    }

    private static final class ManualMain implements PdfReaderActions.MainDispatcher {
        final Queue<Runnable> queue = new ArrayDeque<>();
        @Override public void post(Runnable runnable) { queue.add(runnable); }
        void runAll() { while (!queue.isEmpty()) queue.remove().run(); }
    }

    private static final class ManualExecutor extends AbstractExecutorService {
        final Queue<Runnable> queue = new ArrayDeque<>();
        boolean shutdown;
        @Override public void execute(Runnable command) {
            if (shutdown) throw new java.util.concurrent.RejectedExecutionException();
            queue.add(command);
        }
        void runNext() { if (!queue.isEmpty()) queue.remove().run(); }
        void runAll() { while (!queue.isEmpty()) queue.remove().run(); }
        @Override public void shutdown() { shutdown = true; }
        @Override public List<Runnable> shutdownNow() {
            shutdown = true;
            List<Runnable> pending = List.copyOf(queue);
            queue.clear();
            return pending;
        }
        @Override public boolean isShutdown() { return shutdown; }
        @Override public boolean isTerminated() { return shutdown && queue.isEmpty(); }
        @Override public boolean awaitTermination(long timeout, TimeUnit unit) {
            return isTerminated();
        }
    }
}
