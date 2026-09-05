package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.gson.JsonObject;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Set;
import java.util.SortedMap;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.concurrent.Callable;
import org.junit.Test;

public final class AndroidLegacyInspectorContractTest {
    @Test public void pluginSurfaceIsExactlyTwoPublicPromiseReads() throws Exception {
        Class<?> type = AndroidLegacyInspectorPlugin.class;
        CapacitorPlugin annotation = type.getAnnotation(CapacitorPlugin.class);
        assertNotNull(annotation);
        assertEquals("AndroidLegacyInspector", annotation.name());
        assertArrayEquals(new int[0], annotation.requestCodes());
        assertEquals(0, annotation.permissions().length);
        assertTrue(Modifier.isPublic(type.getModifiers()));
        assertTrue(Modifier.isFinal(type.getModifiers()));
        assertEquals(Plugin.class, type.getSuperclass());
        Constructor<?> constructor = type.getConstructor();
        assertTrue(Modifier.isPublic(constructor.getModifiers()));
        assertEquals(0, constructor.getParameterCount());

        SortedMap<String, Method> exposed = new TreeMap<>();
        for (Method method : type.getDeclaredMethods()) {
            PluginMethod pluginMethod = method.getAnnotation(PluginMethod.class);
            if (pluginMethod == null) continue;
            assertTrue(Modifier.isPublic(method.getModifiers()));
            assertEquals(void.class, method.getReturnType());
            assertArrayEquals(new Class<?>[] {PluginCall.class}, method.getParameterTypes());
            assertEquals(PluginMethod.RETURN_PROMISE, pluginMethod.returnType());
            exposed.put(method.getName(), method);
        }
        assertEquals(Set.of("readHistory", "readSettings"), exposed.keySet());
        assertEquals(2, exposed.size());
        for (Method method : type.getDeclaredMethods()) {
            assertFalse(method.getName().matches("(?i).*(write|save|delete|remove|update|mutate|clear|migrate|import|export|copy|move|rename|create|edit).*"));
        }
    }

    @Test public void inspectorsExposePureGsonReadResults() throws Exception {
        for (Class<?> inspector : Arrays.asList(LegacyHistoryInspector.class, LegacySettingsInspector.class)) {
            assertTrue(Modifier.isPublic(inspector.getModifiers()));
            assertTrue(Modifier.isFinal(inspector.getModifiers()));
            assertEquals(0, inspector.getInterfaces().length);
            Method read = inspector.getMethod("read");
            assertTrue(Modifier.isPublic(read.getModifiers()));
            assertEquals(JsonObject.class, read.getReturnType());
            assertEquals(0, read.getParameterCount());
            for (Method method : inspector.getDeclaredMethods()) {
                assertFalse(method.getName().matches("(?i).*(write|save|delete|remove|update|mutate|clear|migrate|import|export|copy|move|rename|create|edit).*"));
            }
        }
    }

    @Test public void registrationExpansionPreservesLegacyFirstAndSecond() throws Exception {
        Path root = Path.of(System.getProperty("user.dir")).toAbsolutePath();
        while (root != null && !Files.isRegularFile(root.resolve(
                "src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/MainActivity.java"))) {
            Path nested = root.resolve("android/app/src/main/java/com/dhananjaytech/"
                    + "zenpdf_allpdftoolsinoneplace/MainActivity.java");
            if (Files.isRegularFile(nested)) { root = root.resolve("android/app"); break; }
            root = root.getParent();
        }
        assertNotNull(root);
        String activity = new String(Files.readAllBytes(root.resolve(
                "src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/MainActivity.java")),
                java.nio.charset.StandardCharsets.UTF_8);
        int inspector = activity.indexOf("registerPlugin(AndroidLegacyInspectorPlugin.class)");
        int writer = activity.indexOf("registerPlugin(AndroidLegacySettingsWriterPlugin.class)");
        int documents = activity.indexOf("registerPlugin(AndroidDocumentsPlugin.class)");
        int bridge = activity.indexOf("super.onCreate(savedInstanceState)");
        assertTrue(inspector >= 0 && inspector < writer && writer < documents && documents < bridge);
    }
}

/** Full-tree, no-follow preservation oracle shared by every behavioral read. */
final class LegacyInspectorTestSupport {
    static final class TreeEntry {
        final String type;
        final long size;
        final long modifiedMillis;
        final String sha256;
        final String symlinkTarget;
        TreeEntry(String type, long size, long modifiedMillis, String sha256, String symlinkTarget) {
            this.type = type; this.size = size; this.modifiedMillis = modifiedMillis;
            this.sha256 = sha256; this.symlinkTarget = symlinkTarget;
        }
        @Override public boolean equals(Object other) {
            if (!(other instanceof TreeEntry)) return false;
            TreeEntry that = (TreeEntry) other;
            return type.equals(that.type) && size == that.size && modifiedMillis == that.modifiedMillis
                    && sha256.equals(that.sha256) && symlinkTarget.equals(that.symlinkTarget);
        }
        @Override public int hashCode() {
            return java.util.Objects.hash(type, size, modifiedMillis, sha256, symlinkTarget);
        }
        @Override public String toString() {
            return type + "|" + size + "|" + modifiedMillis + "|" + sha256 + "|" + symlinkTarget;
        }
    }

    static JsonObject inspectTwiceUnchanged(Path fullSyntheticRoot, Callable<JsonObject> inspection)
            throws Exception {
        SortedMap<String, TreeEntry> before = snapshotTree(fullSyntheticRoot);
        JsonObject first = inspection.call();
        assertEquals("first read mutated the synthetic root", before, snapshotTree(fullSyntheticRoot));
        JsonObject second = inspection.call();
        assertEquals("two reads returned structurally different Gson trees", first, second);
        assertEquals("second read mutated the synthetic root", before, snapshotTree(fullSyntheticRoot));
        return first;
    }

    static void assertExactKeys(JsonObject value, String... keys) {
        assertEquals(new TreeSet<>(Arrays.asList(keys)), new TreeSet<>(value.keySet()));
    }

    static void assertHistory(JsonObject value, String health, int source, int invalid,
            int returned, boolean truncated) {
        assertExactKeys(value, "health", "sourceCount", "invalidRecordCount", "returnedCount",
                "truncated", "entries");
        assertEquals(health, value.get("health").getAsString());
        assertEquals(source, value.get("sourceCount").getAsInt());
        assertEquals(invalid, value.get("invalidRecordCount").getAsInt());
        assertEquals(returned, value.get("returnedCount").getAsInt());
        assertEquals(truncated, value.get("truncated").getAsBoolean());
        assertEquals(returned, value.getAsJsonArray("entries").size());
    }

    static void assertSettings(JsonObject value, String health, int invalid) {
        assertExactKeys(value, "health", "invalidValueCount", "values");
        assertEquals(health, value.get("health").getAsString());
        assertEquals(invalid, value.get("invalidValueCount").getAsInt());
        assertTrue(value.get("values").isJsonObject());
    }

    static SortedMap<String, TreeEntry> snapshotTree(Path root) throws Exception {
        SortedMap<String, TreeEntry> entries = new TreeMap<>();
        if (!Files.exists(root, LinkOption.NOFOLLOW_LINKS)) {
            entries.put("<absent-root>", new TreeEntry("ABSENT", 0, 0, "", ""));
            return entries;
        }
        Files.walkFileTree(root, new SimpleFileVisitor<Path>() {
            @Override public FileVisitResult preVisitDirectory(Path directory, BasicFileAttributes attrs)
                    throws java.io.IOException { add(directory); return FileVisitResult.CONTINUE; }
            @Override public FileVisitResult visitFile(Path file, BasicFileAttributes attrs)
                    throws java.io.IOException { add(file); return FileVisitResult.CONTINUE; }
            private void add(Path path) throws java.io.IOException {
                BasicFileAttributes attributes = Files.readAttributes(path, BasicFileAttributes.class,
                        LinkOption.NOFOLLOW_LINKS);
                String type = attributes.isRegularFile() ? "REGULAR_FILE"
                        : attributes.isDirectory() ? "DIRECTORY"
                        : attributes.isSymbolicLink() ? "SYMLINK" : "OTHER";
                String target = attributes.isSymbolicLink() ? Files.readSymbolicLink(path).toString() : "";
                String sha = attributes.isRegularFile() ? digest(Files.readAllBytes(path)) : "";
                String relative = root.relativize(path).normalize().toString().replace('\\', '/');
                if (relative.isEmpty()) relative = ".";
                entries.put(relative, new TreeEntry(type, attributes.size(),
                        attributes.lastModifiedTime().toMillis(), sha, target));
            }
        });
        return entries;
    }

    private static String digest(byte[] bytes) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder out = new StringBuilder();
            for (byte value : hash) out.append(String.format("%02x", value));
            return out.toString();
        } catch (Exception failure) { throw new AssertionError(failure); }
    }
}
