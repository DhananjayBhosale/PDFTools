# T039 document delivery acceptance

Decision: ACCEPTED as an inactive implementation slice.

The accepted source creates one document service graph lazily on the first explicit document call. That graph owns one shared pending-import store, picker, legacy resolver, owned writer, MediaStore exporter, and share stager. Write sessions use canonical `w1_` references. Finish, retain, recovery, already-owned retries, and source loading revalidate no-follow identity, exact size, SHA-256, and MIME magic before publishing or returning data.

MediaStore export distinguishes pending, published, and indeterminate rows. Only positively pending rows may be rolled back; published or indeterminate outcomes preserve the private recovery journal and snapshot and return `DOCUMENT_DURABILITY_UNCERTAIN`. Share intents accept only the exact canonical URI `content://<authority>/pdfchef_share_staging/<token>.bin` with a read grant.

Verification:

- Focused T039 JVM tests: PASS 25/25.
- Full Android JVM tests: PASS 123/123.
- Static delivery, legacy inspector, legacy theme writer, and release-security verifiers: PASS.
- Full JDK 21 rerun: PASS 267/267 tasks.
- Exact-class disposable API 36 instrumentation: PASS 2/2.
- Disposable emulator stopped; the physical OnePlus was not targeted or modified.

Evidence scope: `LOCAL_JVM_AND_DISPOSABLE_EMULATOR_ONLY`.

Not checked: registered FileProvider behavior, actual recipient grant access, Application runtime ownership, plugin discovery, physical-device behavior, signing, Play, upgrade, or production behavior.

Next allowed task: `T040-PRE`. T040 implementation remains blocked until that design gate is independently accepted. Full goal outcome remains false and `PRODUCTION_RELEASE_READY` remains `NO`.
