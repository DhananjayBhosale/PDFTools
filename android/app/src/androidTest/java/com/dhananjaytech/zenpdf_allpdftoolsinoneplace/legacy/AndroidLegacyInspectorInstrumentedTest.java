package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.webkit.ValueCallback;
import androidx.datastore.preferences.PreferencesProto;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.MainActivity;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Device/emulator-only proof that the registered Capacitor bridge is discoverable and read-only. */
@RunWith(AndroidJUnit4.class)
public final class AndroidLegacyInspectorInstrumentedTest {
    private static final long WEB_TIMEOUT_SECONDS = 20;
    private static final AtomicInteger BRIDGE_CALL_SEQUENCE = new AtomicInteger();

    @Test
    public void discoveredBridgeReadsSyntheticStoresWithoutMutation() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("com.dhananjaytech.pdfchef.debug", context.getPackageName());
        File root = context.getFilesDir();
        File index = new File(root, "processed_index.json");
        File store = new File(new File(root, "datastore"), "app_settings.preferences_pb");
        assertFalse("Refusing to overwrite existing index", index.exists() || Files.isSymbolicLink(index.toPath()));
        assertFalse("Refusing to overwrite existing settings", store.exists() || Files.isSymbolicLink(store.toPath()));

        File outputRoot = new File(root, "processed");
        File output = new File(outputRoot, "synthetic.pdf");
        List<File> created = new ArrayList<>();
        try {
            assertTrue(outputRoot.mkdir()); created.add(outputRoot);
            try (FileOutputStream out = new FileOutputStream(output)) { out.write(new byte[] {1, 2, 3}); }
            created.add(output);
            write(index, "[{\"id\":1,\"displayName\":\"Synthetic\",\"toolName\":\"MERGE\",\"sizeBytes\":3,\"createdAtMillis\":2,\"storedFileName\":\"synthetic.pdf\",\"isDirectory\":false}]");
            created.add(index);
            assertTrue(store.getParentFile().mkdir()); created.add(store.getParentFile());
            PreferencesProto.PreferenceMap map = PreferencesProto.PreferenceMap.newBuilder()
                    .putPreferences("theme_mode", PreferencesProto.Value.newBuilder().setString("DYNAMIC").build())
                    .putPreferences("onboarding_completed", PreferencesProto.Value.newBuilder().setBoolean(true).build())
                    .build();
            try (FileOutputStream out = new FileOutputStream(store)) { map.writeTo(out); }
            created.add(store);

            List<String> before = manifest(root);
            try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
                JSONObject discovery = bridge(scenario, "({available:window.Capacitor&&Capacitor.isPluginAvailable('AndroidLegacyInspector')})");
                assertTrue("plugin discovery", discovery.getBoolean("available"));
                JSONObject historyOne = bridge(scenario, "Capacitor.Plugins.AndroidLegacyInspector.readHistory()");
                JSONObject settingsOne = bridge(scenario, "Capacitor.Plugins.AndroidLegacyInspector.readSettings()");
                assertHistory(historyOne); assertSettings(settingsOne);
                assertEquals("history no mutation", before, manifest(root));
                JSONObject historyTwo = bridge(scenario, "Capacitor.Plugins.AndroidLegacyInspector.readHistory()");
                JSONObject settingsTwo = bridge(scenario, "Capacitor.Plugins.AndroidLegacyInspector.readSettings()");
                assertEquals(historyOne.toString(), historyTwo.toString());
                assertEquals(settingsOne.toString(), settingsTwo.toString());
                assertEquals("settings no mutation", before, manifest(root));
            }
        } finally {
            Collections.reverse(created);
            for (File file : created) if (file.exists() && !Files.isSymbolicLink(file.toPath())) file.delete();
        }
    }

    private static JSONObject bridge(ActivityScenario<MainActivity> scenario, String expression) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(WEB_TIMEOUT_SECONDS);
        while (System.nanoTime() < deadline) {
            if ("true".equals(evaluate(scenario, "Boolean(window.Capacitor)"))) break;
            Thread.sleep(50);
        }
        assertEquals("true", evaluate(scenario, "Boolean(window.Capacitor)"));
        String slot = "__pdfChefT021Result" + BRIDGE_CALL_SEQUENCE.incrementAndGet();
        evaluate(scenario, "window['" + slot + "']=null;(async()=>{try{window['" + slot
                + "']=JSON.stringify({ok:true,value:await (" + expression
                + ")});}catch(_){window['" + slot + "']=JSON.stringify({ok:false});}})();true");
        String result = null;
        while (System.nanoTime() < deadline) {
            result = evaluate(scenario, "window['" + slot + "']");
            if (!"null".equals(result)) break;
            Thread.sleep(50);
        }
        assertTrue("WebView bridge result slot", result != null && !"null".equals(result));
        String decoded = new JSONArray("[" + result + "]").getString(0);
        JSONObject envelope = new JSONObject(decoded); assertTrue("bridge invocation", envelope.optBoolean("ok", false));
        return envelope.getJSONObject("value");
    }

    private static String evaluate(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        final String[] result = new String[1];
        scenario.onActivity(activity -> activity.getBridge().getWebView()
                .evaluateJavascript(script, value -> { result[0] = value; latch.countDown(); }));
        assertTrue("WebView evaluateJavascript callback", latch.await(WEB_TIMEOUT_SECONDS, TimeUnit.SECONDS));
        return result[0];
    }

    private static void assertHistory(JSONObject value) throws Exception {
        assertEquals("ok", value.getString("health")); assertEquals(1, value.getInt("sourceCount"));
        assertEquals(0, value.getInt("invalidRecordCount")); assertEquals(1, value.getInt("returnedCount"));
        JSONObject entry = value.getJSONArray("entries").getJSONObject(0);
        assertEquals("a1_1", entry.getString("ref")); assertEquals(3, entry.getLong("sizeBytes"));
        assertFalse(entry.has("storedFileName") || entry.has("path") || entry.has("absolutePath") || entry.has("uri"));
    }
    private static void assertSettings(JSONObject value) throws Exception {
        assertEquals("ok", value.getString("health")); JSONObject values = value.getJSONObject("values");
        assertEquals("DYNAMIC", values.getString("theme_mode")); assertTrue(values.getBoolean("onboarding_completed"));
        assertFalse(values.has("preferenceBytes") || values.has("bytes") || values.has("data"));
    }
    private static void write(File file, String text) throws Exception { try (FileOutputStream out = new FileOutputStream(file)) { out.write(text.getBytes(StandardCharsets.UTF_8)); } }
    private static List<String> manifest(File root) throws Exception {
        List<String> result = new ArrayList<>(); File[] files = root.listFiles(); if (files == null) return result;
        for (File file : files) {
            if (file.getName().equals("processed") || file.getName().equals("processed_index.json") || file.getName().equals("datastore")) add(root, file, result);
        }
        Collections.sort(result); return result;
    }
    private static void add(File root, File file, List<String> out) throws Exception {
        String type = Files.isSymbolicLink(file.toPath()) ? "link" : file.isDirectory() ? "directory" : "regular";
        String hash = file.isFile() ? sha(file) : ""; out.add(root.toPath().relativize(file.toPath()) + "|" + type + "|" + file.length() + "|" + file.lastModified() + "|" + hash);
        if (file.isDirectory() && !Files.isSymbolicLink(file.toPath())) { File[] children=file.listFiles(); if(children!=null) for(File child:children)add(root,child,out); }
    }
    private static String sha(File file) throws Exception { MessageDigest digest=MessageDigest.getInstance("SHA-256"); try(FileInputStream in=new FileInputStream(file)){byte[] b=new byte[4096];for(int n;(n=in.read(b))!=-1;)digest.update(b,0,n);}StringBuilder out=new StringBuilder();for(byte b:digest.digest())out.append(String.format("%02x",b));return out.toString(); }
}
