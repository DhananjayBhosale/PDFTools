package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.reader;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.Set;
import org.junit.Test;

public final class PdfReaderLaunchContractTest {
    @Test public void referencesAndDisplayNamesAreCanonicalAndBounded() {
        assertTrue(PdfReaderLaunchContract.isCanonicalRef("a1_1"));
        assertTrue(PdfReaderLaunchContract.isCanonicalRef("a1_9007199254740991"));
        assertTrue(PdfReaderLaunchContract.isCanonicalRef("d1_abcdefghijklmnopqrstuv"));
        for (String invalid : new String[] {"", "a1_0", "a1_01", "a1_9007199254740992",
                "d1_short", "content://private/pdf", "/private/pdf"}) {
            assertFalse(invalid, PdfReaderLaunchContract.isCanonicalRef(invalid));
        }
        assertTrue(PdfReaderLaunchContract.isSafeDisplayName("Reader 😀.pdf"));
        for (String invalid : new String[] {"", " ", ".", "..", "bad/name.pdf",
                "bad\\name.pdf", "bad\0name.pdf", "bad\ud800name", "bad\udc00name"}) {
            assertFalse(invalid, PdfReaderLaunchContract.isSafeDisplayName(invalid));
        }
        assertFalse(PdfReaderLaunchContract.isSafeDisplayName("é".repeat(361)));
    }

    @Test public void toolAllowlistExactlyMatchesTheFrozenViewerRoutes() {
        assertEquals(Set.of("/compress", "/merge", "/split", "/edit", "/make-fillable",
                "/sign", "/watermark", "/protect", "/unlock", "/delete-pages",
                "/page-numbers", "/reorder", "/rotate", "/flatten", "/extract",
                "/pdf-to-jpg", "/pdf-to-word", "/ocr", "/metadata", "/repair",
                "/compare"), PdfReaderLaunchContract.toolPaths());
        assertFalse(PdfReaderLaunchContract.toolPaths().contains("/view"));
    }
}
