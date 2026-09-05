package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotSame;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import androidx.datastore.preferences.PreferencesProto;
import androidx.datastore.preferences.protobuf.CodedInputStream;
import androidx.datastore.preferences.protobuf.WireFormat;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.Test;

public final class LegacyThemeModeWirePatcherTest {
    private final LegacyThemeModeWirePatcher patcher = new LegacyThemeModeWirePatcher();

    @Test public void emptyInputAddsOneCanonicalEntryForEveryAcceptedMode() throws Exception {
        for (String mode : List.of("SYSTEM", "DYNAMIC", "LIGHT", "DARK")) {
            byte[] source = new byte[0];
            LegacyThemeModeWirePatcher.PatchResult result = patcher.patchResult(source, mode);
            assertTrue(result.changed);
            assertNotSame(source, result.bytes);
            assertArrayEquals(mapEntry(entry(stringField(1, "theme_mode"),
                    field(2, stringValue(mode)))), result.bytes);
            assertEffective(result.bytes, mode);
        }
    }

    @Test public void directInvalidModesAreTypedArgumentFailures() throws Exception {
        for (String mode : Arrays.asList(null, "", "system", " SYSTEM", "SYSTEM ",
                "AUTO", "DARK\u0000")) {
            assertFailure(new byte[0], mode,
                    LegacyThemeModeWirePatcher.FailureReason.INVALID_ARGUMENT);
        }
    }

    @Test public void sameEffectiveStringReturnsExactSourceReferenceUnchanged() throws Exception {
        byte[] source = concat(
                overlongField(15, 0, new byte[] {(byte) 0x81, 0x00}),
                mapEntry(entry(stringField(1, "other"), field(2, stringValue("opaque")))),
                mapEntry(entry(field(2, stringValue("DARK")), stringField(1, "theme_mode"))),
                fixed32Field(21, 0x12345678));
        byte[] before = source.clone();

        LegacyThemeModeWirePatcher.PatchResult result = patcher.patchResult(source, "DARK");

        assertFalse(result.changed);
        assertSame(source, result.bytes);
        assertArrayEquals(before, source);
    }

    @Test public void changedTargetRebuildsOnlyItsWrapperAndKeepsOldPayloadAsExactPrefix()
            throws Exception {
        byte[] prefix = concat(overlongField(15, 0, new byte[] {(byte) 0x96, 0x01}),
                mapEntry(entry(stringField(1, "other"), field(2, integerValue(7)))));
        byte[] unknownValue = overlongField(15, 0, new byte[] {(byte) 0xe3, 0x00});
        byte[] targetPayload = entry(
                fixed32Field(17, 0x44332211),
                field(2, stringValue("LIGHT")),
                stringField(1, "ignored_first"),
                stringField(1, "theme_mode"),
                field(2, unknownValue),
                stringField(19, "entry-unknown"));
        byte[] selected = overlongLengthDelimitedField(1, targetPayload);
        byte[] suffix = concat(mapEntry(entry(stringField(1, "tail"),
                field(2, bytesValue(new byte[] {7, 8, 9})))), fixed64Field(20, 9));
        byte[] source = concat(prefix, selected, suffix);
        byte[] appended = field(2, stringValue("DYNAMIC"));
        byte[] expected = concat(prefix, mapEntry(concat(targetPayload, appended)), suffix);

        LegacyThemeModeWirePatcher.PatchResult result = patcher.patchResult(source, "DYNAMIC");

        assertTrue(result.changed);
        assertArrayEquals(expected, result.bytes);
        assertArrayEquals(targetPayload,
                Arrays.copyOf(lastThemePayload(result.bytes), targetPayload.length));
        assertEffective(result.bytes, "DYNAMIC");
        assertEquals(1, occurrences(result.bytes, unknownValue));
    }

    @Test public void laterUnknownOnlyValueMessageDoesNotEraseEarlierEffectiveString()
            throws Exception {
        byte[] unknownOnly = canonicalVarintField(30, 77);
        byte[] source = mapEntry(entry(
                stringField(1, "theme_mode"),
                field(2, stringValue("DARK")),
                field(2, unknownOnly)));
        byte[] before = source.clone();

        LegacyThemeModeWirePatcher.PatchResult result = patcher.patchResult(source, "DARK");

        assertFalse(result.changed);
        assertSame(source, result.bytes);
        assertArrayEquals(before, result.bytes);
        assertEquals(1, occurrences(result.bytes, unknownOnly));
    }

    @Test public void laterKnownNonStringValueOverridesEarlierString() throws Exception {
        byte[] unknown = canonicalVarintField(30, 12);
        byte[] payload = entry(
                stringField(1, "theme_mode"),
                field(2, stringValue("DARK")),
                field(2, concat(unknown, integerValue(7))));
        byte[] source = mapEntry(payload);
        byte[] expected = mapEntry(concat(payload, field(2, stringValue("DARK"))));

        LegacyThemeModeWirePatcher.PatchResult result = patcher.patchResult(source, "DARK");

        assertTrue(result.changed);
        assertArrayEquals(expected, result.bytes);
        assertEquals(1, occurrences(result.bytes, unknown));
        assertEffective(result.bytes, "DARK");
    }

    @Test public void lastEffectiveTargetEntryWinsAndEarlierDuplicatesStayByteExact()
            throws Exception {
        byte[] firstTarget = mapEntry(entry(stringField(1, "theme_mode"),
                field(2, stringValue("SYSTEM")), stringField(18, "first")));
        byte[] duplicateNonTarget = mapEntry(entry(stringField(1, "same"),
                field(2, integerValue(1)), field(2, integerValue(2))));
        byte[] secondTargetPayload = entry(
                stringField(1, "not-theme"), field(2, booleanValue(true)),
                stringField(1, "theme_mode"), field(2, bytesValue(new byte[] {4, 5})));
        byte[] source = concat(firstTarget, duplicateNonTarget,
                mapEntry(secondTargetPayload), duplicateNonTarget);
        byte[] expected = concat(firstTarget, duplicateNonTarget,
                mapEntry(concat(secondTargetPayload, field(2, stringValue("LIGHT")))),
                duplicateNonTarget);

        LegacyThemeModeWirePatcher.PatchResult result = patcher.patchResult(source, "LIGHT");

        assertArrayEquals(expected, result.bytes);
        assertEffective(result.bytes, "LIGHT");
    }

    @Test public void allExistingValueCasesAreSupersededWithoutLosingTheirRawPayload()
            throws Exception {
        List<byte[]> values = List.of(
                booleanValue(true), floatValue(1.25f), integerValue(17), longValue(99),
                stringValue("SYSTEM"), stringSetValue("a", "b"), doubleValue(2.5),
                bytesValue(new byte[] {1, 2, 3}), canonicalVarintField(31, 4));
        for (byte[] oldValue : values) {
            byte[] payload = entry(field(2, oldValue), stringField(1, "theme_mode"));
            byte[] source = mapEntry(payload);
            LegacyThemeModeWirePatcher.PatchResult result = patcher.patchResult(source, "DARK");
            assertTrue(result.changed);
            assertArrayEquals(payload,
                    Arrays.copyOf(lastThemePayload(result.bytes), payload.length));
            assertEffective(result.bytes, "DARK");
        }
    }

    @Test public void unknownTopEntryAndFutureValueTagsAndNoncanonicalVarintsSurvive()
            throws Exception {
        byte[] unknownTop = overlongLengthDelimitedField(22,
                new byte[] {0x0b, 0x13, 0x1b, 0x23});
        byte[] nonTargetPayload = entry(
                overlongStringField(1, "future_setting"),
                overlongLengthDelimitedField(2, concat(
                        overlongField(30, 0, new byte[] {(byte) 0x81, 0x00}),
                        overlongLengthDelimitedField(29, new byte[] {0x0b, 0x0c}))));
        byte[] nonTarget = overlongLengthDelimitedField(1, nonTargetPayload);
        byte[] source = concat(unknownTop, nonTarget);

        LegacyThemeModeWirePatcher.PatchResult result = patcher.patchResult(source, "SYSTEM");

        assertArrayEquals(source, Arrays.copyOf(result.bytes, source.length));
        assertEffective(result.bytes, "SYSTEM");
    }

    @Test public void malformedGroupTruncatedAndUtf8InputsAreCorrupt() throws Exception {
        List<byte[]> corrupt = new ArrayList<>();
        corrupt.add(new byte[] {0});
        corrupt.add(new byte[] {0x16});
        corrupt.add(new byte[] {0x0a, 0x02, 0x0a});
        corrupt.add(new byte[] {0x13, 0x14});
        corrupt.add(mapEntry(new byte[] {0x0b, 0x0c}));
        corrupt.add(mapEntry(entry(stringField(1, "theme_mode"),
                field(2, new byte[] {0x0b, 0x0c}))));
        corrupt.add(mapEntry(entry(new byte[] {0x0a, 0x01, (byte) 0x80},
                field(2, stringValue("LIGHT")))));
        corrupt.add(mapEntry(entry(stringField(1, "theme_mode"),
                field(2, new byte[] {0x2a, 0x01, (byte) 0x80}))));
        corrupt.add(mapEntry(entry(stringField(1, "theme_mode"),
                field(2, field(6, new byte[] {0x0b, 0x0c})))));
        corrupt.add(new byte[] {(byte) 0xa1, 0x01, 1, 2, 3});
        for (byte[] source : corrupt) {
            assertFailure(source, "DARK", LegacyThemeModeWirePatcher.FailureReason.CORRUPT);
        }
    }

    @Test public void exactEntryBoundAcceptsExistingTargetAndRefusesOverflow() throws Exception {
        byte[] emptyEntry = mapEntry(new byte[0]);
        byte[] nineHundredNinetyNine = repeat(emptyEntry, 999);
        byte[] thousandWithTarget = concat(nineHundredNinetyNine,
                mapEntry(entry(stringField(1, "theme_mode"), field(2, integerValue(2)))));
        LegacyThemeModeWirePatcher.PatchResult accepted =
                patcher.patchResult(thousandWithTarget, "LIGHT");
        assertEffective(accepted.bytes, "LIGHT");

        byte[] thousandWithoutTarget = concat(nineHundredNinetyNine, emptyEntry);
        assertFailure(thousandWithoutTarget, "LIGHT",
                LegacyThemeModeWirePatcher.FailureReason.TOO_LARGE);
        assertFailure(concat(thousandWithoutTarget, emptyEntry), "LIGHT",
                LegacyThemeModeWirePatcher.FailureReason.TOO_LARGE);
    }

    @Test public void exactInputBoundaryAndFixedOutputGrowthCeilingAreEnforced()
            throws Exception {
        byte[] exact = exactUnknownFieldSize(LegacyThemeModeWirePatcher.MAX_BYTES);
        LegacyThemeModeWirePatcher.PatchResult result = patcher.patchResult(exact, "DYNAMIC");
        assertEquals(LegacyThemeModeWirePatcher.MAX_BYTES, exact.length);
        assertTrue(result.bytes.length <= LegacyThemeModeWirePatcher.MAX_OUTPUT_BYTES);
        assertTrue(result.bytes.length - exact.length
                <= LegacyThemeModeWirePatcher.MAX_GROWTH_BYTES);
        assertArrayEquals(exact, Arrays.copyOf(result.bytes, exact.length));
        assertEffective(result.bytes, "DYNAMIC");

        byte[] over = exactUnknownFieldSize(LegacyThemeModeWirePatcher.MAX_BYTES + 1);
        assertFailure(over, "DYNAMIC", LegacyThemeModeWirePatcher.FailureReason.TOO_LARGE);
    }

    @Test public void canonicalPatchAtWrapperVarintBoundaryStaysWithinFixedGrowthCeiling()
            throws Exception {
        byte[] unknown = field(31, new byte[100]);
        byte[] payload = entry(stringField(1, "theme_mode"), field(2, unknown));
        byte[] source = mapEntry(payload);
        byte[] expected = mapEntry(concat(payload, field(2, stringValue("DARK"))));

        LegacyThemeModeWirePatcher.PatchResult result = patcher.patchResult(source, "DARK");

        assertArrayEquals(expected, result.bytes);
        assertTrue(result.bytes.length - source.length
                < LegacyThemeModeWirePatcher.MAX_GROWTH_BYTES);
        assertEffective(result.bytes, "DARK");
    }

    @Test public void nullSourceIsCorruptRatherThanAnImplicitEmptyStore() throws Exception {
        assertFailure(null, "SYSTEM", LegacyThemeModeWirePatcher.FailureReason.CORRUPT);
    }

    @Test public void compatibilityByteArrayApiMatchesTypedResult() throws Exception {
        byte[] source = mapEntry(entry(stringField(1, "theme_mode"),
                field(2, stringValue("LIGHT"))));
        byte[] compatibility = patcher.patch(source, "SYSTEM");
        LegacyThemeModeWirePatcher.PatchResult typed = patcher.patchResult(source, "SYSTEM");
        assertArrayEquals(typed.bytes, compatibility);
        assertEffective(compatibility, "SYSTEM");
    }

    private void assertFailure(byte[] source, String mode,
            LegacyThemeModeWirePatcher.FailureReason expected) throws Exception {
        try {
            patcher.patchResult(source, mode);
        } catch (LegacyThemeModeWirePatcher.PatchFailure failure) {
            assertEquals(expected, failure.reason);
            return;
        }
        throw new AssertionError("Expected " + expected);
    }

    private static void assertEffective(byte[] bytes, String mode) throws Exception {
        PreferencesProto.Value value = PreferencesProto.PreferenceMap.parseFrom(bytes)
                .getPreferencesMap().get("theme_mode");
        assertEquals(PreferencesProto.Value.ValueCase.STRING, value.getValueCase());
        assertEquals(mode, value.getString());
    }

    private static byte[] lastThemePayload(byte[] bytes) throws Exception {
        CodedInputStream input = CodedInputStream.newInstance(bytes);
        byte[] selected = null;
        while (!input.isAtEnd()) {
            int tag = input.readTag();
            if (WireFormat.getTagFieldNumber(tag) == 1
                    && WireFormat.getTagWireType(tag) == WireFormat.WIRETYPE_LENGTH_DELIMITED) {
                byte[] payload = input.readByteArray();
                if ("theme_mode".equals(effectiveKey(payload))) {
                    selected = payload;
                }
            } else {
                input.skipField(tag);
            }
        }
        return selected;
    }

    private static String effectiveKey(byte[] entry) throws Exception {
        CodedInputStream input = CodedInputStream.newInstance(entry);
        String key = "";
        while (!input.isAtEnd()) {
            int tag = input.readTag();
            if (tag == 10) {
                key = input.readStringRequireUtf8();
            } else {
                input.skipField(tag);
            }
        }
        return key;
    }

    private static byte[] exactUnknownFieldSize(int size) throws IOException {
        for (int payloadSize = size - 1; payloadSize >= size - 8; payloadSize--) {
            byte[] candidate = field(22, new byte[payloadSize]);
            if (candidate.length == size) {
                return candidate;
            }
        }
        throw new AssertionError("No exact field size");
    }

    private static byte[] repeat(byte[] value, int count) {
        ByteArrayOutputStream out = new ByteArrayOutputStream(value.length * count);
        for (int index = 0; index < count; index++) {
            out.write(value, 0, value.length);
        }
        return out.toByteArray();
    }

    private static byte[] mapEntry(byte[] payload) throws IOException {
        return field(1, payload);
    }

    private static byte[] entry(byte[]... fields) {
        return concat(fields);
    }

    private static byte[] booleanValue(boolean value) throws IOException {
        return canonicalVarintField(1, value ? 1 : 0);
    }

    private static byte[] floatValue(float value) throws IOException {
        return fixed32Field(2, Float.floatToRawIntBits(value));
    }

    private static byte[] integerValue(int value) throws IOException {
        return canonicalVarintField(3, value);
    }

    private static byte[] longValue(long value) throws IOException {
        return canonicalVarintField(4, value);
    }

    private static byte[] stringValue(String value) throws IOException {
        return stringField(5, value);
    }

    private static byte[] stringSetValue(String... values) throws IOException {
        byte[][] fields = new byte[values.length][];
        for (int index = 0; index < values.length; index++) {
            fields[index] = stringField(1, values[index]);
        }
        return field(6, concat(fields));
    }

    private static byte[] doubleValue(double value) throws IOException {
        return fixed64Field(7, Double.doubleToRawLongBits(value));
    }

    private static byte[] bytesValue(byte[] value) throws IOException {
        return field(8, value);
    }

    private static byte[] stringField(int field, String value) throws IOException {
        return field(field, value.getBytes(StandardCharsets.UTF_8));
    }

    private static byte[] field(int field, byte[] payload) throws IOException {
        return concat(varint(((long) field << 3) | 2), varint(payload.length), payload);
    }

    private static byte[] overlongLengthDelimitedField(int field, byte[] payload) {
        return concat(overlongVarint(((long) field << 3) | 2), overlongVarint(payload.length),
                payload);
    }

    private static byte[] overlongStringField(int field, String value) {
        return overlongLengthDelimitedField(field, value.getBytes(StandardCharsets.UTF_8));
    }

    private static byte[] canonicalVarintField(int field, long value) throws IOException {
        return concat(varint((long) field << 3), varint(value));
    }

    private static byte[] overlongField(int field, int wire, byte[] encodedValue) {
        return concat(overlongVarint(((long) field << 3) | wire), encodedValue);
    }

    private static byte[] fixed32Field(int field, int value) throws IOException {
        return concat(varint(((long) field << 3) | 5), new byte[] {
                (byte) value, (byte) (value >>> 8), (byte) (value >>> 16),
                (byte) (value >>> 24)});
    }

    private static byte[] fixed64Field(int field, long value) throws IOException {
        byte[] bytes = new byte[8];
        for (int index = 0; index < bytes.length; index++) {
            bytes[index] = (byte) (value >>> (8 * index));
        }
        return concat(varint(((long) field << 3) | 1), bytes);
    }

    private static byte[] varint(long value) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(10);
        while ((value & ~0x7fL) != 0) {
            out.write(((int) value & 0x7f) | 0x80);
            value >>>= 7;
        }
        out.write((int) value);
        return out.toByteArray();
    }

    private static byte[] overlongVarint(long value) {
        byte[] canonical;
        try {
            canonical = varint(value);
        } catch (IOException impossible) {
            throw new AssertionError(impossible);
        }
        canonical[canonical.length - 1] |= (byte) 0x80;
        return concat(canonical, new byte[] {0});
    }

    private static int occurrences(byte[] haystack, byte[] needle) {
        int count = 0;
        outer: for (int start = 0; start <= haystack.length - needle.length; start++) {
            for (int index = 0; index < needle.length; index++) {
                if (haystack[start + index] != needle[index]) {
                    continue outer;
                }
            }
            count++;
        }
        return count;
    }

    private static byte[] concat(byte[]... parts) {
        int size = 0;
        for (byte[] part : parts) {
            size += part.length;
        }
        byte[] result = new byte[size];
        int offset = 0;
        for (byte[] part : parts) {
            System.arraycopy(part, 0, result, offset, part.length);
            offset += part.length;
        }
        return result;
    }
}
