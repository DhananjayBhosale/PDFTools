# T018 JDK 21 and Build Receipt

## Infrastructure PASS

- Official metadata: Eclipse Adoptium API `https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=aarch64&image_type=jdk&os=mac&vendor=eclipse`.
- Release: `jdk-21.0.12.1+1`, OpenJDK `21.0.12.1+1-LTS`, macOS arm64 HotSpot JDK.
- Archive: `OpenJDK21U-jdk_aarch64_mac_hotspot_21.0.12.1_1.tar.gz` from the official Temurin 21 GitHub release.
- Expected and downloaded SHA-256: `3623232f33a9c3baadf304480b2535f9a3cba8a58d42ecbb438ba267315d9998` — exact match before extraction.
- Installed only under `/Users/dhananjaybhosale/.local/share/pdf-chef/toolchains/temurin-21`.
- Java 21.0.12.1, javac 21.0.12.1, and Gradle 8.14.3 on JVM 21: PASS.

## Artifact Gate BLOCKED

- Main Java compilation: PASS.
- Android-test Java compilation: PASS.
- Unit-test compilation: FAIL at `HostIdentityTest.java:10`; AGP BuildConfig generation is not enabled, so `BuildConfig.APPLICATION_ID` is unresolved.
- Android lint/assemble: NOT RUN after the source stop condition.
- Static host verifier and bundled-index comparison: PASS.
- APK identity/hash: NOT CHECKED; no APK exists.
- Project source/config changed by T018: none.

T019 is restricted to enabling standard AGP BuildConfig generation in `android/app/build.gradle`, leaving the identity test and expected debug ID unchanged.

