# Power Window Android

This is a small Trusted Web Activity wrapper for the production web app at:

```text
https://powerwindow.energy/
```

It is intentionally thin: the product stays web-first, while Android gets a launchable app
that opens the PWA through the user's browser engine. When Digital Asset Links are configured
with the release signing certificate, Chrome can launch it fullscreen as a verified TWA.

## Open Locally

1. Install Android Studio.
2. Open `/Users/okankaraduman/Documents/Electricity/android`.
3. Let Android Studio sync Gradle.
4. Run the `app` configuration on an emulator or Android device.

The TWA loads the production site:

```text
https://powerwindow.energy/
```

After Cloudflare Pages deploys the latest `main`, the Android app shows the same planner,
statistics, and demo smart-charging connector as the website.

## Build From Terminal

If JDK 17 and the Android SDK are installed:

```sh
cd /Users/okankaraduman/Documents/Electricity/android
./gradlew assembleDebug
```

The debug APK will be created under:

```text
android/app/build/outputs/apk/debug/
```

Android Studio is still the easiest test path because it brings a compatible JDK, Android SDK,
emulator, and device tooling. A local Java 8 runtime is not enough for the current Android
Gradle plugin.

## Digital Asset Links

Trusted Web Activity verification requires `https://powerwindow.energy/.well-known/assetlinks.json`.
Do not publish a placeholder fingerprint. Use the real SHA-256 certificate fingerprint from either:

- Play Console: `Release > Setup > App signing`, after the app exists in Google Play.
- Your local release keystore, if you distribute outside Play.

Use this template:

```text
android/assetlinks.release.template.json
```

Replace `REPLACE_WITH_PLAY_APP_SIGNING_SHA256_OR_RELEASE_CERT_SHA256` with the SHA-256 fingerprint,
then publish the JSON at:

```text
.well-known/assetlinks.json
```

Without this file, the app can still launch the website, but Chrome may show browser UI instead of
running as a fully verified fullscreen TWA.

## Signed Release Bundle

Create a release keystore outside the repo, then copy:

```text
android/keystore.properties.example
```

to:

```text
android/keystore.properties
```

Fill in the keystore path and passwords. `android/keystore.properties` must stay local and
should not be committed.

Then build the Play Store bundle:

```sh
cd /Users/okankaraduman/Documents/Electricity/android
./gradlew bundleRelease
```

The release AAB will be created under:

```text
android/app/build/outputs/bundle/release/
```

## Quickest Android Test

1. On an Android phone, open Chrome.
2. Visit `https://powerwindow.energy/`.
3. Use Chrome's install option to install the PWA.
4. Open Power Window from the launcher.
5. In the planner, use `Connect demo`, then `Send plan`, then `Start` / `Stop`.

That tests the production backend and the same UI the TWA loads.

## Play Store Next Step

1. Create the app in Play Console.
2. Get the Play App Signing SHA-256 fingerprint.
3. Publish `.well-known/assetlinks.json`.
4. Create `android/keystore.properties` from the example file.
5. Build `./gradlew bundleRelease`.
6. Upload the AAB to internal or closed testing.
