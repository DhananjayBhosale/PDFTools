package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import android.app.Instrumentation;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Parcel;
import android.os.ParcelFileDescriptor;
import android.os.RemoteException;
import androidx.datastore.preferences.PreferencesProto;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.MainActivity;
import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.PdfChefApplication;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Disposable-emulator proof for the one-operation legacy settings writer. */
@RunWith(AndroidJUnit4.class)
public final class AndroidLegacySettingsWriterInstrumentedTest {
    private static final String TARGET_PACKAGE = "com.dhananjaytech.pdfchef.debug";
    private static final String CRASH_SERVICE =
            "com.dhananjaytech.zenpdf_allpdftoolsinoneplace.LegacyThemeCrashService";
    private static final String CRASH_DESCRIPTOR = CRASH_SERVICE;
    private static final int TRANSACTION_CRASH = IBinder.FIRST_CALL_TRANSACTION;
    private static final String MODE = "DARK";
    private static final String THEME_KEY = "theme";
    private static final String THEME_MARKER_KEY =
            "pdfchef.appearance.android-theme-write.v1";
    private static final long WEB_TIMEOUT_SECONDS = 20;
    private static final AtomicInteger BRIDGE_CALL_SEQUENCE = new AtomicInteger();

    @Test
    public void bridgeDiscoveryAppliedReaderAndNoOpAreExact() throws Exception {
        TestEnvironment environment = environment();
        refuseOwnedState(environment.root);
        byte[] old = fixture().oldBytes;
        File source = source(environment.root);
        try {
            assertTrue("datastore fixture directory", source.getParentFile().mkdir());
            write(source, old);
            assertArrayEquals(old, read(source));

            PdfChefApplication application = (PdfChefApplication) environment.context;
            assertSame("Application coordinator identity",
                    application.getLegacyMutationCoordinator(),
                    application.getLegacyMutationCoordinator());

            try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
                scenario.onActivity(activity -> {
                    Object handle = activity.getBridge().getPlugin("AndroidLegacySettingsWriter");
                    assertNotNull("registered writer handle", handle);
                    assertSame("registered writer handle identity", handle,
                            activity.getBridge().getPlugin("AndroidLegacySettingsWriter"));
                });

                JSONObject discovery = bridgeValue(scenario,
                        "({available:window.Capacitor&&Capacitor.isPluginAvailable('AndroidLegacySettingsWriter')})");
                assertTrue("writer plugin discovery", discovery.getBoolean("available"));

                JSONObject applied = bridgeValue(scenario,
                        "Capacitor.Plugins.AndroidLegacySettingsWriter.setThemeMode({mode:'DARK'})");
                assertExactKeys(applied, "mode", "changed");
                assertEquals(MODE, applied.getString("mode"));
                assertTrue(applied.getBoolean("changed"));
                assertArrayEquals(fixture().candidateBytes, read(source));
                assertPreservation(read(source));

                JSONObject settings = bridgeValue(scenario,
                        "Capacitor.Plugins.AndroidLegacyInspector.readSettings()");
                assertEquals("ok", settings.getString("health"));
                assertEquals(MODE, settings.getJSONObject("values").getString("theme_mode"));
                assertFalse(settings.toString().contains("app_settings.preferences_pb"));

                List<String> beforeNoOp = manifest(environment.root);
                JSONObject noOp = bridgeValue(scenario,
                        "Capacitor.Plugins.AndroidLegacySettingsWriter.setThemeMode({mode:'DARK'})");
                assertExactKeys(noOp, "mode", "changed");
                assertEquals(MODE, noOp.getString("mode"));
                assertFalse(noOp.getBoolean("changed"));
                assertEquals("no-op tree preservation", beforeNoOp, manifest(environment.root));

                JSONObject rejected = bridgeEnvelope(scenario,
                        "Capacitor.Plugins.AndroidLegacySettingsWriter.setThemeMode({mode:'DARK',extra:true})");
                assertFalse(rejected.getBoolean("ok"));
                assertEquals("LEGACY_THEME_INVALID_ARGUMENT", rejected.getString("code"));
                assertEquals("Invalid theme mode.", rejected.getString("message"));
                assertNonLeaking(rejected.toString());
            }
        } finally {
            if (source.exists() && !Files.isSymbolicLink(source.toPath())) {
                assertTrue("delete exact ordinary fixture source", source.delete());
            }
            File datastore = source.getParentFile();
            if (datastore.exists()) assertTrue("delete empty ordinary fixture directory", datastore.delete());
        }
    }

    @Test
    public void sharedAppearanceImportsWritesAndKeepsValidLocalAuthority() throws Exception {
        TestEnvironment environment = environment();
        refuseOwnedState(environment.root);
        File source = source(environment.root);
        byte[] dark = fixture().candidateBytes;
        try {
            assertTrue("datastore fixture directory", source.getParentFile().mkdir());
            write(source, dark);

            try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
                waitForJavascript(scenario, "Boolean(window.Capacitor)");
                evaluate(scenario,
                        "localStorage.removeItem('" + THEME_KEY + "');"
                                + "localStorage.removeItem('" + THEME_MARKER_KEY + "');"
                                + "location.reload();true");
                waitForJavascript(scenario,
                        "localStorage.getItem('theme')==='dark'"
                                + "&&document.documentElement.classList.contains('dark')");
                assertArrayEquals("read-only legacy import", dark, read(source));

                evaluate(scenario,
                        "document.querySelector('a[href=\"/settings\"]')?.click();true");
                waitForJavascript(scenario,
                        "location.pathname==='/settings'"
                                + "&&Boolean(document.querySelector('[role=radio][data-value=light]'))");
                evaluate(scenario,
                        "document.querySelector('[role=radio][data-value=light]').click();true");
                waitForJavascript(scenario,
                        "localStorage.getItem('theme')==='light'"
                                + "&&!document.documentElement.classList.contains('dark')"
                                + "&&document.body.textContent.includes('Theme saved on this device.')");
                byte[] written = read(source);
                assertEquals("explicit shared LIGHT write", "LIGHT",
                        PreferencesProto.PreferenceMap.parseFrom(written)
                                .getPreferencesMap().get("theme_mode").getString());
                assertPreservation(written);
                assertFalse("transaction marker released",
                        Boolean.parseBoolean(evaluate(scenario,
                                "localStorage.getItem('" + THEME_MARKER_KEY + "')!==null")));
            }

            write(source, dark);
            try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
                waitForJavascript(scenario,
                        "localStorage.getItem('theme')==='light'"
                                + "&&!document.documentElement.classList.contains('dark')");
                assertArrayEquals("valid shared local preference wins without legacy mutation",
                        dark, read(source));
            }
        } finally {
            if (source.exists() && !Files.isSymbolicLink(source.toPath())) {
                assertTrue("delete exact appearance fixture source", source.delete());
            }
            File datastore = source.getParentFile();
            if (datastore.exists()) assertTrue("delete empty appearance fixture directory", datastore.delete());
        }
    }

    @Test
    public void remoteProcessCrashStagesAreAtomicAndReaderDoesNotRecover() throws Exception {
        TestEnvironment environment = environment();
        runRemoteCrashCase(environment, LegacyThemeCrashController.BEFORE_MOVE, false);
        runRemoteCrashCase(environment, LegacyThemeCrashController.AFTER_MOVE, true);
        runRemoteCrashCase(environment, LegacyThemeCrashController.AFTER_DIRECTORY_FSYNC, true);
    }

    private static void runRemoteCrashCase(
            TestEnvironment environment, String stage, boolean expectCandidate) throws Exception {
        refuseOwnedState(environment.root);
        File source = source(environment.root);
        assertTrue("datastore fixture directory", source.getParentFile().mkdir());
        write(source, fixture().oldBytes);
        assertArrayEquals("remote case starts from exact old bytes", fixture().oldBytes, read(source));
        assertPreservation(read(source));

        invokeRemoteCrash(environment.context, stage);
        assertEquals("remote crash process must remain dead before raw verification", "",
                shell(environment.instrumentation,
                        "pidof " + TARGET_PACKAGE + ":legacyThemeCrash || true"));
        assertTrue("authoritative source must remain a regular file",
                source.isFile() && !Files.isSymbolicLink(source.toPath()));

        byte[] observedBeforeReader = read(source);
        assertArrayEquals("exact atomic state after " + stage,
                expectCandidate ? fixture().candidateBytes : fixture().oldBytes,
                observedBeforeReader);
        PreferencesProto.PreferenceMap parsed = PreferencesProto.PreferenceMap.parseFrom(observedBeforeReader);
        String observedMode = parsed.getPreferencesMap().get("theme_mode").getString();
        assertEquals(expectCandidate ? MODE : "LIGHT", observedMode);
        assertPreservation(observedBeforeReader);
        List<String> beforeReader = manifest(environment.root);

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            JSONObject settings = bridgeValue(scenario,
                    "Capacitor.Plugins.AndroidLegacyInspector.readSettings()");
            assertEquals("ok", settings.getString("health"));
            assertEquals(observedMode,
                    settings.getJSONObject("values").getString("theme_mode"));
            assertNonLeaking(settings.toString());
        }

        assertEquals("launch and accepted reader perform no recovery or cleanup",
                beforeReader, manifest(environment.root));
        assertArrayEquals(observedBeforeReader, read(source));
        cleanupExactOwnedState(source);
    }

    private static void invokeRemoteCrash(Context context, String stage) throws Exception {
        CountDownLatch connected = new CountDownLatch(1);
        CountDownLatch disconnected = new CountDownLatch(1);
        AtomicInteger connectionCount = new AtomicInteger();
        AtomicReference<IBinder> binderReference = new AtomicReference<>();
        ServiceConnection connection = new ServiceConnection() {
            @Override public void onServiceConnected(ComponentName name, IBinder service) {
                connectionCount.incrementAndGet();
                binderReference.set(service);
                connected.countDown();
            }

            @Override public void onServiceDisconnected(ComponentName name) {
                disconnected.countDown();
            }

            @Override public void onBindingDied(ComponentName name) {
                disconnected.countDown();
            }
        };
        Intent intent = new Intent().setComponent(new ComponentName(TARGET_PACKAGE, CRASH_SERVICE));
        boolean bound = context.bindService(intent, connection, Context.BIND_AUTO_CREATE);
        assertTrue("explicit debug crash service bind", bound);
        try {
            assertTrue("bounded debug crash service connection",
                    connected.await(WEB_TIMEOUT_SECONDS, TimeUnit.SECONDS));
            IBinder binder = binderReference.get();
            assertNotNull("debug crash service binder", binder);

            CountDownLatch binderDeath = new CountDownLatch(1);
            binder.linkToDeath(binderDeath::countDown, 0);
            CountDownLatch transactionFinished = new CountDownLatch(1);
            AtomicReference<Throwable> transactionOutcome = new AtomicReference<>();
            Thread transaction = new Thread(() -> {
                Parcel data = Parcel.obtain();
                Parcel reply = Parcel.obtain();
                try {
                    data.writeInterfaceToken(CRASH_DESCRIPTOR);
                    data.writeString(stage);
                    boolean handled = binder.transact(TRANSACTION_CRASH, data, reply, 0);
                    transactionOutcome.set(new AssertionError(
                            handled ? "CRASH_TRANSACTION_RETURNED"
                                    : "CRASH_TRANSACTION_UNHANDLED"));
                } catch (RemoteException expectedDeath) {
                    transactionOutcome.set(expectedDeath);
                } finally {
                    reply.recycle();
                    data.recycle();
                    transactionFinished.countDown();
                }
            }, "legacy-theme-crash-transaction");
            transaction.start();

            assertTrue("bounded remote binder death",
                    binderDeath.await(WEB_TIMEOUT_SECONDS, TimeUnit.SECONDS));
            context.unbindService(connection);
            bound = false;
            assertTrue("bounded crash transaction completion",
                    transactionFinished.await(WEB_TIMEOUT_SECONDS, TimeUnit.SECONDS));
            assertFalse("crashed remote binder must be dead", binder.isBinderAlive());
            assertTrue("transaction must end only through remote binder death",
                    transactionOutcome.get() instanceof RemoteException);
            assertEquals("remote service must connect exactly once", 1, connectionCount.get());
            disconnected.await(1, TimeUnit.SECONDS);
        } finally {
            if (bound) context.unbindService(connection);
        }
    }

    private static TestEnvironment environment() throws Exception {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        Context context = instrumentation.getTargetContext().getApplicationContext();
        assertEquals(TARGET_PACKAGE, context.getPackageName());
        String serial = requiredArgument("serial");
        assertTrue("physical devices are forbidden", serial.matches("emulator-[0-9]+"));
        assertEquals("QEMU target required", "1", shell(instrumentation, "getprop ro.kernel.qemu"));
        assertFalse("AVD identity required",
                shell(instrumentation, "getprop ro.boot.qemu.avd_name").isEmpty());
        String identity = (Build.FINGERPRINT + " " + Build.MODEL + " " + Build.HARDWARE)
                .toLowerCase(java.util.Locale.ROOT);
        assertTrue("emulator build identity required", identity.contains("emulator")
                || identity.contains("generic") || identity.contains("sdk_gphone")
                || identity.contains("ranchu") || identity.contains("goldfish"));
        return new TestEnvironment(instrumentation, context, context.getFilesDir());
    }

    private static void refuseOwnedState(File root) throws Exception {
        for (File forbidden : new File[] {
                new File(root, "processed_index.json"),
                new File(root, "processed"),
                new File(root, "datastore")}) {
            assertFalse("Refusing pre-existing unowned state: " + forbidden.getName(),
                    forbidden.exists() || Files.isSymbolicLink(forbidden.toPath()));
        }
    }

    private static String requiredArgument(String key) {
        Bundle arguments = InstrumentationRegistry.getArguments();
        String value = arguments.getString(key);
        assertNotNull("missing instrumentation argument: " + key, value);
        assertFalse("empty instrumentation argument: " + key, value.isEmpty());
        return value;
    }

    private static JSONObject bridgeValue(
            ActivityScenario<MainActivity> scenario, String expression) throws Exception {
        JSONObject envelope = bridgeEnvelope(scenario, expression);
        assertTrue("bridge invocation: " + envelope, envelope.getBoolean("ok"));
        return envelope.getJSONObject("value");
    }

    private static JSONObject bridgeEnvelope(
            ActivityScenario<MainActivity> scenario, String expression) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(WEB_TIMEOUT_SECONDS);
        while (System.nanoTime() < deadline) {
            if ("true".equals(evaluate(scenario, "Boolean(window.Capacitor)"))) break;
            Thread.sleep(50);
        }
        assertEquals("true", evaluate(scenario, "Boolean(window.Capacitor)"));
        String slot = "__pdfChefT014Result" + BRIDGE_CALL_SEQUENCE.incrementAndGet();
        evaluate(scenario, "window['" + slot + "']=null;(async()=>{try{window['" + slot
                + "']=JSON.stringify({ok:true,value:await (" + expression
                + ")});}catch(e){window['" + slot
                + "']=JSON.stringify({ok:false,code:String(e&&e.code||''),message:String(e&&e.message||'')});}})();true");
        String result = null;
        while (System.nanoTime() < deadline) {
            result = evaluate(scenario, "window['" + slot + "']");
            if (!"null".equals(result)) break;
            Thread.sleep(50);
        }
        assertTrue("WebView bridge result slot", result != null && !"null".equals(result));
        return new JSONObject(new JSONArray("[" + result + "]").getString(0));
    }

    private static String evaluate(ActivityScenario<MainActivity> scenario, String script)
            throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        String[] result = new String[1];
        scenario.onActivity(activity -> activity.getBridge().getWebView()
                .evaluateJavascript(script, value -> {
                    result[0] = value;
                    latch.countDown();
                }));
        assertTrue("WebView evaluateJavascript callback",
                latch.await(WEB_TIMEOUT_SECONDS, TimeUnit.SECONDS));
        return result[0];
    }

    private static void waitForJavascript(
            ActivityScenario<MainActivity> scenario, String expression) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(WEB_TIMEOUT_SECONDS);
        String observed = null;
        while (System.nanoTime() < deadline) {
            observed = evaluate(scenario, "Boolean(" + expression + ")");
            if ("true".equals(observed)) return;
            Thread.sleep(50);
        }
        assertEquals("Javascript condition: " + expression, "true", observed);
    }

    private static void assertPreservation(byte[] observed) throws Exception {
        Fixture fixture = fixture();
        assertEquals(1, occurrences(observed, fixture.unknownTop));
        assertEquals(1, occurrences(observed, fixture.nonTarget));
        assertEquals(1, occurrences(observed, fixture.firstTheme));
        assertEquals(1, occurrences(observed, fixture.selectedPayload));
        assertTrue(indexOf(observed, fixture.unknownTop) < indexOf(observed, fixture.nonTarget));
        assertTrue(indexOf(observed, fixture.nonTarget) < indexOf(observed, fixture.firstTheme));
        assertTrue(indexOf(observed, fixture.firstTheme) < indexOf(observed, fixture.selectedPayload));
    }

    private static void assertNonLeaking(String value) {
        String lower = value.toLowerCase(java.util.Locale.ROOT);
        for (String forbidden : new String[] {"app_settings.preferences_pb", "datastore/",
                "processed_index", "/data/", "exception", "stacktrace"}) {
            assertFalse("nonleaking bridge output", lower.contains(forbidden));
        }
    }

    private static void assertExactKeys(JSONObject value, String... expected) {
        Set<String> actual = new HashSet<>();
        java.util.Iterator<String> keys = value.keys();
        while (keys.hasNext()) actual.add(keys.next());
        assertEquals(new HashSet<>(java.util.Arrays.asList(expected)), actual);
    }

    private static Fixture fixture() throws Exception {
        byte[] unknownTop = concat(varintField(126, new byte[] {(byte) 0x81, 0x00}));
        byte[] nonTargetPayload = concat(
                overlongStringField(1, "future_setting"),
                field(2, stringValue("opaque")),
                varintField(19, new byte[] {7}));
        byte[] nonTarget = overlongLengthDelimitedField(1, nonTargetPayload);
        byte[] firstThemePayload = concat(
                stringField(1, "theme_mode"),
                field(2, stringValue("SYSTEM")),
                varintField(18, new byte[] {5}));
        byte[] firstTheme = field(1, firstThemePayload);
        byte[] selectedPayload = concat(
                field(2, concat(varintField(30, new byte[] {9}), stringValue("LIGHT"))),
                stringField(1, "ignored"),
                overlongStringField(1, "theme_mode"),
                varintField(20, new byte[] {3}));
        byte[] selectedTheme = overlongLengthDelimitedField(1, selectedPayload);
        byte[] old = concat(unknownTop, nonTarget, firstTheme, selectedTheme);
        byte[] candidate = new LegacyThemeModeWirePatcher().patchResult(old, MODE).bytes;
        return new Fixture(old, candidate, unknownTop, nonTarget, firstTheme, selectedPayload);
    }

    private static byte[] stringValue(String value) throws IOException {
        return field(5, value.getBytes(StandardCharsets.UTF_8));
    }

    private static byte[] stringField(int field, String value) throws IOException {
        return field(field, value.getBytes(StandardCharsets.UTF_8));
    }

    private static byte[] overlongStringField(int field, String value) throws IOException {
        return overlongLengthDelimitedField(field, value.getBytes(StandardCharsets.UTF_8));
    }

    private static byte[] field(int number, byte[] payload) throws IOException {
        return concat(varint((number << 3) | 2), varint(payload.length), payload);
    }

    private static byte[] overlongLengthDelimitedField(int number, byte[] payload)
            throws IOException {
        if (payload.length >= 128) throw new IOException("fixture payload too large");
        return concat(varint((number << 3) | 2),
                new byte[] {(byte) (payload.length | 0x80), 0}, payload);
    }

    private static byte[] varintField(int number, byte[] encodedValue) throws IOException {
        return concat(varint(number << 3), encodedValue);
    }

    private static byte[] varint(int value) {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        int remaining = value;
        while ((remaining & ~0x7f) != 0) {
            output.write((remaining & 0x7f) | 0x80);
            remaining >>>= 7;
        }
        output.write(remaining);
        return output.toByteArray();
    }

    private static byte[] concat(byte[]... values) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        for (byte[] value : values) output.write(value);
        return output.toByteArray();
    }

    private static int occurrences(byte[] value, byte[] needle) {
        int count = 0;
        for (int from = 0; (from = indexOf(value, needle, from)) >= 0; from += needle.length) count++;
        return count;
    }

    private static int indexOf(byte[] value, byte[] needle) {
        return indexOf(value, needle, 0);
    }

    private static int indexOf(byte[] value, byte[] needle, int from) {
        outer: for (int at = from; at <= value.length - needle.length; at++) {
            for (int index = 0; index < needle.length; index++) {
                if (value[at + index] != needle[index]) continue outer;
            }
            return at;
        }
        return -1;
    }

    private static File source(File root) {
        return new File(new File(root, "datastore"), "app_settings.preferences_pb");
    }

    private static void write(File file, byte[] bytes) throws IOException {
        try (FileOutputStream output = new FileOutputStream(file)) {
            output.write(bytes);
            output.getFD().sync();
        }
    }

    private static byte[] read(File file) throws IOException {
        try (FileInputStream input = new FileInputStream(file);
                ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            for (int count; (count = input.read(buffer)) >= 0; ) {
                output.write(buffer, 0, count);
            }
            return output.toByteArray();
        }
    }

    private static void cleanupExactOwnedState(File source) {
        assertTrue("delete exact crash fixture source", source.delete());
        File datastore = source.getParentFile();
        File[] remnants = datastore.listFiles();
        assertNotNull("read exact crash fixture directory for cleanup", remnants);
        for (File remnant : remnants) {
            assertTrue("only an owned crash temp may remain",
                    remnant.getName().startsWith(".pdfchef-theme-")
                            && remnant.getName().endsWith(".tmp")
                            && remnant.isFile()
                            && !Files.isSymbolicLink(remnant.toPath()));
            assertTrue("delete exact owned crash temp", remnant.delete());
        }
        assertTrue("delete empty crash fixture directory", datastore.delete());
    }

    private static List<String> manifest(File root) throws Exception {
        List<String> result = new ArrayList<>();
        File datastore = new File(root, "datastore");
        if (datastore.exists() || Files.isSymbolicLink(datastore.toPath())) {
            addManifest(root, datastore, result);
        }
        Collections.sort(result);
        return result;
    }

    private static void addManifest(File root, File file, List<String> output) throws Exception {
        boolean link = Files.isSymbolicLink(file.toPath());
        String type = link ? "link" : file.isDirectory() ? "directory" : file.isFile() ? "regular" : "other";
        String hash = file.isFile() && !link ? sha(file) : "-";
        String target = link ? Files.readSymbolicLink(file.toPath()).toString() : "-";
        output.add(root.toPath().relativize(file.toPath()).toString().replace(File.separatorChar, '/')
                + "|" + type + "|" + file.length() + "|" + file.lastModified()
                + "|" + hash + "|" + target);
        if (file.isDirectory() && !link) {
            File[] children = file.listFiles();
            assertNotNull("readable fixture directory", children);
            for (File child : children) addManifest(root, child, output);
        }
    }

    private static String sha(File file) throws Exception {
        return hex(MessageDigest.getInstance("SHA-256").digest(read(file)));
    }

    private static String hex(byte[] bytes) {
        StringBuilder output = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) output.append(String.format("%02x", value & 0xff));
        return output.toString();
    }

    private static String shell(Instrumentation instrumentation, String command) throws Exception {
        ParcelFileDescriptor descriptor = instrumentation.getUiAutomation()
                .executeShellCommand(command);
        try (FileInputStream input = new ParcelFileDescriptor.AutoCloseInputStream(descriptor);
                ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[1024];
            for (int count; (count = input.read(buffer)) >= 0; ) output.write(buffer, 0, count);
            return output.toString(StandardCharsets.UTF_8.name()).trim();
        }
    }

    private static final class TestEnvironment {
        final Instrumentation instrumentation;
        final Context context;
        final File root;
        TestEnvironment(Instrumentation instrumentation, Context context, File root) {
            this.instrumentation = instrumentation;
            this.context = context;
            this.root = root;
        }
    }

    private static final class Fixture {
        final byte[] oldBytes;
        final byte[] candidateBytes;
        final byte[] unknownTop;
        final byte[] nonTarget;
        final byte[] firstTheme;
        final byte[] selectedPayload;

        Fixture(byte[] oldBytes, byte[] candidateBytes, byte[] unknownTop,
                byte[] nonTarget, byte[] firstTheme, byte[] selectedPayload) {
            this.oldBytes = oldBytes;
            this.candidateBytes = candidateBytes;
            this.unknownTop = unknownTop;
            this.nonTarget = nonTarget;
            this.firstTheme = firstTheme;
            this.selectedPayload = selectedPayload;
        }
    }
}
