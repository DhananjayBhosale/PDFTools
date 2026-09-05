package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.EOFException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/** Versioned, ordered pending-import batch manifest with no source-location metadata. */
final class PendingImportBatch implements Comparable<PendingImportBatch> {
    static final int MAX_ENCODED_BYTES = 8 * 1024;
    static final int MAX_ITEMS = AndroidDocumentIngressPolicy.MAX_ITEMS;
    private static final int MAGIC = 0x50434231; // PCB1
    private static final int VERSION = 1;
    private static final int INCOMPLETE = 1;
    private static final int COMPLETE = 2;
    private static final int ACKNOWLEDGED = 3;
    private static final Pattern BATCH_REF = Pattern.compile("b1_[A-Za-z0-9_-]{43}");

    private final String batchRef;
    private final List<String> refs;
    private final int state;
    private final long createdAtMillis;
    private final long stateAtMillis;

    private PendingImportBatch(String batchRef, List<String> refs, int state,
            long createdAtMillis, long stateAtMillis) throws IOException {
        List<String> checked = checkedRefs(refs);
        if (!BATCH_REF.matcher(batchRef).matches() || !batchRef.equals(batchRef(checked))
                || (state != INCOMPLETE && state != COMPLETE && state != ACKNOWLEDGED)
                || createdAtMillis < 0 || stateAtMillis < createdAtMillis) {
            throw new IOException("Invalid pending batch");
        }
        this.batchRef = batchRef;
        this.refs = checked;
        this.state = state;
        this.createdAtMillis = createdAtMillis;
        this.stateAtMillis = stateAtMillis;
    }

    static PendingImportBatch begin(List<String> refs, long nowMillis) throws IOException {
        List<String> checked = checkedRefs(refs);
        return new PendingImportBatch(batchRef(checked), checked, INCOMPLETE, nowMillis, nowMillis);
    }

    PendingImportBatch complete(long nowMillis) throws IOException {
        if (state != INCOMPLETE && state != COMPLETE) throw new IOException("Invalid batch state");
        return new PendingImportBatch(batchRef, refs, COMPLETE, createdAtMillis,
                Math.max(stateAtMillis, nowMillis));
    }

    PendingImportBatch acknowledge(long nowMillis) throws IOException {
        if (state != COMPLETE && state != ACKNOWLEDGED) throw new IOException("Invalid batch state");
        return new PendingImportBatch(batchRef, refs, ACKNOWLEDGED, createdAtMillis,
                Math.max(stateAtMillis, nowMillis));
    }

    String batchRef() { return batchRef; }
    List<String> refs() { return refs; }
    boolean isComplete() { return state == COMPLETE; }
    boolean isAcknowledged() { return state == ACKNOWLEDGED; }
    long stateAtMillis() { return stateAtMillis; }

    byte[] encode() throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (DataOutputStream output = new DataOutputStream(bytes)) {
            output.writeInt(MAGIC);
            output.writeInt(VERSION);
            output.writeByte(state);
            output.writeLong(createdAtMillis);
            output.writeLong(stateAtMillis);
            writeAscii(output, batchRef);
            output.writeByte(refs.size());
            for (String ref : refs) writeAscii(output, ref);
        }
        byte[] encoded = bytes.toByteArray();
        if (encoded.length > MAX_ENCODED_BYTES) throw new IOException("Batch too large");
        return encoded;
    }

    static PendingImportBatch decode(byte[] encoded) throws IOException {
        if (encoded == null || encoded.length == 0 || encoded.length > MAX_ENCODED_BYTES) {
            throw new IOException("Invalid batch bytes");
        }
        try (DataInputStream input = new DataInputStream(new ByteArrayInputStream(encoded))) {
            if (input.readInt() != MAGIC || input.readInt() != VERSION) {
                throw new IOException("Invalid batch header");
            }
            int state = input.readUnsignedByte();
            long created = input.readLong();
            long stateAt = input.readLong();
            String batchRef = readAscii(input, 46);
            int count = input.readUnsignedByte();
            if (count < 1 || count > MAX_ITEMS) throw new IOException("Invalid batch count");
            ArrayList<String> refs = new ArrayList<>(count);
            for (int index = 0; index < count; index++) refs.add(readAscii(input, 67));
            if (input.read() != -1) throw new IOException("Trailing batch bytes");
            return new PendingImportBatch(batchRef, refs, state, created, stateAt);
        } catch (EOFException failure) {
            throw new IOException("Truncated batch", failure);
        }
    }

    static String batchRef(List<String> refs) throws IOException {
        List<String> checked = checkedRefs(refs);
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update("PDFCHEF-PENDING-BATCH-V1\0".getBytes(StandardCharsets.US_ASCII));
            for (String ref : checked) {
                digest.update(ref.getBytes(StandardCharsets.US_ASCII));
                digest.update((byte) 0);
            }
            return "b1_" + Base64.getUrlEncoder().withoutPadding().encodeToString(digest.digest());
        } catch (NoSuchAlgorithmException impossible) {
            throw new IOException("SHA-256 unavailable", impossible);
        }
    }

    static boolean isValidBatchRef(String value) {
        return value != null && BATCH_REF.matcher(value).matches();
    }

    private static List<String> checkedRefs(List<String> refs) throws IOException {
        if (refs == null || refs.isEmpty() || refs.size() > MAX_ITEMS) {
            throw new IOException("Invalid batch refs");
        }
        ArrayList<String> checked = new ArrayList<>(refs.size());
        Set<String> unique = new HashSet<>();
        for (String ref : refs) {
            if (!PendingImportRecord.isValidRef(ref) || !unique.add(ref)) {
                throw new IOException("Invalid batch refs");
            }
            checked.add(ref);
        }
        return List.copyOf(checked);
    }

    private static void writeAscii(DataOutputStream output, String value) throws IOException {
        byte[] bytes = value.getBytes(StandardCharsets.US_ASCII);
        if (!value.equals(new String(bytes, StandardCharsets.US_ASCII)) || bytes.length > 255) {
            throw new IOException("Invalid ASCII field");
        }
        output.writeByte(bytes.length);
        output.write(bytes);
    }

    private static String readAscii(DataInputStream input, int maximum) throws IOException {
        int length = input.readUnsignedByte();
        if (length == 0 || length > maximum) throw new IOException("Invalid field length");
        byte[] bytes = new byte[length];
        input.readFully(bytes);
        for (byte value : bytes) if ((value & 0x80) != 0) throw new IOException("Invalid ASCII field");
        return new String(bytes, StandardCharsets.US_ASCII);
    }

    @Override public int compareTo(PendingImportBatch other) {
        int created = Long.compare(createdAtMillis, other.createdAtMillis);
        return created != 0 ? created : batchRef.compareTo(other.batchRef);
    }
}
