package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/** Opaque, presentation-free state for a future user-initiated document picker. */
public final class PickerRequestPolicy {
    private static final Pattern BATCH_REF = Pattern.compile("b1_[A-Za-z0-9_-]{22,64}");
    private final RefPayloadGenerator refPayloadGenerator;

    public PickerRequestPolicy() {
        SecureRandom random = new SecureRandom();
        this.refPayloadGenerator = () -> {
            byte[] bytes = new byte[18];
            random.nextBytes(bytes);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        };
    }

    PickerRequestPolicy(RefPayloadGenerator refPayloadGenerator) {
        this.refPayloadGenerator = Objects.requireNonNull(refPayloadGenerator);
    }

    public Request create(
            boolean userInitiated,
            List<String> acceptedMimeTypes,
            int maximumItems) throws Failure {
        if (!userInitiated) throw invalid();
        String payload = refPayloadGenerator.generate();
        String sessionRef = payload == null ? null : "b1_" + payload;
        return validated(sessionRef, acceptedMimeTypes, maximumItems);
    }

    public Request restore(
            String sessionRef,
            List<String> acceptedMimeTypes,
            int maximumItems) throws Failure {
        return validated(sessionRef, acceptedMimeTypes, maximumItems);
    }

    public String documentRef(Request request, int orderedIndex) throws Failure {
        if (request == null || orderedIndex < 0 || orderedIndex >= request.maximumItems) {
            throw invalid();
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(request.sessionRef.getBytes(StandardCharsets.US_ASCII));
            digest.update((byte) 0);
            digest.update(Integer.toString(orderedIndex).getBytes(StandardCharsets.US_ASCII));
            return "d1_" + Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(digest.digest());
        } catch (NoSuchAlgorithmException impossible) {
            throw unavailable();
        }
    }

    private static Request validated(
            String sessionRef,
            List<String> acceptedMimeTypes,
            int maximumItems) throws Failure {
        if (sessionRef == null || !BATCH_REF.matcher(sessionRef).matches()
                || acceptedMimeTypes == null || acceptedMimeTypes.isEmpty()
                || maximumItems <= 0) {
            throw invalid();
        }
        if (maximumItems > AndroidDocumentIngressPolicy.MAX_ITEMS) throw limit();
        ArrayList<String> copy = new ArrayList<>(acceptedMimeTypes.size());
        Set<String> unique = new HashSet<>();
        for (String mimeType : acceptedMimeTypes) {
            if (!AndroidDocumentIngressPolicy.isSupportedMimeType(mimeType)
                    || !unique.add(mimeType)) {
                throw invalid();
            }
            copy.add(mimeType);
        }
        return new Request(sessionRef, copy, maximumItems);
    }

    private static Failure invalid() {
        return new Failure("DOCUMENT_INVALID_ARGUMENT", "The document request is invalid.");
    }

    private static Failure limit() {
        return new Failure("DOCUMENT_LIMIT_EXCEEDED", "The document limit was exceeded.");
    }

    private static Failure unavailable() {
        return new Failure("DOCUMENT_UNAVAILABLE", "The document picker is unavailable.");
    }

    public static final class Request {
        private final String sessionRef;
        private final List<String> acceptedMimeTypes;
        private final int maximumItems;

        private Request(String sessionRef, List<String> acceptedMimeTypes, int maximumItems) {
            this.sessionRef = sessionRef;
            this.acceptedMimeTypes = Collections.unmodifiableList(new ArrayList<>(acceptedMimeTypes));
            this.maximumItems = maximumItems;
        }

        public String sessionRef() { return sessionRef; }
        public List<String> acceptedMimeTypes() { return acceptedMimeTypes; }
        public int maximumItems() { return maximumItems; }
        public boolean acceptsMimeType(String mimeType) {
            return acceptedMimeTypes.contains(mimeType);
        }
    }

    public static final class Failure extends Exception {
        private final String code;
        private Failure(String code, String message) {
            super(message);
            this.code = code;
        }
        public String code() { return code; }
    }

    @FunctionalInterface interface RefPayloadGenerator {
        String generate();
    }
}
