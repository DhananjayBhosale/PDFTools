package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import androidx.datastore.preferences.PreferencesProto;
import com.google.gson.JsonObject;
import androidx.datastore.preferences.protobuf.ByteString;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public final class LegacySettingsInspectorTest {
    private static final String USAGE = "{\"runs\":{\"COMPRESS\":3},\"followUps\":{\"COMPRESS\":{\"PROTECT\":2}}}";
    private static final String SAVINGS = "{\"bytesSaved\":3250,\"filesReduced\":2}";
    private static final String OPTIONS = "{\"COMPRESS\":\"quality=75; mode=balanced\",\"WATERMARK\":\"text=Internal / Draft; url=https://example.invalid/watermark?id=1&lang=en\"}";

    @Rule public final TemporaryFolder temporary = new TemporaryFolder();

    @Test public void missingBlankCorruptAndSymlinkAncestorAreDistinctAndReadOnly() throws Exception {
        CaseRoot missing = fresh("settings-missing");
        LegacyInspectorTestSupport.assertSettings(inspect(missing), "missing", 0);

        CaseRoot blank = fresh("settings-blank");
        writeRaw(blank, new byte[0]);
        LegacyInspectorTestSupport.assertSettings(inspect(blank), "blank", 0);

        CaseRoot corrupt = fresh("settings-corrupt");
        writeRaw(corrupt, new byte[] {(byte) 0xff, (byte) 0xff, 0x7f});
        LegacyInspectorTestSupport.assertSettings(inspect(corrupt), "corrupt", 0);

        CaseRoot linkedDirectory = fresh("settings-linked-directory");
        Path victim = Files.createDirectories(linkedDirectory.outer.resolve("victim-datastore"));
        Files.write(victim.resolve("app_settings.preferences_pb"), mapOf("theme_mode", string("DARK")).toByteArray());
        Files.createSymbolicLink(linkedDirectory.files.resolve("datastore"), victim);
        LegacyInspectorTestSupport.assertSettings(inspect(linkedDirectory), "corrupt", 0);

        CaseRoot linkedFile = fresh("settings-linked-file");
        Path victimFile = linkedFile.outer.resolve("victim.preferences_pb");
        Files.write(victimFile, mapOf("theme_mode", string("LIGHT")).toByteArray());
        Files.createDirectories(linkedFile.files.resolve("datastore"));
        Files.createSymbolicLink(linkedFile.files.resolve("datastore/app_settings.preferences_pb"), victimFile);
        LegacyInspectorTestSupport.assertSettings(inspect(linkedFile), "corrupt", 0);

        CaseRoot danglingFile = fresh("settings-dangling-file");
        Files.createDirectories(danglingFile.files.resolve("datastore"));
        Files.createSymbolicLink(danglingFile.files.resolve("datastore/app_settings.preferences_pb"),
                danglingFile.outer.resolve("missing.preferences_pb"));
        LegacyInspectorTestSupport.assertSettings(inspect(danglingFile), "corrupt", 0);

        CaseRoot danglingDirectory = fresh("settings-dangling-directory");
        Files.createSymbolicLink(danglingDirectory.files.resolve("datastore"),
                danglingDirectory.outer.resolve("missing-datastore"));
        LegacyInspectorTestSupport.assertSettings(inspect(danglingDirectory), "corrupt", 0);
    }

    @Test public void allSevenKnownValuesRoundTripExactlyWithoutDefaultsOrReserialization()
            throws Exception {
        CaseRoot item = fresh("settings-seven");
        PreferencesProto.PreferenceMap map = mapOf(
                "theme_mode", string("DYNAMIC"),
                "app_font_option", string("INTER"),
                "onboarding_completed", bool(true),
                "tool_usage_memory", string(USAGE),
                "savings_tally", string(SAVINGS),
                "tool_option_memory", string(OPTIONS),
                "last_privacy_line_index", integer(2));
        writeMap(item, map);
        JsonObject result = inspect(item);
        LegacyInspectorTestSupport.assertSettings(result, "ok", 0);
        JsonObject values = result.getAsJsonObject("values");
        LegacyInspectorTestSupport.assertExactKeys(values, "theme_mode", "app_font_option",
                "onboarding_completed", "tool_usage_memory", "savings_tally",
                "tool_option_memory", "last_privacy_line_index");
        assertEquals("DYNAMIC", values.get("theme_mode").getAsString());
        assertEquals("INTER", values.get("app_font_option").getAsString());
        assertTrue(values.get("onboarding_completed").getAsBoolean());
        assertEquals(USAGE, values.get("tool_usage_memory").getAsString());
        assertEquals(SAVINGS, values.get("savings_tally").getAsString());
        assertEquals(OPTIONS, values.get("tool_option_memory").getAsString());
        assertEquals(2, values.get("last_privacy_line_index").getAsInt());
    }

    @Test public void absentKnownKeysNeverEmitRepositoryDefaults() throws Exception {
        CaseRoot empty = fresh("settings-empty-map");
        writeMap(empty, PreferencesProto.PreferenceMap.getDefaultInstance());
        JsonObject emptyResult = inspect(empty);
        LegacyInspectorTestSupport.assertSettings(emptyResult, "blank", 0);
        assertEquals(0, emptyResult.getAsJsonObject("values").size());

        CaseRoot partial = fresh("settings-one-known");
        writeMap(partial, mapOf("theme_mode", string("SYSTEM")));
        JsonObject result = inspect(partial);
        LegacyInspectorTestSupport.assertSettings(result, "ok", 0);
        LegacyInspectorTestSupport.assertExactKeys(result.getAsJsonObject("values"), "theme_mode");
        assertEquals("SYSTEM", result.getAsJsonObject("values").get("theme_mode").getAsString());
    }

    @Test public void everyKnownWrongProtoTypeIsPartialAndPreservesOtherValidKeys()
            throws Exception {
        List<WrongValue> cases = List.of(
                new WrongValue("theme_mode", bool(true)),
                new WrongValue("app_font_option", integer(4)),
                new WrongValue("onboarding_completed", string("true")),
                new WrongValue("tool_usage_memory", bytes("{}")),
                new WrongValue("savings_tally", longValue(4)),
                new WrongValue("savings_tally", floatValue(4.0f)),
                new WrongValue("tool_option_memory", stringSet("x")),
                new WrongValue("last_privacy_line_index", doubleValue(2.0)),
                new WrongValue("last_privacy_line_index", PreferencesProto.Value.getDefaultInstance()));
        for (WrongValue wrong : cases) {
            CaseRoot item = fresh("settings-wrong-type-" + wrong.key);
            PreferencesProto.PreferenceMap.Builder builder = PreferencesProto.PreferenceMap.newBuilder()
                    .putPreferences(wrong.key, wrong.value);
            String companion = wrong.key.equals("theme_mode") ? "onboarding_completed" : "theme_mode";
            builder.putPreferences(companion,
                    companion.equals("theme_mode") ? string("DARK") : bool(true));
            writeMap(item, builder.build());
            JsonObject result = inspect(item);
            LegacyInspectorTestSupport.assertSettings(result, "partial_invalid", 1);
            JsonObject values = result.getAsJsonObject("values");
            LegacyInspectorTestSupport.assertExactKeys(values, companion);
            assertFalse(values.has(wrong.key));
        }
    }

    @Test public void toolUsageSavingsAndOptionsShapesMatchFrozenT012Contract() throws Exception {
        List<Map.Entry<String, String>> invalid = new ArrayList<>();
        invalid.add(Map.entry("tool_usage_memory", "{\"runs\":{\"A\":1}}"));
        invalid.add(Map.entry("tool_usage_memory", "{\"runs\":{\"A\":1},\"followUps\":{},\"extra\":1}"));
        invalid.add(Map.entry("tool_usage_memory", "{\"runs\":{},\"runs\":{},\"followUps\":{}}"));
        invalid.add(Map.entry("tool_usage_memory", "{\"runs\":{\"A\":1,\"A\":2},\"followUps\":{}}"));
        invalid.add(Map.entry("tool_usage_memory", "{\"runs\":{},\"followUps\":{\"A\":{\"B\":1},\"A\":{\"C\":1}}}"));
        invalid.add(Map.entry("tool_usage_memory", "{\"runs\":{\"A\":1},\"followUps\":{\"A\":2}}"));
        invalid.add(Map.entry("tool_usage_memory", "{\"runs\":{\"A\":0},\"followUps\":{}}"));
        invalid.add(Map.entry("tool_usage_memory", "{\"runs\":{\"A\":-1},\"followUps\":{}}"));
        invalid.add(Map.entry("tool_usage_memory", "{\"runs\":{\"A\":\"1\"},\"followUps\":{}}"));
        invalid.add(Map.entry("tool_usage_memory", "{\"runs\":{\"A\":1.5},\"followUps\":{}}"));
        invalid.add(Map.entry("tool_usage_memory", "{\"runs\":{\"path\":1},\"followUps\":{}}"));
        invalid.add(Map.entry("tool_usage_memory", "{\"runs\":{\"A\":1},\"followUps\":{\"constructor\":{\"B\":1}}}"));
        invalid.add(Map.entry("savings_tally", "{\"bytesSaved\":1}"));
        invalid.add(Map.entry("savings_tally", "{\"bytesSaved\":1,\"filesReduced\":2,\"extra\":3}"));
        invalid.add(Map.entry("savings_tally", "{\"bytesSaved\":-1,\"filesReduced\":2}"));
        invalid.add(Map.entry("savings_tally", "{\"bytesSaved\":1,\"filesReduced\":\"2\"}"));
        invalid.add(Map.entry("tool_option_memory", "{\"URL\":\"x\"}"));
        invalid.add(Map.entry("tool_option_memory", "{\"__proto__\":\"x\"}"));
        invalid.add(Map.entry("tool_option_memory", "{\"COMPRESS\":\"a\",\"COMPRESS\":\"b\"}"));
        invalid.add(Map.entry("tool_option_memory", "{\"COMPRESS\":7}"));
        invalid.add(Map.entry("tool_option_memory", "{\"COMPRESS\":\"bad\\u0000value\"}"));
        for (Map.Entry<String, String> bad : invalid) {
            CaseRoot item = fresh("settings-invalid-shape");
            writeMap(item, mapOf(bad.getKey(), string(bad.getValue()), "theme_mode", string("LIGHT")));
            JsonObject result = inspect(item);
            LegacyInspectorTestSupport.assertSettings(result, "partial_invalid", 1);
            LegacyInspectorTestSupport.assertExactKeys(result.getAsJsonObject("values"), "theme_mode");
            assertEquals("LIGHT", result.getAsJsonObject("values").get("theme_mode").getAsString());
        }

        CaseRoot valid = fresh("settings-valid-shapes");
        writeMap(valid, mapOf("tool_usage_memory", string(USAGE), "savings_tally", string(SAVINGS),
                "tool_option_memory", string(OPTIONS)));
        JsonObject result = inspect(valid);
        LegacyInspectorTestSupport.assertSettings(result, "ok", 0);
        assertEquals(USAGE, result.getAsJsonObject("values").get("tool_usage_memory").getAsString());
        assertEquals(SAVINGS, result.getAsJsonObject("values").get("savings_tally").getAsString());
        assertEquals(OPTIONS, result.getAsJsonObject("values").get("tool_option_memory").getAsString());
    }

    @Test public void strictMalformedJsonIsPartialAndKeepsOtherValidSettings() throws Exception {
        List<String> malformed = List.of(
                "{/*comment*/\"runs\":{},\"followUps\":{}}",
                "{'runs':{},'followUps':{}}",
                "{runs:{},followUps:{}}",
                "{\"runs\":{},\"followUps\":{},}",
                "{\"runs\":{},\"followUps\":{}} trailing",
                "{\"runs\":{\"A\":NaN},\"followUps\":{}}",
                "{\"runs\":{\"A\":Infinity},\"followUps\":{}}",
                "{\"runs\":{},\"followUps\":{},\"bad\":\"\\x\"}",
                "{\"runs\":{},\"followUps\":" );
        for (String value : malformed) {
            CaseRoot item = fresh("settings-strict-json");
            writeMap(item, mapOf("tool_usage_memory", string(value),
                    "onboarding_completed", bool(true)));
            JsonObject result = inspect(item);
            LegacyInspectorTestSupport.assertSettings(result, "partial_invalid", 1);
            LegacyInspectorTestSupport.assertExactKeys(result.getAsJsonObject("values"), "onboarding_completed");
            assertTrue(result.getAsJsonObject("values").get("onboarding_completed").getAsBoolean());
        }
    }

    @Test public void unknownOnlyAndMixedUnknownMapsStayOkAndOmitUnknownKeys() throws Exception {
        CaseRoot unknown = fresh("settings-unknown-only");
        writeMap(unknown, mapOf("future_setting", bytes("opaque"), "another_future", longValue(9)));
        JsonObject unknownResult = inspect(unknown);
        LegacyInspectorTestSupport.assertSettings(unknownResult, "ok", 0);
        assertEquals(0, unknownResult.getAsJsonObject("values").size());

        CaseRoot mixed = fresh("settings-mixed-unknown");
        writeMap(mixed, mapOf("future_setting", string("ignored"), "theme_mode", string("DARK")));
        JsonObject mixedResult = inspect(mixed);
        LegacyInspectorTestSupport.assertSettings(mixedResult, "ok", 0);
        LegacyInspectorTestSupport.assertExactKeys(mixedResult.getAsJsonObject("values"), "theme_mode");
        assertEquals("DARK", mixedResult.getAsJsonObject("values").get("theme_mode").getAsString());
    }

    @Test public void bytePreferenceAndJsonNestingLimitsHaveExactBoundaries() throws Exception {
        CaseRoot bytes = fresh("settings-byte-limit");
        PreferencesProto.PreferenceMap one = mapOf("theme_mode", string("LIGHT"));
        writeMap(bytes, one);
        int length = one.toByteArray().length;
        LegacyInspectorTestSupport.assertSettings(inspect(bytes, length, 10, 10), "ok", 0);
        LegacyInspectorTestSupport.assertSettings(inspect(bytes, length - 1, 10, 10), "corrupt", 0);

        CaseRoot preferences = fresh("settings-preference-limit");
        writeMap(preferences, mapOf("theme_mode", string("DARK"), "unknown", string("ignored")));
        LegacyInspectorTestSupport.assertSettings(inspect(preferences, Long.MAX_VALUE, 2, 10), "ok", 0);
        LegacyInspectorTestSupport.assertSettings(inspect(preferences, Long.MAX_VALUE, 1, 10), "corrupt", 0);

        CaseRoot nesting = fresh("settings-nesting-limit");
        writeMap(nesting, mapOf("tool_usage_memory", string(USAGE), "theme_mode", string("SYSTEM")));
        LegacyInspectorTestSupport.assertSettings(inspect(nesting, Long.MAX_VALUE, 10, 3), "ok", 0);
        JsonObject limited = inspect(nesting, Long.MAX_VALUE, 10, 2);
        LegacyInspectorTestSupport.assertSettings(limited, "partial_invalid", 1);
        LegacyInspectorTestSupport.assertExactKeys(limited.getAsJsonObject("values"), "theme_mode");
    }

    private CaseRoot fresh(String prefix) throws Exception {
        Path outer = temporary.newFolder(prefix + "-" + System.nanoTime()).toPath();
        Path files = Files.createDirectory(outer.resolve("files"));
        return new CaseRoot(outer, files);
    }

    private static JsonObject inspect(CaseRoot item) throws Exception {
        return LegacyInspectorTestSupport.inspectTwiceUnchanged(item.outer,
                () -> new LegacySettingsInspector(item.files.toFile()).read());
    }

    private static JsonObject inspect(CaseRoot item, long bytes, int preferences, int nesting)
            throws Exception {
        return LegacyInspectorTestSupport.inspectTwiceUnchanged(item.outer,
                () -> new LegacySettingsInspector(item.files.toFile(), bytes, preferences, nesting).read());
    }

    private static void writeMap(CaseRoot item, PreferencesProto.PreferenceMap map) throws Exception {
        writeRaw(item, map.toByteArray());
    }

    private static void writeRaw(CaseRoot item, byte[] bytes) throws Exception {
        Path datastore = Files.createDirectories(item.files.resolve("datastore"));
        Files.write(datastore.resolve("app_settings.preferences_pb"), bytes);
    }

    private static PreferencesProto.PreferenceMap mapOf(Object... pairs) {
        PreferencesProto.PreferenceMap.Builder builder = PreferencesProto.PreferenceMap.newBuilder();
        for (int index = 0; index < pairs.length; index += 2) {
            builder.putPreferences((String) pairs[index], (PreferencesProto.Value) pairs[index + 1]);
        }
        return builder.build();
    }

    private static PreferencesProto.Value string(String value) {
        return PreferencesProto.Value.newBuilder().setString(value).build();
    }
    private static PreferencesProto.Value bool(boolean value) {
        return PreferencesProto.Value.newBuilder().setBoolean(value).build();
    }
    private static PreferencesProto.Value integer(int value) {
        return PreferencesProto.Value.newBuilder().setInteger(value).build();
    }
    private static PreferencesProto.Value longValue(long value) {
        return PreferencesProto.Value.newBuilder().setLong(value).build();
    }
    private static PreferencesProto.Value floatValue(float value) {
        return PreferencesProto.Value.newBuilder().setFloat(value).build();
    }
    private static PreferencesProto.Value doubleValue(double value) {
        return PreferencesProto.Value.newBuilder().setDouble(value).build();
    }
    private static PreferencesProto.Value bytes(String value) {
        return PreferencesProto.Value.newBuilder().setBytes(ByteString.copyFromUtf8(value)).build();
    }
    private static PreferencesProto.Value stringSet(String value) {
        return PreferencesProto.Value.newBuilder().setStringSet(
                PreferencesProto.StringSet.newBuilder().addStrings(value).build()).build();
    }

    private static final class WrongValue {
        final String key;
        final PreferencesProto.Value value;
        WrongValue(String key, PreferencesProto.Value value) { this.key = key; this.value = value; }
    }

    private static final class CaseRoot {
        final Path outer;
        final Path files;
        CaseRoot(Path outer, Path files) { this.outer = outer; this.files = files; }
    }
}
