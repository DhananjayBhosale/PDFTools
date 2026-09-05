package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import android.app.Application;
import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.PdfChefApplication;
import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents.DocumentLifecycleCoordinator;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.junit.Test;

public final class AndroidLegacySettingsWriterContractTest {
    @Test public void pluginDeclaresExactlyOnePromiseMethod() throws Exception {
        Class<?> type = AndroidLegacySettingsWriterPlugin.class;
        CapacitorPlugin annotation = type.getAnnotation(CapacitorPlugin.class);
        assertNotNull(annotation);
        assertEquals("AndroidLegacySettingsWriter", annotation.name());
        assertArrayEquals(new int[0], annotation.requestCodes());
        assertEquals(0, annotation.permissions().length);
        assertTrue(Modifier.isPublic(type.getModifiers()));
        assertTrue(Modifier.isFinal(type.getModifiers()));
        assertEquals(Plugin.class, type.getSuperclass());
        Constructor<?> constructor = type.getConstructor();
        assertTrue(Modifier.isPublic(constructor.getModifiers()));
        assertEquals(0, constructor.getParameterCount());

        Method[] declared = type.getDeclaredMethods();
        assertEquals(1, declared.length);
        Method method = declared[0];
        assertEquals("setThemeMode", method.getName());
        assertTrue(Modifier.isPublic(method.getModifiers()));
        assertEquals(void.class, method.getReturnType());
        assertArrayEquals(new Class<?>[] {PluginCall.class}, method.getParameterTypes());
        PluginMethod pluginMethod = method.getAnnotation(PluginMethod.class);
        assertNotNull(pluginMethod);
        assertEquals(PluginMethod.RETURN_PROMISE, pluginMethod.returnType());
    }

    @Test public void pluginInputParsingIsStrictAndNonCoercing() throws Exception {
        String source = source("src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/AndroidLegacySettingsWriterPlugin.java");
        assertTrue(source.contains("data.length() != 1"));
        assertTrue(source.contains("data.has(\"mode\")"));
        int get = source.indexOf("Object rawMode = data.get(\"mode\")");
        int check = source.indexOf("rawMode instanceof String");
        int cast = source.indexOf("String mode = (String) rawMode");
        assertTrue(get >= 0 && get < check && check < cast);
        for (String forbidden : Arrays.asList("getString(", ".trim(", "Set.of(",
                "equalsIgnoreCase(", "toUpperCase(", "toLowerCase(")) {
            assertFalse(forbidden, source.contains(forbidden));
        }
        for (String mode : Arrays.asList("SYSTEM", "DYNAMIC", "LIGHT", "DARK")) {
            assertTrue(source.contains("\"" + mode + "\".equals(mode)"));
        }
    }

    @Test public void buildTypeApplicationsPreserveReleaseAndDebugOwnershipContracts()
            throws Exception {
        Path appRoot = androidAppRoot();
        assertFalse(Files.exists(appRoot.resolve(
                "src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/PdfChefApplication.java")));

        String release = source(
                "src/release/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/PdfChefApplication.java");
        assertEquals("package com.dhananjaytech.zenpdf_allpdftoolsinoneplace;\n\n"
                + "import android.app.Application;\n"
                + "import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents.DocumentLifecycleCoordinator;\n"
                + "import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy.LegacyMutationCoordinator;\n\n"
                + "/** Allocates the sole writer coordinator; construction deliberately performs no storage I/O. */\n"
                + "public final class PdfChefApplication extends Application {\n"
                + "    private final LegacyMutationCoordinator legacyMutationCoordinator = new LegacyMutationCoordinator();\n"
                + "    private final DocumentLifecycleCoordinator documentLifecycleCoordinator =\n"
                + "            new DocumentLifecycleCoordinator(this);\n"
                + "    public LegacyMutationCoordinator getLegacyMutationCoordinator() { return legacyMutationCoordinator; }\n"
                + "    public DocumentLifecycleCoordinator getDocumentLifecycleCoordinator() {\n"
                + "        return documentLifecycleCoordinator;\n"
                + "    }\n"
                + "}\n", release);

        Class<?> type = PdfChefApplication.class;
        assertEquals(Application.class, type.getSuperclass());
        assertTrue(Modifier.isPublic(type.getModifiers()));
        assertTrue(Modifier.isFinal(type.getModifiers()));
        Field[] fields = type.getDeclaredFields();
        assertEquals(3, fields.length);
        assertEquals(Set.of(LegacyMutationCoordinator.class, LegacyThemeCrashController.class,
                        DocumentLifecycleCoordinator.class),
                Arrays.stream(fields).map(Field::getType).collect(Collectors.toSet()));
        for (Field field : fields) {
            assertTrue(Modifier.isPrivate(field.getModifiers()));
            assertTrue(Modifier.isFinal(field.getModifiers()));
            assertFalse(Modifier.isStatic(field.getModifiers()));
            field.setAccessible(true);
        }
        Method getter = type.getMethod("getLegacyMutationCoordinator");
        assertEquals(LegacyMutationCoordinator.class, getter.getReturnType());
        assertEquals(0, getter.getParameterCount());
        assertEquals(Set.of("getLegacyMutationCoordinator", "getLegacyThemeCrashController",
                        "getDocumentLifecycleCoordinator"),
                Arrays.stream(type.getDeclaredMethods()).map(Method::getName)
                        .collect(Collectors.toSet()));
        Method documentGetter = type.getMethod("getDocumentLifecycleCoordinator");
        assertEquals(DocumentLifecycleCoordinator.class, documentGetter.getReturnType());
        assertEquals(0, documentGetter.getParameterCount());
        Method controllerGetter = type.getDeclaredMethod("getLegacyThemeCrashController");
        assertEquals(LegacyThemeCrashController.class, controllerGetter.getReturnType());
        assertEquals(0, controllerGetter.getParameterCount());
        assertFalse(Modifier.isPublic(controllerGetter.getModifiers()));
        assertFalse(Modifier.isProtected(controllerGetter.getModifiers()));
        assertFalse(Modifier.isPrivate(controllerGetter.getModifiers()));
        assertFalse(Modifier.isStatic(controllerGetter.getModifiers()));
        controllerGetter.setAccessible(true);

        PdfChefApplication application = new PdfChefApplication();
        LegacyMutationCoordinator coordinator = application.getLegacyMutationCoordinator();
        LegacyThemeCrashController controller =
                (LegacyThemeCrashController) controllerGetter.invoke(application);
        assertSame(coordinator, application.getLegacyMutationCoordinator());
        assertSame(controller, controllerGetter.invoke(application));
        Field io = LegacyMutationCoordinator.class.getDeclaredField("io");
        io.setAccessible(true);
        assertSame("debug coordinator must be decorated by its Application controller",
                controller, io.get(coordinator));
        Field armed = LegacyThemeCrashController.class.getDeclaredField("armedStage");
        armed.setAccessible(true);
        assertNull("debug controller starts disarmed", armed.get(controller));
        Field coordinatorCreated =
                LegacyThemeCrashController.class.getDeclaredField("coordinatorCreated");
        coordinatorCreated.setAccessible(true);
        assertTrue("controller composes its coordinator exactly once",
                coordinatorCreated.getBoolean(controller));

        String debug = source(
                "src/debug/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/PdfChefApplication.java");
        assertEquals(1, occurrences(debug, "new LegacyThemeCrashController()"));
        assertEquals(1, occurrences(debug, "legacyThemeCrashController.createCoordinator()"));
        assertEquals(0, occurrences(debug, "new LegacyMutationCoordinator("));
        assertEquals(1, occurrences(debug, "return legacyMutationCoordinator;"));
        assertEquals(1, occurrences(debug, "return legacyThemeCrashController;"));
        assertEquals(1, occurrences(release, "new DocumentLifecycleCoordinator(this)"));
        assertEquals(1, occurrences(debug, "new DocumentLifecycleCoordinator(this)"));
        assertEquals(1, occurrences(release, "return documentLifecycleCoordinator;"));
        assertEquals(1, occurrences(debug, "return documentLifecycleCoordinator;"));
        for (String lifecycle : Arrays.asList("onCreate(", "onTerminate(",
                "onLowMemory(", "onTrimMemory(", "registerActivityLifecycleCallbacks(")) {
            assertFalse(lifecycle, release.contains(lifecycle));
            assertFalse(lifecycle, debug.contains(lifecycle));
        }
        for (String storage : Arrays.asList("getFilesDir(", "Files.", "File(", "Path(",
                "read(", "write(", "delete(", "move(", "copy(", "mkdir(")) {
            assertFalse(storage, release.contains(storage));
            assertFalse(storage, debug.contains(storage));
        }
        assertFalse(release.contains("LegacyThemeCrash"));
        assertFalse(release.contains("killProcess"));
        assertFalse(release.contains("android:process"));
    }

    @Test public void successAndFailureWireContractIsFrozen() throws Exception {
        assertEquals(Set.of("mode", "changed"),
                publicFieldNames(LegacyMutationCoordinator.Result.class));
        assertEquals(Set.of("code"),
                publicFieldNames(LegacyMutationCoordinator.Failure.class));

        String source = source("src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/AndroidLegacySettingsWriterPlugin.java");
        assertEquals(1, occurrences(source, "output.put(\"mode\", result.mode)"));
        assertEquals(1, occurrences(source, "output.put(\"changed\", result.changed)"));
        assertEquals(3, occurrences(source,
                "call.reject(\"Invalid theme mode.\", \"LEGACY_THEME_INVALID_ARGUMENT\")"));
        assertEquals(1, occurrences(source,
                "call.reject(\"Theme update could not be completed.\", failure.code)"));
        assertEquals(1, occurrences(source, "\"LEGACY_THEME_WRITE_FAILED\""));
        for (String leak : Arrays.asList("getMessage()", "getCause()", "printStackTrace(",
                "failure.toString()", "ignored.toString()")) {
            assertFalse(leak, source.contains(leak));
        }
    }

    @Test public void readOnlyInspectorExposesNoWriterMethod() {
        TreeSet<String> methods = new TreeSet<>();
        for (Method method : AndroidLegacyInspectorPlugin.class.getDeclaredMethods()) {
            if (method.getAnnotation(PluginMethod.class) != null) methods.add(method.getName());
        }
        assertEquals(Set.of("readHistory", "readSettings"), methods);
        assertFalse(methods.contains("setThemeMode"));
    }

    @Test public void mainActivityAndManifestWiringAreFrozen() throws Exception {
        String activity = source("src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/MainActivity.java");
        int inspector = activity.indexOf("registerPlugin(AndroidLegacyInspectorPlugin.class)");
        int writer = activity.indexOf("registerPlugin(AndroidLegacySettingsWriterPlugin.class)");
        int documents = activity.indexOf("registerPlugin(AndroidDocumentsPlugin.class)");
        int bridge = activity.indexOf("super.onCreate(savedInstanceState)");
        assertTrue(inspector >= 0 && inspector < writer && writer < documents && documents < bridge);
        assertEquals(1, occurrences(activity,
                "registerPlugin(AndroidLegacyInspectorPlugin.class)"));
        assertEquals(1, occurrences(activity,
                "registerPlugin(AndroidLegacySettingsWriterPlugin.class)"));
        assertEquals(1, occurrences(activity,
                "registerPlugin(AndroidDocumentsPlugin.class)"));

        String manifest = source("src/main/AndroidManifest.xml");
        assertEquals(1, occurrences(manifest, "android:name=\".PdfChefApplication\""));
        assertFalse(manifest.contains("android:process"));

        String debugManifest = source("src/debug/AndroidManifest.xml");
        assertEquals(1, occurrences(debugManifest, "<service"));
        assertEquals(1, occurrences(debugManifest,
                "android:name=\".LegacyThemeCrashService\""));
        assertEquals(1, occurrences(debugManifest, "android:exported=\"false\""));
        assertEquals(1, occurrences(debugManifest,
                "android:process=\":legacyThemeCrash\""));
        assertFalse(debugManifest.contains("intent-filter"));

        String plugin = source(
                "src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/AndroidLegacySettingsWriterPlugin.java");
        assertEquals(1, occurrences(plugin, "application.getLegacyMutationCoordinator()"));
        for (String forbidden : Arrays.asList("LegacyThemeCrashController",
                "LegacyThemeCrashService", "getLegacyThemeCrashController", ".arm(")) {
            assertFalse(forbidden, activity.contains(forbidden));
            assertFalse(forbidden, plugin.contains(forbidden));
        }
    }

    private static Set<String> publicFieldNames(Class<?> type) {
        TreeSet<String> names = new TreeSet<>();
        for (Field field : type.getDeclaredFields()) {
            if (Modifier.isPublic(field.getModifiers()) && !Modifier.isStatic(field.getModifiers())) {
                names.add(field.getName());
            }
        }
        return names;
    }

    private static int occurrences(String source, String value) {
        int count = 0;
        for (int at = 0; (at = source.indexOf(value, at)) >= 0; at += value.length()) count++;
        return count;
    }

    private static Path androidAppRoot() {
        Path directory = Path.of(System.getProperty("user.dir")).toAbsolutePath();
        while (directory != null) {
            if (Files.isRegularFile(directory.resolve("build.gradle"))
                    && Files.isDirectory(directory.resolve("src/main"))) return directory;
            Path nested = directory.resolve("android/app");
            if (Files.isRegularFile(nested.resolve("build.gradle"))
                    && Files.isDirectory(nested.resolve("src/main"))) return nested;
            directory = directory.getParent();
        }
        throw new AssertionError("Could not locate android/app source root");
    }

    private static String source(String relative) throws Exception {
        Path file = androidAppRoot().resolve(relative);
        if (!Files.isRegularFile(file)) throw new AssertionError("Could not locate source: " + relative);
        return new String(Files.readAllBytes(file), StandardCharsets.UTF_8);
    }
}
