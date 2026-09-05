package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.google.gson.JsonObject;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public final class LegacyDocumentOpenResolverInstrumentedTest {
    @Test public void successfulAndRefusedReadsLeaveExactNoFollowTreeUnchanged() throws Exception {
        Path outer = InstrumentationRegistry.getInstrumentation().getTargetContext()
                .getCacheDir().toPath().resolve("legacy-open-" + UUID.randomUUID());
        Files.createDirectory(outer);
        Path files = Files.createDirectory(outer.resolve("files"));
        Path processed = Files.createDirectory(files.resolve("processed"));
        byte[] document = new byte[BoundedDocumentReader.MAXIMUM_CHUNK_BYTES + 17];
        for (int index = 0; index < document.length; index++) document[index] = (byte) (index % 239);
        Files.write(processed.resolve("large.pdf"), document);
        Path collection = Files.createDirectory(processed.resolve("album"));
        Files.write(collection.resolve("child.pdf"), new byte[] {1});
        Path victim = outer.resolve("victim.pdf");
        Files.write(victim, new byte[] {9, 8, 7});
        Files.createSymbolicLink(processed.resolve("linked.pdf"), victim);
        Files.write(files.resolve("processed_index.json"), ("["
                + record(1, "Large", "VIEW", document.length, "large.pdf", false) + ","
                + record(2, "Album", "MERGE", 1, "album", true) + ","
                + record(3, "Linked", "VIEW", 3, "linked.pdf", false) + "]")
                        .getBytes(StandardCharsets.UTF_8));

        List<String> before = manifest(outer);
        LegacyDocumentOpenResolver resolver = new LegacyDocumentOpenResolver(files.toFile());
        BoundedDocumentReader.Chunk first = resolver.readChunk(
                "a1_1", 0, BoundedDocumentReader.MAXIMUM_CHUNK_BYTES);
        assertEquals(BoundedDocumentReader.MAXIMUM_CHUNK_BYTES, first.bytes().length);
        assertFalse(first.done());
        BoundedDocumentReader.Chunk second = resolver.readChunk(
                "a1_1", first.nextOffset(), BoundedDocumentReader.MAXIMUM_CHUNK_BYTES);
        assertArrayEquals(java.util.Arrays.copyOfRange(document,
                BoundedDocumentReader.MAXIMUM_CHUNK_BYTES, document.length), second.bytes());
        assertTrue(second.done());

        assertFailure("LEGACY_DOCUMENT_COLLECTION_UNSUPPORTED", resolver, "a1_2");
        assertFailure("LEGACY_DOCUMENT_UNSAFE_STATE", resolver, "a1_3");
        assertFailure("LEGACY_DOCUMENT_INVALID_ARGUMENT", resolver,
                "content://private.provider/large.pdf");
        assertEquals(before, manifest(outer));
    }

    private static String record(long id, String display, String tool, long size,
            String stored, boolean collection) {
        JsonObject value = new JsonObject();
        value.addProperty("id", id);
        value.addProperty("displayName", display);
        value.addProperty("toolName", tool);
        value.addProperty("sizeBytes", size);
        value.addProperty("createdAtMillis", id);
        value.addProperty("storedFileName", stored);
        value.addProperty("mimeType", "application/pdf");
        value.addProperty("isDirectory", collection);
        if (collection) value.addProperty("itemCount", 1);
        return value.toString();
    }

    private static List<String> manifest(Path root) throws Exception {
        ArrayList<String> result = new ArrayList<>();
        try (var paths = Files.walk(root)) {
            for (Path path : (Iterable<Path>) paths.sorted()::iterator) {
                BasicFileAttributes attributes = Files.readAttributes(
                        path, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
                String kind = attributes.isSymbolicLink() ? "link"
                        : attributes.isDirectory() ? "dir"
                        : attributes.isRegularFile() ? "file" : "other";
                String hash = attributes.isRegularFile()
                        ? lowercaseHex(MessageDigest.getInstance("SHA-256")
                                .digest(Files.readAllBytes(path)))
                        : "-";
                String linkTarget = attributes.isSymbolicLink()
                        ? Files.readSymbolicLink(path).toString() : "-";
                result.add(root.relativize(path) + "|" + kind + "|"
                        + attributes.size() + "|" + hash + "|" + linkTarget);
            }
        }
        return result;
    }

    private static String lowercaseHex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) result.append(String.format("%02x", value & 0xff));
        return result.toString();
    }

    private static void assertFailure(String code, LegacyDocumentOpenResolver resolver, String ref)
            throws Exception {
        try {
            resolver.readChunk(ref, 0, 1);
            fail("Expected " + code);
        } catch (LegacyDocumentOpenResolver.Failure failure) {
            assertEquals(code, failure.code());
            assertFalse(failure.getMessage().contains("content://"));
            assertFalse(failure.getMessage().contains("processed"));
            assertFalse(failure.getMessage().contains(".pdf"));
        }
    }
}
