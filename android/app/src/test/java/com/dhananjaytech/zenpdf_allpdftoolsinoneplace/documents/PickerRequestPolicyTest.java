package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.util.List;
import org.junit.Test;

public final class PickerRequestPolicyTest {
    private static final List<String> ALL = List.of(
            AndroidDocumentIngressPolicy.MIME_PDF,
            AndroidDocumentIngressPolicy.MIME_JPEG,
            AndroidDocumentIngressPolicy.MIME_PNG,
            AndroidDocumentIngressPolicy.MIME_HEIC,
            AndroidDocumentIngressPolicy.MIME_DOCX,
            AndroidDocumentIngressPolicy.MIME_PPTX);

    @Test public void createsOnlyUserInitiatedBoundedRequests() throws Exception {
        PickerRequestPolicy policy = policy();
        PickerRequestPolicy.Request request = policy.create(true, ALL, 100);
        assertTrue(request.sessionRef().matches("b1_[A-Za-z0-9_-]{22,64}"));
        assertEquals(ALL, request.acceptedMimeTypes());
        assertEquals(100, request.maximumItems());

        assertFailure("DOCUMENT_INVALID_ARGUMENT", () -> policy.create(false, ALL, 1));
        assertFailure("DOCUMENT_INVALID_ARGUMENT", () -> policy.create(true, ALL, 0));
        assertFailure("DOCUMENT_LIMIT_EXCEEDED", () -> policy.create(true, ALL, 101));
    }

    @Test public void enforcesExactClosedMimeSubsetAndOrder() throws Exception {
        PickerRequestPolicy policy = policy();
        List<String> chosen = List.of(
                AndroidDocumentIngressPolicy.MIME_PNG,
                AndroidDocumentIngressPolicy.MIME_PDF);
        assertEquals(chosen, policy.create(true, chosen, 2).acceptedMimeTypes());
        assertFailure("DOCUMENT_INVALID_ARGUMENT", () ->
                policy.create(true, List.of("image/*"), 1));
        assertFailure("DOCUMENT_INVALID_ARGUMENT", () ->
                policy.create(true, List.of("Application/Pdf"), 1));
        assertFailure("DOCUMENT_INVALID_ARGUMENT", () ->
                policy.create(true, List.of(
                        AndroidDocumentIngressPolicy.MIME_PDF,
                        AndroidDocumentIngressPolicy.MIME_PDF), 2));
        assertFailure("DOCUMENT_INVALID_ARGUMENT", () ->
                policy.create(true, List.of(), 1));
    }

    @Test public void restorationAcceptsOnlyOpaquePolicyState() throws Exception {
        PickerRequestPolicy policy = policy();
        PickerRequestPolicy.Request first = policy.create(true, ALL, 4);
        PickerRequestPolicy.Request restored = policy.restore(
                first.sessionRef(), first.acceptedMimeTypes(), first.maximumItems());
        assertEquals(first.sessionRef(), restored.sessionRef());
        assertEquals(first.acceptedMimeTypes(), restored.acceptedMimeTypes());
        assertEquals(first.maximumItems(), restored.maximumItems());

        assertFailure("DOCUMENT_INVALID_ARGUMENT", () -> policy.restore(
                "content://private.provider/file.pdf", ALL, 4));
        assertFailure("DOCUMENT_INVALID_ARGUMENT", () -> policy.restore(
                "b1_short", ALL, 4));
    }

    @Test public void derivedDocumentRefsAreStableOpaqueAndIndexBound() throws Exception {
        PickerRequestPolicy policy = policy();
        PickerRequestPolicy.Request request = policy.create(true, ALL, 3);
        String first = policy.documentRef(request, 0);
        String retry = policy.documentRef(request, 0);
        String second = policy.documentRef(request, 1);
        assertEquals(first, retry);
        assertNotEquals(first, second);
        assertTrue(first.matches("d1_[A-Za-z0-9_-]{22,64}"));
        assertFalse(first.contains(request.sessionRef()));
        assertFailure("DOCUMENT_INVALID_ARGUMENT", () -> policy.documentRef(request, -1));
        assertFailure("DOCUMENT_INVALID_ARGUMENT", () -> policy.documentRef(request, 3));
    }

    @Test public void requestAndFailureSurfacesContainNoProviderState() throws Exception {
        PickerRequestPolicy.Request request = policy().create(
                true, List.of(AndroidDocumentIngressPolicy.MIME_PDF), 1);
        String rendered = request.sessionRef() + request.acceptedMimeTypes() + request.maximumItems();
        assertFalse(rendered.contains("content://"));
        assertFalse(rendered.contains("provider"));
        try {
            policy().restore("content://private.provider/name.pdf", ALL, 1);
            fail("Expected rejection");
        } catch (PickerRequestPolicy.Failure failure) {
            assertEquals("DOCUMENT_INVALID_ARGUMENT", failure.code());
            assertEquals("The document request is invalid.", failure.getMessage());
            assertFalse(failure.getMessage().contains("provider"));
        }
    }

    private static PickerRequestPolicy policy() {
        return new PickerRequestPolicy(() ->
                "abcdefghijklmnopqrstuv");
    }

    private static void assertFailure(String code, ThrowingRunnable runnable) {
        try {
            runnable.run();
            fail("Expected " + code);
        } catch (PickerRequestPolicy.Failure failure) {
            assertEquals(code, failure.code());
        } catch (Exception unexpected) {
            throw new AssertionError(unexpected);
        }
    }

    private interface ThrowingRunnable { void run() throws Exception; }
}
