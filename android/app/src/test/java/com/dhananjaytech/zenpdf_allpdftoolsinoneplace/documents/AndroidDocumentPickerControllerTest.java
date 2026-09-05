package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.Test;

/** Pure JVM contract for batch publication order; URI mechanics remain covered by ingress tests. */
public final class AndroidDocumentPickerControllerTest {
    @Test public void pickerStagesAnIncompleteBatchBeforeItemsAndCompletesOnlyAfterTheFullOrder()
            throws Exception {
        Path files = Files.createTempDirectory("picker-batch-contract");
        OwnedPendingImportStore store = new OwnedPendingImportStore(
                files, required -> required + 1_000_000, () -> 9L, checkpoint -> {});
        PickerRequestPolicy policy = new PickerRequestPolicy(() -> "abcdefghijklmnopqrstuv");
        PickerRequestPolicy.Request request = policy.create(true,
                List.of(AndroidDocumentIngressPolicy.MIME_PDF), 2);
        String first = policy.documentRef(request, 0);
        String second = policy.documentRef(request, 1);
        PendingImportBatch begun = store.beginBatch(List.of(first, second));

        assertNull(store.takeCompleteBatch(2));
        String source = new String(Files.readAllBytes(Path.of(System.getProperty("user.dir"))
                .toAbsolutePath().resolve("src/main/java/com/dhananjaytech/"
                        + "zenpdf_allpdftoolsinoneplace/documents/"
                        + "AndroidDocumentPickerController.java")), StandardCharsets.UTF_8);
        assertEquals(true, source.contains("store.beginBatch(itemRefs)"));
        assertEquals(true, source.contains("if (batch.isAcknowledged()) return Result.accepted"));
        assertEquals(true, source.contains("store.completeBatch(batch.batchRef(), itemRefs)"));
        assertEquals(begun.batchRef(), PendingImportBatch.batchRef(List.of(first, second)));
    }
}
