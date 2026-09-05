# T922 Android API 29 lint receipt

## Decision

`ACCEPTED_API29_LINT_REPAIR`

The scanner now converts official private-cache file URIs with `Paths.get(URI)`, which is supported at the app's API 29 floor. The existing canonical containment, no-symlink checks, regular-file validation, private streaming, and cleanup remain unchanged.

The five reader icon tints now use AppCompat `app:tint` with the exact same color resources. No dimensions, colors, drawables, text, layout, motion, interaction, or public API changed.

## Verification

- Exact scanner result-source JVM test: PASS 4/4 on the ordinary debug unit-test target.
- `lintMinifiedQa`: PASS, 0 errors / 27 warnings.
- `assembleMinifiedQa`: PASS.
- `lintRelease`: PASS, 0 errors / 27 warnings.
- Unsigned release APK/AAB rebuild: PASS.
- Release minification, release security, plugin catalogue, scanner dependency, offline, and packaged-asset checks: PASS.

The release-derived unit-test target remains intentionally unused because an unrelated shared test references the debug-only legacy crash controller. No test-only release source, keep rule, lint suppression, or baseline was added.

## Current artifacts

- Minified QA APK: `535fc6422362dc4e6f1ed84324b3138b2ca5598cdca5a87b3945f6cc96fbbc00` (20,138,475 bytes)
- Unsigned release APK: `f878a8b17c75e371e23e365b1268b248fea4366ccb2092c15ad84e85f8f401d3` (20,130,255 bytes)
- Unsigned release AAB: `333c7868ebe083931fb6b05aa2d0cb9e81b4440f7f96745981c08018d0623e93` (20,004,829 bytes)
- QA/release R8 mapping: `431bb203870ba6ad2cf25a998711a419b8568157b481f8e3ea8a5515ce5c4071`

`apksigner` rejects the release APK as unsigned and `jarsigner` reports the AAB as unsigned. No release credential, Play state, physical device, frontend, or iOS file was accessed. Production readiness remains `NO`.
