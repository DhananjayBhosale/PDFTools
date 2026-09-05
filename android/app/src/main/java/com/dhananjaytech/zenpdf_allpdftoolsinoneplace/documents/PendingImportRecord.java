package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.EOFException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Objects;
import java.util.regex.Pattern;

/** Durable metadata for an owned pending import. Contains no source or filesystem metadata. */
public final class PendingImportRecord implements Comparable<PendingImportRecord> {
    private static final int MAGIC = 0x50434931; // PCI1
    private static final int VERSION = 1;
    static final int MAX_ENCODED_BYTES = 512;
    private static final Pattern REF = Pattern.compile("d1_[A-Za-z0-9_-]{22,64}");
    private static final Pattern HASH = Pattern.compile("[0-9a-f]{64}");

    private final String ref;
    private final String mimeType;
    private final long sizeBytes;
    private final String contentHash;
    private final long createdAtMillis;

    PendingImportRecord(
            String ref,
            String mimeType,
            long sizeBytes,
            String contentHash,
            long createdAtMillis) throws IOException {
        if (!isValidRef(ref)
                || !AndroidDocumentIngressPolicy.isSupportedMimeType(mimeType)
                || sizeBytes <= 0
                || sizeBytes > AndroidDocumentIngressPolicy.MAX_ITEM_BYTES
                || contentHash == null
                || !HASH.matcher(contentHash).matches()
                || createdAtMillis < 0) {
            throw new IOException("Invalid pending record");
        }
        this.ref = ref;
        this.mimeType = mimeType;
        this.sizeBytes = sizeBytes;
        this.contentHash = contentHash;
        this.createdAtMillis = createdAtMillis;
    }

    public String ref() { return ref; }
    public String mimeType() { return mimeType; }
    public long sizeBytes() { return sizeBytes; }
    public String contentHash() { return contentHash; }
    public long createdAtMillis() { return createdAtMillis; }

    static boolean isValidRef(String ref) {
        return ref != null && REF.matcher(ref).matches();
    }

    static String refPayload(String ref) throws IOException {
        if (!isValidRef(ref)) throw new IOException("Invalid pending ref");
        return ref.substring(3);
    }

    byte[] encode() throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (DataOutputStream output = new DataOutputStream(bytes)) {
            output.writeInt(MAGIC);
            output.writeInt(VERSION);
            writeAscii(output, ref);
            writeAscii(output, mimeType);
            output.writeLong(sizeBytes);
            writeAscii(output, contentHash);
            output.writeLong(createdAtMillis);
        }
        byte[] encoded = bytes.toByteArray();
        if (encoded.length > MAX_ENCODED_BYTES) throw new IOException("Record too large");
        return encoded;
    }

    static PendingImportRecord decode(byte[] encoded) throws IOException {
        if (encoded == null || encoded.length == 0 || encoded.length > MAX_ENCODED_BYTES) {
            throw new IOException("Invalid record bytes");
        }
        try (DataInputStream input = new DataInputStream(new ByteArrayInputStream(encoded))) {
            if (input.readInt() != MAGIC || input.readInt() != VERSION) {
                throw new IOException("Invalid record header");
            }
            PendingImportRecord record = new PendingImportRecord(
                    readAscii(input, 67),
                    readAscii(input, 128),
                    input.readLong(),
                    readAscii(input, 64),
                    input.readLong());
            if (input.read() != -1) throw new IOException("Trailing record bytes");
            return record;
        } catch (EOFException failure) {
            throw new IOException("Truncated record", failure);
        }
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
        for (byte value : bytes) {
            if ((value & 0x80) != 0) throw new IOException("Invalid ASCII field");
        }
        return new String(bytes, StandardCharsets.US_ASCII);
    }

    @Override public int compareTo(PendingImportRecord other) {
        int time = Long.compare(createdAtMillis, other.createdAtMillis);
        return time != 0 ? time : ref.compareTo(other.ref);
    }

    @Override public boolean equals(Object other) {
        if (!(other instanceof PendingImportRecord)) return false;
        PendingImportRecord record = (PendingImportRecord) other;
        return sizeBytes == record.sizeBytes
                && createdAtMillis == record.createdAtMillis
                && ref.equals(record.ref)
                && mimeType.equals(record.mimeType)
                && contentHash.equals(record.contentHash);
    }

    @Override public int hashCode() {
        return Objects.hash(ref, mimeType, sizeBytes, contentHash, createdAtMillis);
    }
}
