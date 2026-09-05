package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents;

import android.content.ContentValues;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import androidx.core.content.FileProvider;
import java.io.FileNotFoundException;

/** Narrow FileProvider that refuses every mutation path even when called directly. */
public final class ReadOnlyDocumentFileProvider extends FileProvider {
    @Override public ParcelFileDescriptor openFile(Uri uri, String mode)
            throws FileNotFoundException {
        if (!"r".equals(mode)) throw new SecurityException("Read-only document provider");
        return super.openFile(uri, mode);
    }

    @Override public Uri insert(Uri uri, ContentValues values) {
        throw new SecurityException("Read-only document provider");
    }

    @Override public int update(Uri uri, ContentValues values, String selection,
            String[] selectionArgs) {
        throw new SecurityException("Read-only document provider");
    }

    @Override public int delete(Uri uri, String selection, String[] selectionArgs) {
        throw new SecurityException("Read-only document provider");
    }
}
