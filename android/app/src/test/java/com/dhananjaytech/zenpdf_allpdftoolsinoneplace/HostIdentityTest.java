package com.dhananjaytech.zenpdf_allpdftoolsinoneplace;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class HostIdentityTest {
    @Test
    public void debugApplicationIdIsIsolatedFromProduction() {
        assertEquals("com.dhananjaytech.pdfchef.debug", BuildConfig.APPLICATION_ID);
    }
}
