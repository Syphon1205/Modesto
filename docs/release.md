# Release Checklist

This document covers build-only native validation and publishing desktop releases from one tag.

## What the workflow does

- Triggers:
  - Manual dispatch defaults to build-only validation and uploads workflow artifacts without publishing anything.
  - A pushed tag matching `v*.*.*` publishes after successful builds.
  - Manual publication requires the explicit `publish_release=true` input.
- Runs quality gates first: lint, typecheck, test.
- Builds four artifacts in parallel:
  - macOS `arm64` DMG
  - macOS `x64` DMG
  - Linux `x64` AppImage
  - Windows `x64` NSIS installer
- Publishes one versioned GitHub Release with all produced files.
  - Versions with a suffix after `X.Y.Z` (for example `1.2.3-alpha.1`) are published as GitHub prereleases.
  - Stable 0.5.x releases are GitHub Latest; the 0.4.x compatibility release remains historical.
- Publishes default `latest*.yml` metadata plus byte-identical `modesto*.yml` and legacy `modesto*.yml` aliases on every stable release.
- Keeps the historical 0.4.x compatibility release unchanged; current stable payloads stay on their own GitHub Latest release.
- Publishes prerelease installers only on their versioned GitHub prerelease; prereleases never replace stable update manifests.
- Publishes the CLI package (`apps/server`, npm package `@modesto/cli`) with OIDC trusted publishing.
- Public macOS releases require signing and notarization; publication fails before building if any Apple secret is missing. Build-only validation may still emit an ad-hoc-signed macOS artifact.
- Windows signing remains optional and is auto-detected from secrets.

## Desktop auto-update notes

- Runtime updater: `electron-updater` in `apps/desktop/src/main.ts`.
- Update UX:
  - Background checks run on startup delay + interval.
  - New updates are prepared/downloaded in the background after detection; install/restart stays manual.
  - The desktop UI shows a rocket update button while preparing and switches to an install action once the update is ready.
- Provider: GitHub Releases (`provider: github`) configured at build time.
- Distribution repository: public `Syphon1205/Modesto`, which intentionally contains binaries and release notes rather than application source. The authenticated private-repository provider does not honor custom channel filenames.
- Source repository: private. Its release workflow publishes only built artifacts to the public distribution repository.
- Runtime channel: `modesto`. Stable releases publish `latest`, `modesto`, and legacy `modesto` metadata; the 0.4.x compatibility release remains available for historical migration.
- Repository slug source:
  - `MODESTO_DESKTOP_UPDATE_REPOSITORY` (format `owner/repo`), if set.
  - otherwise `GITHUB_REPOSITORY` from GitHub Actions.
- Cross-repository publication uses `RELEASE_REPOSITORY_TOKEN`, a fine-grained token stored only in the private source repository with write access to releases in `Syphon1205/Modesto`. Publication fails before building when the source and distribution repositories differ and this secret is absent.
- Required Modesto release assets for updater:
  - platform installers (`.exe`, `.dmg`, `.AppImage`, plus macOS `.zip` for Squirrel.Mac update payloads)
  - `modesto-mac.yml`, `modesto.yml`, and `modesto-linux.yml` metadata
  - every stable release also includes the `latest*.yml` defaults and legacy `modesto*.yml` aliases
  - `*.blockmap` files, except the macOS update `.zip.blockmap` removed after zip repack
- Enforced upgrade path:
  - Stable clean Modesto releases are created with `make_latest=true` and carry default, Modesto, and legacy Modesto manifest filenames in the versioned release.
  - The historical 0.4.x compatibility release remains available for predecessor migration and is never overwritten by a 0.5.x release.
  - Clean releases do not mirror payloads onto the historical compatibility release, so the 0.4.x line remains immutable.
  - Clean-release publication fails closed if the required default, Modesto, or legacy Modesto aliases are missing.
- Production desktop builds omit web/server/desktop source maps by default to keep update payloads small. Set `MODESTO_WEB_SOURCEMAP=1`, `MODESTO_SERVER_SOURCEMAP=1`, or `MODESTO_DESKTOP_SOURCEMAP=1` only for a diagnostic release that needs them.
- macOS metadata note:
  - The build initially emits `latest-mac.yml` for both Intel and Apple Silicon.
  - The workflow merges the per-arch macOS metadata, keeps it as `latest-mac.yml`, and copies it to `modesto-mac.yml` and `modesto-mac.yml` for stable releases.
  - The desktop build script repacks the macOS update `.zip` with `ditto`, verifies Electron framework symlinks, extracts the zip, validates the extracted app signature, patches the matching `latest-mac*.yml` hash/size, and removes the stale `.zip.blockmap`.
  - macOS updater downloads intentionally use the full zip payload so Squirrel.Mac installs the exact signed archive validated by release build.
- Local smoke test:
  - Run `bun run release:smoke:mac-update -- --skip-build --build-version 0.1.5` on macOS after local desktop/server/web dist files exist.
  - The smoke builds a mock update artifact, validates manifest hash/size, serves a HEAD-only local endpoint, confirms the manifest and zip are addressable without downloading the zip body, then cleans up its temp output.
  - Boolean env flags for release scripts accept `true/false`, `1/0`, `yes/no`, and `on/off`; CLI flags are still preferred for repeatable local commands.

## 0) npm OIDC trusted publishing setup (CLI)

The workflow publishes the CLI with `bun publish` from `apps/server` after bumping
the package version to the release tag version.

Checklist:

1. Confirm the npm account controls the `@modesto` scope and can publish `@modesto/cli`.
2. In npm package settings, configure Trusted Publisher:
   - Provider: GitHub Actions
   - Repository: this repo
   - Workflow file: `.github/workflows/release.yml`
   - Environment (if used): match your npm trusted publishing config
3. Ensure npm account and org policies allow trusted publishing for the package.
4. Create release tag `vX.Y.Z` and push; workflow will:
   - set `apps/server/package.json` version to `X.Y.Z`
   - build web + server
   - run `bun publish --access public`

## Modesto compatibility notes

- The desktop updater expects the pinned compatibility release in this repository to include the generated updater metadata files, not just the installers.
- The published release title should read `Modesto vX.Y.Z`.
- By default, the first-party desktop release path does not require CLI publish or post-release version-bump automation.
- Optional jobs stay disabled unless repository variables enable them:
  - `MODESTO_PUBLISH_CLI=1`
  - `MODESTO_FINALIZE_RELEASE=1`

## 1) Build-only native CI validation

Use this before publication to validate the real native macOS, Linux, and Windows build matrix. Build-only mode does not create a tag, GitHub Release, npm package, updater manifest, or version-bump commit.

1. Push the release-candidate branch so GitHub Actions can check it out.
2. Start the workflow in build-only mode:
   - `gh workflow run release.yml --ref BRANCH -f version=X.Y.Z -f publish_release=false`
3. Wait for `.github/workflows/release.yml` to finish.
4. Confirm preflight and all four native matrix builds pass.
5. Download the workflow artifacts and sanity-check installation on each OS.

To publish from a manual dispatch instead of a tag push, pass `publish_release=true`. This is intentionally opt-in.

## 2) Apple signing + notarization setup (macOS)

Required secrets used by the workflow:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `APPLE_API_KEY`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`
- `RELEASE_REPOSITORY_TOKEN` when the workflow runs from the separate private source repository

Checklist:

1. Apple Developer account access:
   - Team has rights to create Developer ID certificates.
2. Create `Developer ID Application` certificate.
3. Export certificate + private key as `.p12` from Keychain.
4. Base64-encode the `.p12` and store as `CSC_LINK`.
5. Store the `.p12` export password as `CSC_KEY_PASSWORD`.
6. In App Store Connect, create an API key (Team key).
7. Add API key values:
   - `APPLE_API_KEY`: contents of the downloaded `.p8`
   - `APPLE_API_KEY_ID`: Key ID
   - `APPLE_API_ISSUER`: Issuer ID
8. Re-run a tag release and confirm macOS artifacts are signed/notarized.

Notes:

- `APPLE_API_KEY` is stored as raw key text in secrets.
- The workflow writes it to a temporary `AuthKey_<id>.p8` file at runtime.
- Public release jobs fail closed when any required Apple secret is absent. Signed builds also validate the stapled ticket and run a Gatekeeper assessment on both the packaged app and the app extracted from the updater zip before upload.

## 3) Azure Trusted Signing setup (Windows)

Windows signing is optional for both the `0.4.2` compatibility bridge and the
clean `0.5.0` release. When any Azure signing secret is absent, the workflow
continues and produces an unsigned NSIS installer, matching previous releases.
Signing is enabled only when all of the following secrets are present:

- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TRUSTED_SIGNING_ENDPOINT`
- `AZURE_TRUSTED_SIGNING_ACCOUNT_NAME`
- `AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME`
- `AZURE_TRUSTED_SIGNING_PUBLISHER_NAME`

Optional signing checklist:

1. Create Azure Trusted Signing account and certificate profile.
2. Record ATS values:
   - Endpoint
   - Account name
   - Certificate profile name
   - Publisher name
3. Create/choose an Entra app registration (service principal).
4. Grant service principal permissions required by Trusted Signing.
5. Create a client secret for the service principal.
6. Add Azure secrets listed above in GitHub Actions secrets.
7. Re-run a build-only workflow and confirm the Windows installer is signed.

If Windows signing is not being configured, no placeholder or empty secrets are
needed. Leave them absent and verify the workflow reports that it is building an
unsigned installer.

## 4) Ongoing release checklist

1. Ensure `main` is green in CI.
2. Run the build-only native CI validation for the release-candidate branch and version.
3. Bump app version as needed.
4. Confirm `gh api repos/OWNER/REPO/releases/latest --jq .tag_name` returns the compatibility tag configured in `scripts/release-update-policy.json`.
5. Create release tag: `vX.Y.Z`.
6. Push tag.
7. Verify workflow steps:
   - preflight passes
   - all matrix builds pass
   - release job uploads expected files
8. Confirm the new versioned release is GitHub Latest and contains default, `modesto`, and legacy `modesto` manifests.
9. Smoke test downloaded artifacts.

## 5) Troubleshooting

- macOS build unsigned when expected signed:
  - Public release builds refuse to continue in this state. Check all Apple secrets are populated and non-empty.
- macOS build passes signing but fails notarization verification:
  - Inspect the electron-builder/notarytool output, confirm the certificate is a `Developer ID Application` certificate, and verify the App Store Connect API key is active and belongs to the same Apple team.
- Windows build unsigned when expected signed:
  - Check all Azure ATS and auth secrets are populated and non-empty.
- Build fails with signing error:
  - Retry with all Azure signing secrets removed to use the supported unsigned path.
  - Re-check certificate/profile names and tenant/client credentials.
