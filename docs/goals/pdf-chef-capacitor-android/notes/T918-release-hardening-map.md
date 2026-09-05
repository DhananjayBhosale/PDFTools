# T918 local release-hardening map

## Decision

The PDF.js vulnerability blocker is stale for the exact current lockfile and needs no package change. The next real local blocker is Android release optimization: the release build still has R8 disabled.

## PDF.js

- `package.json` and `package-lock.json` resolve `pdfjs-dist` exactly to `6.3.289`, directly and through `@aiden0z/pptx-renderer`.
- GitHub's reviewed `CVE-2026-16633` advisory affects `>=5.6.83, <6.2.108`; `6.3.289` is outside that range.
- `npm audit --json --omit=dev` against the exact current lockfile returned zero production vulnerabilities across 71 production dependencies.
- The project uses the WebView-compatible PDF.js legacy API/worker entry points. No forced package migration is justified by the current advisory evidence.
- Defense-in-depth `enableScripting:false`/`isEvalSupported:false` remains a possible later hardening change, but it is not required to close the cited advisory and should not be mixed into the release-minification slice.

Authoritative sources:

- https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j
- https://www.npmjs.com/package/pdfjs-dist

## Android release optimization

- `android/app/build.gradle` currently sets `release.minifyEnabled false`, does not enable resource shrinking, and uses the legacy `proguard-android.txt` default.
- AGP is `8.13.0`; `android/gradle.properties` has no full-mode opt-out.
- Android's current guidance for AGP 8.13 is to enable code/resource optimization, use `proguard-android-optimize.txt`, and optionally enable the AGP 8.12/8.13 optimized resource-shrinking pipeline.
- Capacitor ships consumer rules that preserve annotated plugin callbacks/methods and `Plugin` subclasses.
- Gson 2.13.2 includes its own `META-INF/proguard/gson.pro` rules.
- ML Kit common 18.11.0 includes consumer rules for runtime annotations/JNI-marked elements. The document-scanner and PDF-viewer-fragment top-level AARs do not themselves include consumer ProGuard files, so the first R8 build must be treated as evidence discovery and must stop on missing-class warnings or any need for broad package keeps.
- The current app rule for `CommonComponentRegistrar` is narrow; the R8 output and a focused scanner runtime gate must determine whether it is sufficient. Do not add broad ML Kit or AndroidX PDF keep rules preemptively.

Authoritative sources:

- https://developer.android.com/topic/performance/app-optimization/enable-app-optimization
- https://developer.android.com/blog/posts/configure-and-troubleshoot-r8-keep-rules
- https://developers.google.com/ml-kit/vision/doc-scanner/android

## Next bounded task

T919 should enable release code/resource optimization with the modern optimized default file, run one unsigned release R8 build, inspect mapping/usage/configuration/missing-rule evidence, and keep rules narrow. It may add a focused static verifier. It must not touch frontend/iOS/reference-project source, use devices, access signing credentials, or change Play state. Runtime proof of the shrunk release must remain NOT CHECKED unless a separate authorized, production-equivalent signing/install route becomes available.

`full_outcome_complete: false`

