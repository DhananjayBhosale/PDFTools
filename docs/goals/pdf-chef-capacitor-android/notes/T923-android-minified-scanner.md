# T923 minified ML Kit scanner completion receipt

## Decision

`ACCEPTED_MINIFIED_SCANNER_COMPLETION`

The exact T922 minified QA APK (`535fc642...`) was installed on the disposable `Pixel7QA36` Play-Store system image at explicit serial `emulator-5566`. The phone was normalized to 1080×2400, 420 dpi, font scale 1.0. No desktop QA was run.

## Result

The visible `Scan document` action launched `com.google.android.gms/.mlkit.docscan.ui.DocumentScanningActivity` in full mode. Its gallery picker selected one task-owned page, the ML Kit review showed page 1 of 1, and completion returned to PDF Chef as:

- `Scanned document.pdf`
- 1 page scanned
- 91 KB kept on this device

The strict TypeScript adapter accepted the completed result, which proves the exact result shape and equal positive PDF/JPEG page counts; it rejects unknown keys and any mismatched or missing count. No URI, path, provider address, or bytes appeared in the UI/bridge result.

`Open scanned PDF` launched the sealed native reader and rendered page 1 of 1. After a force-stop and cold process relaunch, Recent still showed the exact durable document and `Reopen` again launched the native reader successfully.

## Evidence and cleanup

Normal-phone evidence is under `output/t923-android-minified-scanner/`; the machine-readable manifest identifies the key screenshot/log hashes. Target app PIDs 4623 and 5197 have no fatal, ANR, security, class-loading, or activity-start failure in the captured log. One unrelated Google Play services locale-permission warning is outside the target processes.

The QA package and task-owned gallery media were removed, no ADB forward existed, the emulator was closed, and the final device list is empty. Chrome was not opened. No physical device, release credential, production signing, or Play state was touched.

`minified_scanner_completion: PASS`. Production readiness remains `NO` pending separately authorized signing/Play/physical-device gates.
