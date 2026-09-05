# T003 Pre-T010 Scope Manifest

Captured 2026-08-29 before the first write-capable Worker in the non-Git shared workspace.

| Path | State | SHA-256 | Size |
| --- | --- | --- | ---: |
| `package.json` | present | `fe5aac42b2522f959a8a428f3fd44355ef81a7de72a81f599e0e8a26b9e64b82` | 2315 |
| `package-lock.json` | present | `ad3158af683c6f017299181411a63dc3252c80536f40d0cbbc1beaa05fd9f848` | 184857 |
| `capacitor.config.ts` | present | `46b128d6605acce726618070ed7dfc0264c092878ca35f1f0e2888455920bd0a` | 196 |
| `android/` | absent | n/a | n/a |
| `scripts/verify-android-host-skeleton.mjs` | absent | n/a | n/a |

The allowed T010 scope is exactly these three existing files plus the two absent/new targets above. The scoped source count excluding `node_modules`, `dist`, iOS copied web assets, and GoalBuddy board assets was 456 files at capture; this is context, not a clean-tree claim.

T010 must produce a post-worker changed-file and SHA-256 manifest before its audit.
