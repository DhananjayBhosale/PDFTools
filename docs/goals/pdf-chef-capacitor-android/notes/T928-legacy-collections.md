# T928 legacy collection parity

Decision: **ACCEPTED — implementation and focused contracts**

Preserved legacy directory outputs now appear as first-class Recent collections.
They remain logical groups with an opaque `a1_` reference, exact item count, and
no MIME type or single byte representation. The phone UI uses a folder mark,
never offers Reopen, selection, rename, delete, or Undo, and names native actions
honestly as multi-file Save and Share operations.

Native delivery reads only the canonical immediate children under the preserved
legacy `processed` directory. Enumeration is capped before sorting at 301 entries,
then rejects overflow; accepted groups contain 1–300 regular readable no-follow
files and no more than 128 MiB. Symlinks, nested entries, escape, unsupported
content, count/size drift, and identity change fail closed. The index and payloads
remain read-only.

Export writes images to a PDF Chef Pictures album and other homogeneous supported
groups to a PDF Chef Downloads folder. Partial export is rolled back. Share uses
one bounded private stage, `ACTION_SEND_MULTIPLE`, `ClipData`, and read-only grants;
undispatched cancellation removes every staged child and dispatched groups expire
through the existing bounded cleanup.

Focused evidence:

- TypeScript Android documents/workspace contracts: PASS, 45/45.
- TypeScript no-emit after the branded-ref correction: PASS.
- Recent collection behavior: PASS, 30/30 (23 preserved + 7 collection cases).
- Native resolver/export/share/coordinator/bridge: PASS, 46/46.
- Bounded cap-before-sort resolver subset: PASS, 10/10.
- Android delivery verifier: PASS.
- No full build, browser, emulator, device, signing, Play, dist/public, iOS, manifest,
  Gradle, scanner, reader, storage, or settings gate ran in this task.

Claude Code used `claude-opus-5` for the source pass. The CLI response labelled its
effort `medium` despite the requested High flag, so this receipt does not claim the
required final Opus High visual gate; that remains deliberately consolidated with
the one normal-phone milestone review.

Primary SHA-256:

- `workspaceModels.ts` `6261c8a25eb8f0e57f8f872b9969023604ab25905010125240bd4d1564e1f2cd`
- `androidWorkspacePlatform.ts` `e79c83f5ed6cc781e0cd12d6234658ac8611875bbfe8d8666264bf26ebeb2c93`
- `RecentPage.tsx` `5c6cbe9346918dcac2b7853c43b7c6332a3328e4ae734418f408c3a9417894a2`
- `useWorkspaceRuntime.tsx` `7ce13776506bc7b38aeba4bc27ecc1929d626eed145d73b00f0ab0ceae37a0e6`
- `design-system/MASTER.md` `21e8caa0204c09af1755ef206cd1d39c3e8bcffc1e17e7d078023afcdcbba08b`
- `LegacyDocumentOpenResolver.java` `bbe26e7336791ccfd31d09d03439706b808d26cde6a31a346c6eda8b6d6180dd`
- `DocumentLifecycleCoordinator.java` `7b1d03e884e009784564314ddd0701c1b97acc034845e70087ebcce51f432dd3`
- `AndroidDocumentsPlugin.java` `9480df6e85407f73cbfb389a84bc653187e3af58f44a30e48014c11e3bd72e02`
- `AndroidDocumentExporter.java` `8e595eba5a4087830e46f8721ae6ffe884ec29f0cca09f8968abd03a21d0f161`
- `AndroidDocumentSharer.java` `3e918e12a5689587ca874465fa36825a3b3dcd07876d6dce06e4ec10c50267b3`
- `verify-android-document-delivery.mjs` `e69d74b72b75e2b6d2ccc074962dbeb87f00ac21cdc355589189559c5bd24691`

Production release readiness remains **NO**. Signing, Play delivery, physical-device
behavior, and production telemetry were not checked.
