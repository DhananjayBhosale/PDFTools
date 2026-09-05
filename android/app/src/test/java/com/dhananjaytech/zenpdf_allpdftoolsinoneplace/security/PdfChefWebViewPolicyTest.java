package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.security;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public final class PdfChefWebViewPolicyTest {
    @Test public void acceptsOnlyThePackagedLocalOrigin() {
        assertEquals(PdfChefWebViewPolicy.Navigation.ALLOW_PACKAGED_ORIGIN,
                PdfChefWebViewPolicy.decide("https://localhost/"));
        assertEquals(PdfChefWebViewPolicy.Navigation.ALLOW_PACKAGED_ORIGIN,
                PdfChefWebViewPolicy.decide("https://localhost/tools?source=home#top"));

        for (String blocked : new String[] {
                "https://localhost.evil.example/", "https://localhost:8443/", "http://localhost/",
                "https://user@localhost/", "file:///android_asset/index.html", "content://provider/item",
                "intent://open/#Intent;scheme=https;end", "javascript:alert(1)", "data:text/html,x",
                "blob:https://localhost/id", "https://localhost\\@evil.example/", "not a url"
        }) {
            assertEquals(blocked, PdfChefWebViewPolicy.Navigation.BLOCK,
                    PdfChefWebViewPolicy.decide(blocked));
        }
    }

    @Test public void keepsExistingWebAndEmailLinksVisibleOutsideTheBridge() {
        assertEquals(PdfChefWebViewPolicy.Navigation.OPEN_EXTERNAL_BROWSER,
                PdfChefWebViewPolicy.decide("https://www.example.com/help"));
        assertEquals(PdfChefWebViewPolicy.Navigation.OPEN_EXTERNAL_BROWSER,
                PdfChefWebViewPolicy.decide("http://www.example.com/legacy"));
        assertEquals(PdfChefWebViewPolicy.Navigation.OPEN_EXTERNAL_BROWSER,
                PdfChefWebViewPolicy.decide("mailto:support@example.com"));
        assertEquals(PdfChefWebViewPolicy.Navigation.BLOCK,
                PdfChefWebViewPolicy.decide("mailto:support@example.com%0d%0aBcc:attacker@example.com"));
        assertEquals(PdfChefWebViewPolicy.Navigation.BLOCK,
                PdfChefWebViewPolicy.decide("tel:+123456789"));
        assertEquals(PdfChefWebViewPolicy.Navigation.BLOCK,
                PdfChefWebViewPolicy.decide("https://user@example.com/"));
    }
}
