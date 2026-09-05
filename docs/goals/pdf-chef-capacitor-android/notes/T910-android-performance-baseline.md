# T910 Android local-debug performance baseline

Accepted on 2026-08-30 against the exact v21 legacy debug APK and the exact current Android debug candidate.

## Evidence boundary

- This is a controlled local debug comparison on one wiped disposable API 36.1 normal-phone emulator (`1080x2400`, density `420`).
- Both APKs use package `com.dhananjaytech.pdfchef.debug`, launch `com.dhananjaytech.zenpdf_allpdftoolsinoneplace.MainActivity`, and have certificate SHA-256 `68d93880fda2a6d340e58207d010471711d1e5c25e139b76aa587dfff4e41a0c`.
- The v21 predecessor was freshly installed, its onboarding was dismissed, and its steady-state sample was collected. The candidate was then installed with `adb install -r -d` without uninstalling or clearing package data.
- Startup samples use `am start -W -S`: process-cold launches with the emulator OS and page cache warm. Each steady sample has three warmups and ten measured iterations. The harness does not uninstall or clear package data.
- This does **not** prove the production application ID, Play App Signing certificate, Play delivery, release-build performance, a physical device, or release eligibility. Candidate versionCode `1` remains lower than predecessor versionCode `21`; the downgrade flag is debug-only.

## Exact artifacts

| Artifact | Bytes | Version | SHA-256 |
| --- | ---: | --- | --- |
| Legacy debug predecessor | 95,241,971 | 2.2.4-debug (21) | `a64cb59c8686d08fedb219cc3d83af7e66da4067faf16f4d76761e1cd8be23f1` |
| Current debug candidate | 41,570,716 | 1.0 (1) | `25d0aa61cec60ac083040468efed5e946198271c5e724cbd19b09e20b3196213` |

The candidate APK is 56.4% smaller in this debug-to-debug comparison.

## Results

| Measurement | v21 predecessor | Current candidate | Delta |
| --- | ---: | ---: | ---: |
| First launch / first post-update `TotalTime` | 791 ms | 663 ms | -16.2% |
| Steady `TotalTime` p50 | 557 ms | 473 ms | -15.1% |
| Steady `TotalTime` p90 | 570 ms | 512 ms | -10.2% |
| Steady `TotalTime` p95 | 575 ms | 520 ms | -9.6% |
| Steady `TotalTime` mean | 554 ms | 480 ms | -13.4% |
| Home total PSS | 154,130 KiB | 124,754 KiB | -19.1% |
| Recent total PSS | 153,830 KiB | 125,932 KiB | -18.1% |
| Settings total PSS | 147,311 KiB | 127,852 KiB | -13.2% |

The candidate is directionally better on every bounded launch and PSS measurement in this exact local-debug pair. Thermal status was `0` for both steady runs. Captured exit history contained only harness force-stops, expected isolated WebView cleanup, and the package-update event; no crash or ANR reason appeared.

`gfxinfo` is retained in each raw report but is not used as a smoothness verdict: the candidate steady report contained only 18 rendered frames, which is not a representative interaction sample.

## Upgrade-continuity finding

After the predecessor onboarding had been completed and the candidate was installed over it without clearing data, the candidate still opened its own `Before you start` sheet. The sheet was dismissed before candidate steady-state measurements. This is a concrete onboarding-continuity gap, not a performance failure and not preserved-state proof. The next bounded UI/bootstrap task must import the already-available strict legacy `onboarding_completed=true` signal before the shared Onboarding component initializes, without changing its visible design.

## Verification and cleanup

- `node --check scripts/benchmark-android-candidate.mjs` — PASS.
- `node scripts/benchmark-android-candidate.mjs --self-test` — PASS.
- Protected-device refusal — PASS: the harness rejected `emulator-5554` before ADB access.
- Ten hash-bound JSON reports were written under `output/t910-android-performance/`; write-once output prevents silent replacement.
- The disposable emulator used port 5566, was killed after the run, and disappeared from `adb devices -l`. The existing emulator-5554 was not targeted. Chrome was not opened.

## Bound hashes

- Harness `8ee5380de057eea2f6638743ecd9dc312014eaa86877583316921d9830be44b8`
- Candidate first post-update `1fb5ebea02bf3678732859f59df0ed3a8ea3a076f7b6fbe2291c240cc096e439`
- Candidate steady `a7bb33e3c3634dc9bfa459e343d700e98be87acf491b5364044edd7ed68a5400`
- Candidate Home `cb3d88191c379aecb0b6d4adea03acfccef27efce52fc3ed787aeb83e7d33edb`
- Candidate Recent `b9f6423befc2933d4a26bdc2c707029a4388512640c35c9707525cb34a74b05e`
- Candidate Settings `451c1e8c8cdceb4b06386b46350ff745061c46d458bfc09b47b959602f5e888a`
- Predecessor first `0ab68549ca6d185cdcc7cd46ffb29b9674d5b21fb6188645ceac370f2b0dddf4`
- Predecessor steady `7a4e3d766ebcd1498c1605f8f7a2d608c5ea6fb7abd34847aaaeefc0dba7d80b`
- Predecessor Home `ec708a887b98e8b2dbf2a2c578671c68f38da7fd8b95a0032afcfa726d95ebb2`
- Predecessor Recent `2399d99b6a73f78355daf7e10a764ac950af8747354e9b5222a00bd1c7ef2c42`
- Predecessor Settings `cb652220843644d55b9bb8f832bb8241eec546220ecae57003b95f2e26118361`

## Remaining boundary

T910 closes the local debug performance baseline only. Production version selection, Play App Signing/update compatibility, Play internal install-over proof, a release-like benchmark, physical-device behavior, and the onboarding-continuity repair remain open. `full_outcome_complete: false`; `production_release_ready: NO`.
