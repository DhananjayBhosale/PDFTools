package com.dhananjaytech.zenpdf_allpdftoolsinoneplace;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.TreeSet;
import org.junit.Test;

public final class AndroidAppMetadataPluginContractTest {
    @Test public void pluginExposesOnlyTheNoArgumentMetadataMethod() throws Exception {
        Class<?> type = AndroidAppMetadataPlugin.class;
        CapacitorPlugin annotation = type.getAnnotation(CapacitorPlugin.class);
        assertNotNull(annotation);
        assertEquals("AndroidAppMetadata", annotation.name());
        assertArrayEquals(new int[0], annotation.requestCodes());
        assertEquals(0, annotation.permissions().length);
        assertTrue(Modifier.isPublic(type.getModifiers()));
        assertTrue(Modifier.isFinal(type.getModifiers()));
        assertEquals(Plugin.class, type.getSuperclass());
        Constructor<?> constructor = type.getConstructor();
        assertTrue(Modifier.isPublic(constructor.getModifiers()));
        assertEquals(0, constructor.getParameterCount());

        TreeSet<String> exposed = new TreeSet<>();
        for (Method method : type.getDeclaredMethods()) {
            PluginMethod pluginMethod = method.getAnnotation(PluginMethod.class);
            if (pluginMethod == null) continue;
            exposed.add(method.getName());
            assertTrue(Modifier.isPublic(method.getModifiers()));
            assertEquals(void.class, method.getReturnType());
            assertArrayEquals(new Class<?>[] {PluginCall.class}, method.getParameterTypes());
            assertEquals(PluginMethod.RETURN_PROMISE, pluginMethod.returnType());
        }
        assertEquals(Set.of("getMetadata"), exposed);
    }

    @Test public void bridgeWireIsExactPublicMetadataAndDoesNotLeakDetails() throws Exception {
        String source = source("src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/"
                + "AndroidAppMetadataPlugin.java");
        assertTrue(source.contains("request.length() != 0"));
        assertEquals(1, occurrences(source, "output.put(\"name\""));
        assertEquals(1, occurrences(source, "output.put(\"version\""));
        assertEquals(1, occurrences(source, "output.put(\"build\""));
        assertTrue(source.contains("loadLabel(packageManager)"));
        assertTrue(source.contains("packageInfo.versionName"));
        assertTrue(source.contains("getLongVersionCode()"));
        assertTrue(source.contains("build == null ? JSONObject.NULL : build"));
        assertTrue(source.contains("APP_METADATA_INVALID_ARGUMENT"));
        assertTrue(source.contains("APP_METADATA_UNAVAILABLE"));
        assertTrue(source.contains("text.isBlank()"));
        assertTrue(source.contains("text.indexOf('\\0')"));
        for (String absent : new String[] {"getMessage()", "printStackTrace(", "Log.",
                "System.out", "addListener", "output.put(\"package", "output.put(\"installer",
                "output.put(\"signer", "output.put(\"path", "output.put(\"device",
                "output.put(\"channel", "output.put(\"telemetry", "output.put(\"permission"}) {
            assertFalse(absent, source.contains(absent));
        }
    }

    private static int occurrences(String source, String value) {
        int count = 0;
        for (int at = 0; (at = source.indexOf(value, at)) >= 0; at += value.length()) count++;
        return count;
    }

    private static String source(String relative) throws Exception {
        Path directory = Path.of(System.getProperty("user.dir")).toAbsolutePath();
        while (directory != null) {
            Path app = Files.isDirectory(directory.resolve("src/main"))
                    ? directory : directory.resolve("android/app");
            Path file = app.resolve(relative);
            if (Files.isRegularFile(file)) {
                return new String(Files.readAllBytes(file), StandardCharsets.UTF_8);
            }
            directory = directory.getParent();
        }
        throw new AssertionError("Could not locate " + relative);
    }
}
