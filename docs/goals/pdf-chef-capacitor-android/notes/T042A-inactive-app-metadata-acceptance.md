# T042A-I inactive app-metadata acceptance

Result: accepted for the inactive implementation only.

`AndroidAppMetadata` exposes exactly `getMetadata({}) -> {name, version, build}` using only the public application label, version name, and version code string. Root review corrected the nullable-build wire case to emit an explicit JSON null instead of allowing `JSONObject` to remove the `build` key.

Evidence:

- Focused JVM contract: PASS.
- Focused TypeScript adapter: PASS, 5/5.
- TypeScript no-emit: PASS.
- App-metadata verifier: PASS.
- Android plugin catalogue: PASS; plugin remains unregistered and absent from the production entry graph.
- Release-security verifier: PASS.

Accepted hashes:

- native plugin: `029ed1c4aec870f20dd5982812fc1af06921a0c2861f4c450108d64c631efa77`
- JVM contract: `1daebe3d29b4b264d9a61074f37a0bfc38733afe642511536410a0245f504336`
- TypeScript client: `cea98dfc0e36eb66e27ffb4843fe4728b3fc3257c9b5a68337c5bd637bd0364e`
- TypeScript test: `1b01d712f4e9a45e1704f45aa006786efaca067c01daf137f0a496dbb19e591f`
- verifier: `bd04b084c93f116e19721fad46770115ae934e9dcfca6eb5942f0fc457e4f7e0`

Registration and emulator discovery remain separately gated and NOT CHECKED.
