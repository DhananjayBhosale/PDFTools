# T012 Pre-Scope Manifest

Captured before activating the T012 Worker.

## Existing Allowed Files

- `services/domain/workspaceModels.ts`: `ec1248be1349916ba60b49bb1c1466a39ecb8319448a31fe73daef8e7fb7f143`
- `services/platform/contracts.ts`: `b852cafac9f09d23bf3fe1480b14a6f41ef2ce22e06c4f5d00d64e94d937ca0c`

## Absent Allowed Paths

- `services/platform/android/legacyCompatibilityContracts.ts`
- `scripts/generate-android-legacy-contract-fixtures.mjs`
- `tests/fixtures/android-legacy/`
- `tests/platform/androidLegacyCompatibilityContracts.test.ts`

The Kotlin reference, React/UI files, Android host, dependencies, native plugin, signing material, devices, and Play state are outside T012 scope.

