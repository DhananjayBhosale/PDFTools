# T924 release authority decision packet

Status: **WAITING_FOR_EXPLICIT_USER_CHOICE**

No signing credential, keystore, alias, password, Play mutation, upload, rollout,
or physical device action is authorized by this note.

## Frozen current evidence

- Application ID: `com.dhananjaytech.pdfchef`
- Candidate metadata: versionCode `22`, versionName `2.2.4`
- Play production: versionCode `20`; known local predecessor: versionCode `21`
- Public Play App Signing SHA-256:
  `e650e9f6776dacd520241372687ca20e3eb6c319ad2ea608eeed946e2ee69d1e`
- Public upload certificate SHA-256:
  `932ad2a73f09c3ccb40711e51e3808c22a0aaced1af3fd10f9a7222f357747ce`
- Current unsigned release AAB SHA-256:
  `333c7868ebe083931fb6b05aa2d0cb9e81b4440f7f96745981c08018d0623e93`
  (20,004,829 bytes)
- Current unsigned release APK SHA-256:
  `f878a8b17c75e371e23e365b1268b248fea4366ccb2092c15ad84e85f8f401d3`
  (20,130,255 bytes)
- Minified normal-phone scanner, durable Recent, cold relaunch, and native reader:
  PASS under T923.
- Physical OnePlus, protected release signing, Play internal delivery, and genuine
  Play-signed upgrade: NOT CHECKED.

## Choose exactly one next gate

1. **Release-signing compatibility only (recommended smallest next gate).**
   Use an already configured protected signing environment if available, never
   reveal secret values, produce one signed candidate, and compare only its public
   certificate fingerprint with the registered upload certificate. Do not upload to
   Play and do not target a physical device. If protected signing configuration is
   unavailable, stop and report that without requesting secrets in chat.

2. **Sign and upload to Play internal testing.**
   Includes option 1, then uploads the exact hash-bound AAB to the PDF Chef internal
   track and validates Play acceptance and Play-signed update delivery. No production
   rollout is authorized. This changes Play Console state and therefore needs explicit
   approval.

3. **Validate on the physical OnePlus.**
   Requires the named device to be attached and unlocked. Preserve app data: no
   uninstall and no clear-data. A final release acceptance should preferably use the
   Play-internal build, because a locally upload-signed APK does not prove the
   Play-delivered signer/update path.

4. **Stop at the current verified state.**
   Keep `production_release_ready: NO` and `full_outcome_complete: false`.

## Reconciliation note

The later T902 audit message describes the exact risks already addressed by the
accepted implementation: a persisted ordered `b1_` manifest, exact membership/order
binding, payload promotion through `retainPending`, crash-safe mixed pending/owned
retry, bounded acknowledgement receipts, and live-manifest cleanup only after full
promotion. T902 remains accepted and was not reopened or modified under T924.
