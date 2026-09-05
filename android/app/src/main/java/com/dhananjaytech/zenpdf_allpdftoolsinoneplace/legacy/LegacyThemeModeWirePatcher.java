package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy;

import androidx.datastore.preferences.PreferencesProto;
import androidx.datastore.preferences.protobuf.CodedInputStream;
import androidx.datastore.preferences.protobuf.CodedOutputStream;
import androidx.datastore.preferences.protobuf.WireFormat;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Arrays;

/** Produces a bounded, preservation-first raw-wire patch for {@code theme_mode}. */
public final class LegacyThemeModeWirePatcher {
    public static final int MAX_BYTES = 1024 * 1024;
    public static final int MAX_ENTRIES = 1000;
    public static final int MAX_GROWTH_BYTES = 64;
    public static final int MAX_OUTPUT_BYTES = MAX_BYTES + MAX_GROWTH_BYTES;
    private static final int MAX_RECURSION = 8;
    private static final String THEME_KEY = "theme_mode";

    /** Compatibility entry point for the coordinator while it adopts the typed result. */
    public byte[] patch(byte[] source, String mode) throws IOException {
        return patchResult(source, mode).bytes;
    }

    public PatchResult patchResult(byte[] source, String mode) throws PatchFailure {
        validateMode(mode);
        if (source == null) {
            throw new PatchFailure(FailureReason.CORRUPT);
        }
        if (source.length > MAX_BYTES) {
            throw new PatchFailure(FailureReason.TOO_LARGE);
        }

        final Scan scan;
        try {
            scan = scanMap(source);
        } catch (PatchFailure failure) {
            throw failure;
        } catch (IOException | RuntimeException failure) {
            throw new PatchFailure(FailureReason.CORRUPT);
        }

        if (scan.target != null
                && scan.target.effectiveValueIsString
                && mode.equals(scan.target.effectiveValueString)) {
            return new PatchResult(source, false);
        }
        if (scan.target == null && scan.entryCount == MAX_ENTRIES) {
            throw new PatchFailure(FailureReason.TOO_LARGE);
        }

        final byte[] candidate;
        try {
            byte[] canonicalValueField = canonicalValueField(mode);
            if (scan.target == null) {
                byte[] canonicalEntry = canonicalEntry(mode);
                byte[] wrapper = lengthDelimitedField(1, canonicalEntry);
                candidate = concatenate(source, wrapper);
            } else {
                byte[] patchedPayload = concatenate(scan.target.payload, canonicalValueField);
                byte[] rebuiltTarget = lengthDelimitedField(1, patchedPayload);
                candidate = replace(source, scan.target.start, scan.target.end, rebuiltTarget);
                verifyChangedSlicePreservation(source, candidate, scan.target, rebuiltTarget,
                        patchedPayload);
            }
            verifyGrowth(source.length, candidate.length);
            verifyCandidate(candidate, mode);
            if (scan.target == null
                    && !Arrays.equals(source, Arrays.copyOf(candidate, source.length))) {
                throw new PatchFailure(FailureReason.CORRUPT);
            }
        } catch (PatchFailure failure) {
            throw failure;
        } catch (IOException | RuntimeException failure) {
            throw new PatchFailure(FailureReason.CORRUPT);
        }
        return new PatchResult(candidate, true);
    }

    private static Scan scanMap(byte[] source) throws IOException, PatchFailure {
        CodedInputStream input = CodedInputStream.newInstance(source);
        input.setRecursionLimit(MAX_RECURSION);
        input.setSizeLimit(MAX_BYTES);
        int entries = 0;
        Target target = null;
        while (!input.isAtEnd()) {
            int start = input.getTotalBytesRead();
            int tag = input.readTag();
            if (tag == 0) {
                throw new PatchFailure(FailureReason.CORRUPT);
            }
            int field = WireFormat.getTagFieldNumber(tag);
            int wire = WireFormat.getTagWireType(tag);
            rejectGroup(wire);
            if (field == 1) {
                if (wire != WireFormat.WIRETYPE_LENGTH_DELIMITED) {
                    throw new PatchFailure(FailureReason.CORRUPT);
                }
                entries++;
                if (entries > MAX_ENTRIES) {
                    throw new PatchFailure(FailureReason.TOO_LARGE);
                }
                byte[] payload = readLengthDelimited(input);
                EntryScan entry = scanEntry(payload, 1);
                int end = input.getTotalBytesRead();
                if (THEME_KEY.equals(entry.key)) {
                    target = new Target(start, end, payload,
                            entry.effectiveValueIsString, entry.effectiveValueString);
                }
            } else {
                skipField(input, wire);
            }
        }
        if (input.getTotalBytesRead() != source.length) {
            throw new PatchFailure(FailureReason.CORRUPT);
        }
        return new Scan(entries, target);
    }

    private static EntryScan scanEntry(byte[] payload, int depth)
            throws IOException, PatchFailure {
        checkDepth(depth);
        CodedInputStream input = CodedInputStream.newInstance(payload);
        input.setRecursionLimit(MAX_RECURSION);
        String key = "";
        ValueScan effectiveValue = ValueScan.noKnownValue();
        while (!input.isAtEnd()) {
            int tag = input.readTag();
            if (tag == 0) {
                throw new PatchFailure(FailureReason.CORRUPT);
            }
            int field = WireFormat.getTagFieldNumber(tag);
            int wire = WireFormat.getTagWireType(tag);
            rejectGroup(wire);
            if (field == 1 && wire == WireFormat.WIRETYPE_LENGTH_DELIMITED) {
                key = input.readStringRequireUtf8();
            } else if (field == 2 && wire == WireFormat.WIRETYPE_LENGTH_DELIMITED) {
                effectiveValue = effectiveValue.merge(
                        scanValue(readLengthDelimited(input), depth + 1));
            } else {
                skipField(input, wire);
            }
        }
        if (input.getTotalBytesRead() != payload.length) {
            throw new PatchFailure(FailureReason.CORRUPT);
        }
        return new EntryScan(key, effectiveValue.isString, effectiveValue.stringValue);
    }

    private static ValueScan scanValue(byte[] payload, int depth) throws IOException, PatchFailure {
        checkDepth(depth);
        CodedInputStream input = CodedInputStream.newInstance(payload);
        input.setRecursionLimit(MAX_RECURSION);
        boolean hasKnownValue = false;
        boolean isString = false;
        String stringValue = null;
        while (!input.isAtEnd()) {
            int tag = input.readTag();
            if (tag == 0) {
                throw new PatchFailure(FailureReason.CORRUPT);
            }
            int field = WireFormat.getTagFieldNumber(tag);
            int wire = WireFormat.getTagWireType(tag);
            rejectGroup(wire);
            boolean known = isKnownValueField(field, wire);
            if (field == 5 && wire == WireFormat.WIRETYPE_LENGTH_DELIMITED) {
                stringValue = input.readStringRequireUtf8();
                hasKnownValue = true;
                isString = true;
            } else if (field == 6 && wire == WireFormat.WIRETYPE_LENGTH_DELIMITED) {
                scanStringSet(readLengthDelimited(input), depth + 1);
                hasKnownValue = true;
                isString = false;
                stringValue = null;
            } else {
                skipField(input, wire);
                if (known) {
                    hasKnownValue = true;
                    isString = false;
                    stringValue = null;
                }
            }
        }
        if (input.getTotalBytesRead() != payload.length) {
            throw new PatchFailure(FailureReason.CORRUPT);
        }
        return new ValueScan(hasKnownValue, isString, stringValue);
    }

    private static boolean isKnownValueField(int field, int wire) {
        return (field == 1 && wire == WireFormat.WIRETYPE_VARINT)
                || (field == 2 && wire == WireFormat.WIRETYPE_FIXED32)
                || (field == 3 && wire == WireFormat.WIRETYPE_VARINT)
                || (field == 4 && wire == WireFormat.WIRETYPE_VARINT)
                || (field == 5 && wire == WireFormat.WIRETYPE_LENGTH_DELIMITED)
                || (field == 6 && wire == WireFormat.WIRETYPE_LENGTH_DELIMITED)
                || (field == 7 && wire == WireFormat.WIRETYPE_FIXED64)
                || (field == 8 && wire == WireFormat.WIRETYPE_LENGTH_DELIMITED);
    }

    private static void scanStringSet(byte[] payload, int depth)
            throws IOException, PatchFailure {
        checkDepth(depth);
        CodedInputStream input = CodedInputStream.newInstance(payload);
        input.setRecursionLimit(MAX_RECURSION);
        while (!input.isAtEnd()) {
            int tag = input.readTag();
            if (tag == 0) {
                throw new PatchFailure(FailureReason.CORRUPT);
            }
            int field = WireFormat.getTagFieldNumber(tag);
            int wire = WireFormat.getTagWireType(tag);
            rejectGroup(wire);
            if (field == 1 && wire == WireFormat.WIRETYPE_LENGTH_DELIMITED) {
                input.readStringRequireUtf8();
            } else {
                skipField(input, wire);
            }
        }
        if (input.getTotalBytesRead() != payload.length) {
            throw new PatchFailure(FailureReason.CORRUPT);
        }
    }

    private static byte[] readLengthDelimited(CodedInputStream input) throws IOException {
        int length = input.readRawVarint32();
        if (length < 0 || length > MAX_BYTES) {
            throw new IOException();
        }
        return input.readRawBytes(length);
    }

    private static void skipField(CodedInputStream input, int wire)
            throws IOException, PatchFailure {
        switch (wire) {
            case WireFormat.WIRETYPE_VARINT:
                input.readRawVarint64();
                return;
            case WireFormat.WIRETYPE_FIXED64:
                input.readRawLittleEndian64();
                return;
            case WireFormat.WIRETYPE_LENGTH_DELIMITED:
                int length = input.readRawVarint32();
                if (length < 0 || length > MAX_BYTES) {
                    throw new IOException();
                }
                input.skipRawBytes(length);
                return;
            case WireFormat.WIRETYPE_FIXED32:
                input.readRawLittleEndian32();
                return;
            default:
                throw new PatchFailure(FailureReason.CORRUPT);
        }
    }

    private static void rejectGroup(int wire) throws PatchFailure {
        if (wire == WireFormat.WIRETYPE_START_GROUP || wire == WireFormat.WIRETYPE_END_GROUP) {
            throw new PatchFailure(FailureReason.CORRUPT);
        }
    }

    private static void checkDepth(int depth) throws PatchFailure {
        if (depth > MAX_RECURSION) {
            throw new PatchFailure(FailureReason.TOO_LARGE);
        }
    }

    private static byte[] canonicalValueField(String mode) throws IOException {
        return lengthDelimitedField(2, stringValue(mode));
    }

    private static byte[] canonicalEntry(String mode) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        CodedOutputStream coded = CodedOutputStream.newInstance(out);
        coded.writeString(1, THEME_KEY);
        coded.writeRawBytes(canonicalValueField(mode));
        coded.flush();
        return out.toByteArray();
    }

    private static byte[] stringValue(String mode) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        CodedOutputStream coded = CodedOutputStream.newInstance(out);
        coded.writeString(5, mode);
        coded.flush();
        return out.toByteArray();
    }

    private static byte[] lengthDelimitedField(int field, byte[] payload) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(payload.length + 8);
        CodedOutputStream coded = CodedOutputStream.newInstance(out);
        coded.writeTag(field, WireFormat.WIRETYPE_LENGTH_DELIMITED);
        coded.writeUInt32NoTag(payload.length);
        coded.writeRawBytes(payload);
        coded.flush();
        return out.toByteArray();
    }

    private static byte[] concatenate(byte[] first, byte[] second) {
        byte[] result = Arrays.copyOf(first, first.length + second.length);
        System.arraycopy(second, 0, result, first.length, second.length);
        return result;
    }

    private static byte[] replace(byte[] source, int start, int end, byte[] replacement) {
        byte[] result = new byte[source.length - (end - start) + replacement.length];
        System.arraycopy(source, 0, result, 0, start);
        System.arraycopy(replacement, 0, result, start, replacement.length);
        System.arraycopy(source, end, result, start + replacement.length, source.length - end);
        return result;
    }

    private static void verifyGrowth(int sourceLength, int candidateLength) throws PatchFailure {
        if (candidateLength > MAX_OUTPUT_BYTES
                || candidateLength < sourceLength - MAX_GROWTH_BYTES
                || candidateLength - sourceLength > MAX_GROWTH_BYTES) {
            throw new PatchFailure(FailureReason.TOO_LARGE);
        }
    }

    private static void verifyCandidate(byte[] candidate, String mode)
            throws IOException, PatchFailure {
        PreferencesProto.PreferenceMap verified = PreferencesProto.PreferenceMap.parseFrom(candidate);
        PreferencesProto.Value effective = verified.getPreferencesMap().get(THEME_KEY);
        if (effective == null
                || effective.getValueCase() != PreferencesProto.Value.ValueCase.STRING
                || !mode.equals(effective.getString())) {
            throw new PatchFailure(FailureReason.CORRUPT);
        }
    }

    private static void verifyChangedSlicePreservation(
            byte[] source, byte[] candidate, Target target, byte[] rebuiltTarget,
            byte[] patchedPayload) throws PatchFailure {
        int suffixLength = source.length - target.end;
        if (!regionEquals(source, 0, candidate, 0, target.start)
                || !regionEquals(target.payload, 0, patchedPayload, 0, target.payload.length)
                || !regionEquals(rebuiltTarget, 0, candidate, target.start, rebuiltTarget.length)
                || !regionEquals(source, target.end, candidate,
                        target.start + rebuiltTarget.length, suffixLength)) {
            throw new PatchFailure(FailureReason.CORRUPT);
        }
    }

    private static boolean regionEquals(
            byte[] first, int firstOffset, byte[] second, int secondOffset, int length) {
        for (int index = 0; index < length; index++) {
            if (first[firstOffset + index] != second[secondOffset + index]) {
                return false;
            }
        }
        return true;
    }

    private static void validateMode(String mode) throws PatchFailure {
        if (!("SYSTEM".equals(mode)
                || "DYNAMIC".equals(mode)
                || "LIGHT".equals(mode)
                || "DARK".equals(mode))) {
            throw new PatchFailure(FailureReason.INVALID_ARGUMENT);
        }
    }

    public enum FailureReason {
        INVALID_ARGUMENT,
        CORRUPT,
        TOO_LARGE
    }

    public static final class PatchFailure extends IOException {
        public final FailureReason reason;

        PatchFailure(FailureReason reason) {
            super(reason.name());
            this.reason = reason;
        }
    }

    public static final class PatchResult {
        public final byte[] bytes;
        public final boolean changed;

        PatchResult(byte[] bytes, boolean changed) {
            this.bytes = bytes;
            this.changed = changed;
        }
    }

    private static final class Scan {
        final int entryCount;
        final Target target;

        Scan(int entryCount, Target target) {
            this.entryCount = entryCount;
            this.target = target;
        }
    }

    private static final class Target {
        final int start;
        final int end;
        final byte[] payload;
        final boolean effectiveValueIsString;
        final String effectiveValueString;

        Target(int start, int end, byte[] payload,
                boolean effectiveValueIsString, String effectiveValueString) {
            this.start = start;
            this.end = end;
            this.payload = payload;
            this.effectiveValueIsString = effectiveValueIsString;
            this.effectiveValueString = effectiveValueString;
        }
    }

    private static final class EntryScan {
        final String key;
        final boolean effectiveValueIsString;
        final String effectiveValueString;

        EntryScan(String key, boolean effectiveValueIsString, String effectiveValueString) {
            this.key = key;
            this.effectiveValueIsString = effectiveValueIsString;
            this.effectiveValueString = effectiveValueString;
        }
    }

    private static final class ValueScan {
        final boolean hasKnownValue;
        final boolean isString;
        final String stringValue;

        ValueScan(boolean hasKnownValue, boolean isString, String stringValue) {
            this.hasKnownValue = hasKnownValue;
            this.isString = isString;
            this.stringValue = stringValue;
        }

        ValueScan merge(ValueScan later) {
            return later.hasKnownValue ? later : this;
        }

        static ValueScan noKnownValue() {
            return new ValueScan(false, false, null);
        }
    }
}
