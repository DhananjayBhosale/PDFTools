# T017 Gradle Runtime Blocker

## Result

BLOCKED by environment, not project source.

- Exact Gradle 8.14.3 distribution: downloaded and cached.
- `gradlew --version`: PASS under Temurin 25.0.2.
- First compile invocation: stopped before project compilation with `Unsupported class file major version 69`.
- Installed Java 21: absent. System Temurin and Android Studio JBR are both Java 25.0.2.
- Android compilation, tests, lint, APK assembly, APK identity, and APK hash: NOT RUN/NOT CHECKED.
- Source/config/package/lock/wrapper/signing/device/Play changes: none.

Next: provision a checksum-verified official macOS arm64 Eclipse Temurin 21 in a dedicated user-local PDF Chef directory, then rerun with process-local `JAVA_HOME` only.

