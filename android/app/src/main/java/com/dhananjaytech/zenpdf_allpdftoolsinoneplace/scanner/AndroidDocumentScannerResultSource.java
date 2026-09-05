package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.scanner;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/** Validates native scanner result addresses without exposing them across the bridge. */
final class AndroidDocumentScannerResultSource {
    private static final String ML_KIT_STAGING_ROOT = "mlkit_docscan_ui_client";

    enum Code { INVALID_RESULT, UNAVAILABLE, CLEANUP_FAILED }

    static final class Failure extends Exception {
        private final Code code;
        Failure(Code code) { this.code = Objects.requireNonNull(code); }
        Code code() { return code; }
    }

    @FunctionalInterface
    interface ContentOpener { InputStream open() throws IOException; }

    static Batch resolve(Path cacheDir, String pdfUri, List<String> jpegUris) throws Failure {
        if (cacheDir == null || jpegUris == null || jpegUris.isEmpty()) throw invalid();
        ArrayList<Resolved> resolved = new ArrayList<>();
        try {
            Resolved pdf = resolveOne(cacheDir, pdfUri);
            resolved.add(pdf);
            for (String jpegUri : jpegUris) resolved.add(resolveOne(cacheDir, jpegUri));
            return new Batch(pdf, resolved);
        } catch (Failure failure) {
            try { cleanupFiles(resolved); }
            catch (Failure cleanup) { throw cleanup; }
            throw failure;
        }
    }

    private static Resolved resolveOne(Path cacheDir, String raw) throws Failure {
        if (raw == null || raw.isBlank() || raw.indexOf('\0') >= 0) throw invalid();
        URI uri;
        try { uri = new URI(raw); }
        catch (URISyntaxException | IllegalArgumentException failure) { throw invalid(); }
        if ("content".equals(uri.getScheme())) {
            if (uri.isOpaque() || uri.getRawAuthority() == null
                    || uri.getRawAuthority().isBlank() || uri.getRawFragment() != null) {
                throw invalid();
            }
            return new Resolved(Kind.CONTENT, raw, null, null);
        }
        if (!"file".equals(uri.getScheme()) || uri.isOpaque() || uri.getRawAuthority() != null
                || uri.getRawQuery() != null || uri.getRawFragment() != null) throw invalid();
        try {
            Path cache = requireDirectory(cacheDir);
            Path staging = direct(cache, ML_KIT_STAGING_ROOT);
            Path trustedRoot = requireDirectory(staging);
            Path candidate = Paths.get(uri).toAbsolutePath().normalize();
            if (!candidate.startsWith(trustedRoot) || candidate.equals(trustedRoot)) {
                throw invalid();
            }
            Path cursor = trustedRoot;
            for (Path component : trustedRoot.relativize(candidate)) {
                cursor = cursor.resolve(component);
                if (Files.isSymbolicLink(cursor)) throw invalid();
            }
            BasicFileAttributes identity = attributes(candidate);
            if (!identity.isRegularFile() || identity.size() < 1 || !Files.isReadable(candidate)) {
                throw invalid();
            }
            Path canonical = candidate.toRealPath(LinkOption.NOFOLLOW_LINKS);
            if (!canonical.startsWith(trustedRoot) || canonical.equals(trustedRoot)) throw invalid();
            return new Resolved(Kind.PRIVATE_FILE, raw, canonical, identity);
        } catch (Failure failure) {
            throw failure;
        } catch (IOException | SecurityException failure) {
            throw invalid();
        }
    }

    static final class Batch implements AutoCloseable {
        private final Resolved pdf;
        private final List<Resolved> all;
        private boolean closed;

        private Batch(Resolved pdf, List<Resolved> all) {
            this.pdf = pdf;
            this.all = List.copyOf(all);
        }

        InputStream openPdf(ContentOpener contentOpener) throws Failure {
            if (closed || contentOpener == null) throw unavailable();
            if (pdf.kind == Kind.CONTENT) {
                try {
                    InputStream stream = contentOpener.open();
                    if (stream == null) throw unavailable();
                    return stream;
                } catch (Failure failure) {
                    throw failure;
                } catch (IOException | RuntimeException failure) {
                    throw unavailable();
                }
            }
            return VerifiedFileInputStream.open(pdf);
        }

        int trustedFileCount() {
            int count = 0;
            for (Resolved value : all) if (value.kind == Kind.PRIVATE_FILE) count++;
            return count;
        }

        @Override public void close() throws Failure {
            if (closed) return;
            cleanupFiles(all);
            closed = true;
        }
    }

    private static void cleanupFiles(List<Resolved> values) throws Failure {
        LinkedHashSet<Path> files = new LinkedHashSet<>();
        for (Resolved value : values) {
            if (value != null && value.kind == Kind.PRIVATE_FILE) files.add(value.path);
        }
        Failure failure = null;
        LinkedHashSet<Path> changedDirectories = new LinkedHashSet<>();
        for (Path path : files) {
            try {
                if (Files.exists(path, LinkOption.NOFOLLOW_LINKS)) {
                    if (Files.isSymbolicLink(path)
                            || !Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) {
                        throw new IOException("unsafe");
                    }
                    Files.delete(path);
                }
                if (Files.exists(path, LinkOption.NOFOLLOW_LINKS)) throw new IOException("present");
                changedDirectories.add(path.getParent());
            } catch (IOException | SecurityException problem) {
                failure = cleanupFailed();
            }
        }
        for (Path directory : changedDirectories) {
            try { fsyncDirectory(directory); }
            catch (IOException | SecurityException problem) { failure = cleanupFailed(); }
        }
        if (failure != null) throw failure;
    }

    private static final class VerifiedFileInputStream extends InputStream {
        private final Resolved resolved;
        private final FileChannel channel;
        private boolean closed;

        private VerifiedFileInputStream(Resolved resolved, FileChannel channel) {
            this.resolved = resolved;
            this.channel = channel;
        }

        static InputStream open(Resolved resolved) throws Failure {
            try {
                requireSame(resolved, attributes(resolved.path));
                FileChannel channel = FileChannel.open(resolved.path, StandardOpenOption.READ,
                        LinkOption.NOFOLLOW_LINKS);
                try {
                    requireSame(resolved, attributes(resolved.path));
                    if (channel.size() != resolved.identity.size()) throw new IOException("size");
                    return new VerifiedFileInputStream(resolved, channel);
                } catch (IOException failure) {
                    channel.close();
                    throw failure;
                }
            } catch (IOException | SecurityException failure) {
                throw unavailable();
            }
        }

        @Override public int read() throws IOException {
            byte[] single = new byte[1];
            int count = read(single, 0, 1);
            return count < 0 ? -1 : single[0] & 0xff;
        }

        @Override public int read(byte[] target, int offset, int length) throws IOException {
            Objects.checkFromIndexSize(offset, length, target.length);
            if (closed) throw new IOException("closed");
            requireSame(resolved, attributes(resolved.path));
            int read = channel.read(ByteBuffer.wrap(target, offset, length));
            requireSame(resolved, attributes(resolved.path));
            return read;
        }

        @Override public void close() throws IOException {
            if (closed) return;
            closed = true;
            try {
                requireSame(resolved, attributes(resolved.path));
            } finally {
                channel.close();
            }
        }
    }

    private static void requireSame(Resolved resolved, BasicFileAttributes current)
            throws IOException {
        BasicFileAttributes expected = resolved.identity;
        if (current == null || !current.isRegularFile()
                || !Objects.equals(expected.fileKey(), current.fileKey())
                || expected.size() != current.size()
                || !expected.lastModifiedTime().equals(current.lastModifiedTime())
                || !expected.creationTime().equals(current.creationTime())) {
            throw new IOException("changed");
        }
    }

    private static Path requireDirectory(Path path) throws IOException {
        Path normalized = path.toAbsolutePath().normalize();
        if (Files.isSymbolicLink(normalized)
                || !Files.isDirectory(normalized, LinkOption.NOFOLLOW_LINKS)) {
            throw new IOException("directory");
        }
        return normalized.toRealPath(LinkOption.NOFOLLOW_LINKS);
    }

    private static Path direct(Path parent, String name) throws IOException {
        Path child = parent.resolve(name).normalize();
        if (!parent.equals(child.getParent())) throw new IOException("unsafe");
        return child;
    }

    private static BasicFileAttributes attributes(Path path) throws IOException {
        return Files.readAttributes(path, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
    }

    private static void fsyncDirectory(Path directory) throws IOException {
        try (FileChannel channel = FileChannel.open(directory, StandardOpenOption.READ)) {
            channel.force(true);
        }
    }

    private enum Kind { CONTENT, PRIVATE_FILE }

    private record Resolved(Kind kind, String raw, Path path,
            BasicFileAttributes identity) { }

    private static Failure invalid() { return new Failure(Code.INVALID_RESULT); }
    private static Failure unavailable() { return new Failure(Code.UNAVAILABLE); }
    private static Failure cleanupFailed() { return new Failure(Code.CLEANUP_FAILED); }

    private AndroidDocumentScannerResultSource() { }
}
