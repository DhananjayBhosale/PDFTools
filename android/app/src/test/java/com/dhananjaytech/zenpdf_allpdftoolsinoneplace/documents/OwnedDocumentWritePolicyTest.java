package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public final class OwnedDocumentWritePolicyTest {
    @Test public void displayNamesPreserveValidUnicodeButRejectMalformedUtf16() {
        assertTrue(OwnedDocumentWritePolicy.isValidDisplayName("Résumé 😀.pdf"));
        assertFalse(OwnedDocumentWritePolicy.isValidDisplayName("bad\ud800name"));
        assertFalse(OwnedDocumentWritePolicy.isValidDisplayName("bad\udc00name"));
    }

    @Test public void outputMimeSetIsClosed() {
        assertTrue(OwnedDocumentWritePolicy.isSupportedMimeType(OwnedDocumentWritePolicy.MIME_TEXT));
        assertTrue(OwnedDocumentWritePolicy.isSupportedMimeType(OwnedDocumentWritePolicy.MIME_WEBP));
        assertFalse(OwnedDocumentWritePolicy.isSupportedMimeType("text/html"));
    }
}
