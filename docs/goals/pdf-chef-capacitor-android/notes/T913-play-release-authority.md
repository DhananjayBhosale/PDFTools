# T913 — Google Play release authority

Date: 2026-08-30

## Verdict

The two authoritative Google Play identity facts are now verified read-only for the correct application:

- Play title: `PDF Chef: Tools & Reader`
- Package: `com.dhananjaytech.pdfchef`
- Highest visible active/testing versionCode: **20**
- Current production: **20 / 2.2.3**, full rollout
- Play App Signing certificate SHA-256: `e650e9f6776dacd520241372687ca20e3eb6c319ad2ea608eeed946e2ee69d1e`
- Upload certificate SHA-256: `932ad2a73f09c3ccb40711e51e3808c22a0aaced1af3fd10f9a7222f357747ce`

The certificates are separate and were separately labeled by Play Console. They must never be substituted for one another.

## Version boundary

- Strictly higher than the current Play maximum 20: minimum **21**.
- The known local Kotlin/debug predecessor is already versionCode 21.
- Therefore a candidate intended to pass both a normal local install-over-v21 matrix and a Play update must use at least **versionCode 22**.

This task did not edit or apply a versionCode. It only freezes the authoritative boundary.

## Read-only evidence

Google Chrome opened one task-owned tab directly to the PDF Chef release overview. The page itself confirmed the exact PDF Chef title and package context.

Visible latest releases:

| Track | Version | Status |
|---|---:|---|
| Production | 20 / 2.2.3 | Available on Google Play, full rollout |
| Closed testing - Alpha | 10 | Available to testers, full rollout |
| Internal testing | 8 | Available to internal testers, full rollout |

The visible app-bundle list was ordered with active versionCode 20 first, followed by lower inactive versions 18, 17, 15, and 14.

The App signing page showed:

- `App signing key` — in use for 100% of the install base.
- Digital Asset Links for `com.dhananjaytech.pdfchef` with SHA-256 `E6:50:E9:F6:77:6D:AC:D5:20:24:13:72:68:7C:A2:0E:3E:B6:C3:19:AD:2E:A6:08:EE:ED:94:6E:2E:E6:9D:1E`.
- A distinct `Upload key certificate` SHA-256 `93:2A:D2:A7:3F:09:C3:CC:B4:07:11:E5:1E:38:08:C2:2A:0A:AC:ED:1A:F3:FD:10:F9:A7:22:2F:35:77:47:CE`.

Machine-readable evidence: `output/t913-play-release-authority/play-release-authority.json`.

## Safety boundary

- No Play form was submitted.
- No release, upload, track, rollout, key, certificate, or account state changed.
- No credential, private key, password, alias, account identity, or unrelated app data was recorded.
- One task tab was opened and closed.
- The user's existing SpendSense Play tabs were not claimed, navigated, or changed.
- No emulator, physical device, build, signing command, or Kotlin-reference mutation was used.

## Next safe action

T914 may update only the Capacitor Android release metadata to the accepted migration floor `versionCode 22` and the compatibility release name, then rebuild unsigned/debug artifacts for local controlled upgrade testing. Signing and Play upload remain separate approval-gated tasks.

`SIGNING_UPDATE_COMPATIBILITY: NOT YET PASSED`

`PLAY_INTERNAL_UPGRADE: NOT CHECKED`

`PRODUCTION_RELEASE_READY: NO`

`full_outcome_complete: false`
