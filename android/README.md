# Power Window Android

This is a small native Android wrapper for the production web app at:

```text
https://powerwindow.energy/
```

It is intentionally thin: the product stays web-first, while Android gets a launchable app
that can be opened in Android Studio and later prepared for Play Store testing.

## Open Locally

1. Install Android Studio.
2. Open `/Users/okankaraduman/Documents/Electricity/android`.
3. Let Android Studio sync Gradle.
4. Run the `app` configuration on an emulator or Android device.

The wrapper loads the production site:

```text
https://powerwindow.energy/
```

After Cloudflare Pages deploys the latest `main`, the Android app will show the same planner
and mock smart-charging connector as the website.

## Build From Terminal

If Android Studio or Android Gradle tooling is installed:

```sh
cd /Users/okankaraduman/Documents/Electricity/android
gradle assembleDebug
```

The debug APK will be created under:

```text
android/app/build/outputs/apk/debug/
```

This repo does not currently include a Gradle wrapper, so `./gradlew` will not work until one
is added. Android Studio is the easiest test path.

## Quickest Android Test

1. On an Android phone, open Chrome.
2. Visit `https://powerwindow.energy/`.
3. Use Chrome's install option to install the PWA.
4. Open Power Window from the launcher.
5. In the planner, use `Connect mock`, then `Send plan`, then `Start` / `Stop`.

That tests the production backend and the same UI the native wrapper loads.

## Next Step

For a stronger Play Store path, convert this wrapper to a Trusted Web Activity after the
web app has stable icons, screenshots, privacy policy, and Digital Asset Links configured.
