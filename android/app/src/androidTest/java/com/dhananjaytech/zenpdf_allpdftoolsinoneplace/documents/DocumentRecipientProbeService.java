package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents;

import android.app.Service;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Binder;
import android.os.IBinder;
import android.os.Parcel;
import android.os.ParcelFileDescriptor;
import android.os.Process;
import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;

/** Test-APK-only cross-UID recipient. Never packaged in the target application. */
public final class DocumentRecipientProbeService extends Service {
    public static final String DESCRIPTOR =
            "com.dhananjaytech.pdfchef.test.DocumentRecipientProbe";
    public static final int TRANSACTION_PROBE = IBinder.FIRST_CALL_TRANSACTION;
    public static final String READ = "read";
    public static final String WRITE = "write";
    public static final String TRUNCATE = "truncate";
    public static final String INSERT = "insert";
    public static final String UPDATE = "update";
    public static final String DELETE = "delete";
    public static final String UID = "uid";

    private final Binder binder = new Binder() {
        @Override protected boolean onTransact(int code, Parcel data, Parcel reply, int flags)
                throws android.os.RemoteException {
            if (code != TRANSACTION_PROBE) return super.onTransact(code, data, reply, flags);
            data.enforceInterface(DESCRIPTOR);
            String operation = data.readString();
            String rawUri = data.readString();
            try {
                byte[] result = probe(operation, rawUri == null ? null : Uri.parse(rawUri));
                reply.writeNoException();
                reply.writeInt(1);
                reply.writeByteArray(result);
            } catch (SecurityException | java.io.FileNotFoundException expected) {
                reply.writeNoException();
                reply.writeInt(0);
                reply.writeByteArray(null);
            } catch (Exception unexpected) {
                reply.writeNoException();
                reply.writeInt(-1);
                reply.writeByteArray(null);
            }
            return true;
        }
    };

    @Override public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        return START_NOT_STICKY;
    }

    private byte[] probe(String operation, Uri uri) throws Exception {
        if (UID.equals(operation)) {
            return Integer.toString(Process.myUid()).getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        }
        if (uri == null) throw new SecurityException("missing URI");
        if (READ.equals(operation)) {
            try (ParcelFileDescriptor descriptor = getContentResolver().openFileDescriptor(uri, "r");
                    FileInputStream input = new FileInputStream(descriptor.getFileDescriptor());
                    ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[4096];
                for (int count; (count = input.read(buffer)) != -1;) output.write(buffer, 0, count);
                return output.toByteArray();
            }
        }
        if (WRITE.equals(operation) || TRUNCATE.equals(operation)) {
            String mode = TRUNCATE.equals(operation) ? "wt" : "w";
            try (ParcelFileDescriptor ignored = getContentResolver().openFileDescriptor(uri, mode)) {
                return new byte[0];
            }
        }
        if (INSERT.equals(operation)) {
            getContentResolver().insert(uri, new ContentValues());
            return new byte[0];
        }
        if (UPDATE.equals(operation)) {
            getContentResolver().update(uri, new ContentValues(), null, null);
            return new byte[0];
        }
        if (DELETE.equals(operation)) {
            getContentResolver().delete(uri, null, null);
            return new byte[0];
        }
        throw new SecurityException("unknown operation");
    }
}
