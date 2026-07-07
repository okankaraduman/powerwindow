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

## Build From Terminal

If Android Studio or the Android Gradle tooling is installed:

```sh
cd /Users/okankaraduman/Documents/Electricity/android
gradle assembleDebug
```

The debug APK will be created under:

```text
android/app/build/outputs/apk/debug/
```

## Next Step

For a stronger Play Store path, convert this wrapper to a Trusted Web Activity after the
web app has stable icons, screenshots, privacy policy, and Digital Asset Links configured.
