package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents;

import java.nio.charset.StandardCharsets;
import java.util.Set;

/** Closed policy for locally owned writes; it intentionally does not widen ingress. */
final class OwnedDocumentWritePolicy {
    static final String MIME_PDF = "application/pdf";
    static final String MIME_ZIP = "application/zip";
    static final String MIME_TEXT = "text/plain";
    static final String MIME_JPEG = "image/jpeg";
    static final String MIME_PNG = "image/png";
    static final String MIME_WEBP = "image/webp";
    static final String MIME_HEIC = "image/heic";
    static final String MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    static final String MIME_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

    private static final Set<String> MIME_TYPES = Set.of(MIME_PDF, MIME_ZIP, MIME_TEXT,
            MIME_JPEG, MIME_PNG, MIME_WEBP, MIME_HEIC, MIME_DOCX, MIME_PPTX);

    private OwnedDocumentWritePolicy() { }

    static boolean isSupportedMimeType(String value) { return MIME_TYPES.contains(value); }

    static boolean isValidDisplayName(String value) {
        if (value == null) return true;
        if (value.isBlank() || value.indexOf('\0') >= 0 || value.indexOf('/') >= 0
                || value.indexOf('\\') >= 0 || ".".equals(value) || "..".equals(value)
                || value.length() > 180) return false;
        byte[] bytes = utf8Bytes(value);
        return bytes != null && bytes.length <= 720;
    }

    static byte[] utf8Bytes(String value) {
        try {
            java.nio.charset.CharsetEncoder encoder = StandardCharsets.UTF_8.newEncoder()
                    .onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
                    .onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT);
            java.nio.ByteBuffer bytes = encoder.encode(java.nio.CharBuffer.wrap(value));
            byte[] result = new byte[bytes.remaining()]; bytes.get(result); return result;
        } catch (java.nio.charset.CharacterCodingException failure) { return null; }
    }

    static boolean hasValidMagic(String mimeType, byte[] prefix) {
        if (!isSupportedMimeType(mimeType) || prefix == null) return false;
        if (MIME_TEXT.equals(mimeType)) return true;
        if (MIME_PDF.equals(mimeType)) return begins(prefix, 0, 0x25, 0x50, 0x44, 0x46, 0x2d);
        if (MIME_ZIP.equals(mimeType) || MIME_DOCX.equals(mimeType) || MIME_PPTX.equals(mimeType)) {
            return begins(prefix, 0, 0x50, 0x4b, 0x03, 0x04);
        }
        if (MIME_JPEG.equals(mimeType)) return begins(prefix, 0, 0xff, 0xd8, 0xff);
        if (MIME_PNG.equals(mimeType)) return begins(prefix, 0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
        if (MIME_WEBP.equals(mimeType)) return begins(prefix, 0, 0x52, 0x49, 0x46, 0x46)
                && begins(prefix, 8, 0x57, 0x45, 0x42, 0x50);
        if (MIME_HEIC.equals(mimeType) && prefix.length >= 12 && begins(prefix, 4, 0x66, 0x74, 0x79, 0x70)) {
            String brand = new String(prefix, 8, 4, StandardCharsets.US_ASCII);
            return Set.of("heic", "heix", "hevc", "hevx", "mif1", "msf1").contains(brand);
        }
        return false;
    }

    private static boolean begins(byte[] value, int offset, int... expected) {
        if (value.length < offset + expected.length) return false;
        for (int i = 0; i < expected.length; i++) if ((value[offset + i] & 0xff) != expected[i]) return false;
        return true;
    }
}
