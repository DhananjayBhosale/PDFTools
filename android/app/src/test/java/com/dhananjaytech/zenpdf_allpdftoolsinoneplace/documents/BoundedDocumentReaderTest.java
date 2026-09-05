package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Arrays;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public final class BoundedDocumentReaderTest {
    @Rule public final TemporaryFolder temporary = new TemporaryFolder();

    @Test public void exactMaximumWindowEofAndDefensiveBytesAreBounded() throws Exception {
        Path file = temporary.newFile("large.bin").toPath();
        byte[] source = new byte[BoundedDocumentReader.MAXIMUM_CHUNK_BYTES + 10];
        for (int index = 0; index < source.length; index++) source[index] = (byte) (index % 251);
        Files.write(file, source);

        BoundedDocumentReader reader = new BoundedDocumentReader();
        BoundedDocumentReader.Identity identity = reader.identity(file);
        BoundedDocumentReader.Chunk first = reader.read(
                file, identity, 0, BoundedDocumentReader.MAXIMUM_CHUNK_BYTES);
        assertEquals(BoundedDocumentReader.MAXIMUM_CHUNK_BYTES, first.bytes().length);
        assertEquals(BoundedDocumentReader.MAXIMUM_CHUNK_BYTES, first.nextOffset());
        assertFalse(first.done());
        assertArrayEquals(Arrays.copyOf(source, BoundedDocumentReader.MAXIMUM_CHUNK_BYTES),
                first.bytes());

        byte[] escaped = first.bytes();
        escaped[0] ^= 1;
        assertEquals(source[0], first.bytes()[0]);

        BoundedDocumentReader.Chunk last = reader.read(
                file, identity, first.nextOffset(), 100);
        assertArrayEquals(Arrays.copyOfRange(source,
                BoundedDocumentReader.MAXIMUM_CHUNK_BYTES, source.length), last.bytes());
        assertEquals(source.length, last.nextOffset());
        assertTrue(last.done());

        BoundedDocumentReader.Chunk eof = reader.read(file, identity, source.length, 1);
        assertEquals(0, eof.bytes().length);
        assertEquals(source.length, eof.nextOffset());
        assertTrue(eof.done());
        assertIllegal(() -> reader.read(file, identity, source.length + 1L, 1));
        assertIllegal(() -> reader.read(file, identity, 0, 0));
        assertIllegal(() -> reader.read(file, identity, 0,
                BoundedDocumentReader.MAXIMUM_CHUNK_BYTES + 1));
    }

    @Test public void replacementAfterPrecheckIsRejectedWithoutReturningBytes() throws Exception {
        Path file = temporary.newFile("replace-before-open.bin").toPath();
        Files.write(file, new byte[] {1, 2, 3, 4});
        Path replacement = temporary.newFile("replacement-before-open.bin").toPath();
        Files.write(replacement, new byte[] {9, 8, 7, 6});
        BoundedDocumentReader baseline = new BoundedDocumentReader();
        BoundedDocumentReader.Identity identity = baseline.identity(file);
        BoundedDocumentReader reader = new BoundedDocumentReader(checkpoint -> {
            if (checkpoint == BoundedDocumentReader.Checkpoint.AFTER_PRECHECK) {
                Files.move(replacement, file, StandardCopyOption.REPLACE_EXISTING,
                        StandardCopyOption.ATOMIC_MOVE);
            }
        });
        assertUnsafe(() -> reader.read(file, identity, 0, 4));
    }

    @Test public void replacementAfterOpenIsRejectedWithoutReturningBytes() throws Exception {
        Path file = temporary.newFile("replace-after-open.bin").toPath();
        Files.write(file, new byte[] {1, 2, 3, 4});
        Path replacement = temporary.newFile("replacement-after-open.bin").toPath();
        Files.write(replacement, new byte[] {9, 8, 7, 6});
        BoundedDocumentReader baseline = new BoundedDocumentReader();
        BoundedDocumentReader.Identity identity = baseline.identity(file);
        BoundedDocumentReader reader = new BoundedDocumentReader(checkpoint -> {
            if (checkpoint == BoundedDocumentReader.Checkpoint.AFTER_OPEN) {
                Files.move(replacement, file, StandardCopyOption.REPLACE_EXISTING,
                        StandardCopyOption.ATOMIC_MOVE);
            }
        });
        assertUnsafe(() -> reader.read(file, identity, 0, 4));
    }

    @Test public void symbolicLinkCannotBeCapturedOrRead() throws Exception {
        Path victim = temporary.newFile("victim.bin").toPath();
        Files.write(victim, new byte[] {4, 5, 6});
        Path link = victim.getParent().resolve("link.bin");
        Files.createSymbolicLink(link, victim);
        BoundedDocumentReader reader = new BoundedDocumentReader();
        try {
            reader.identity(link);
            fail("Expected unsafe link");
        } catch (BoundedDocumentReader.UnsafeReadException expected) {
            assertTrue(true);
        }
    }

    private static void assertIllegal(ThrowingRunnable runnable) throws Exception {
        try {
            runnable.run();
            fail("Expected invalid read");
        } catch (IllegalArgumentException expected) {
            assertTrue(true);
        }
    }

    private static void assertUnsafe(ThrowingRunnable runnable) throws Exception {
        try {
            runnable.run();
            fail("Expected unsafe read");
        } catch (BoundedDocumentReader.UnsafeReadException expected) {
            assertTrue(true);
        }
    }

    private interface ThrowingRunnable { void run() throws Exception; }
}
