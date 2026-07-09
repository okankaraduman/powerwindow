# Android Closed Test Checklist

## Web

- [x] Privacy page at `https://powerwindow.energy/privacy`
- [x] Demo Wallbox clearly labeled as demo-only
- [x] PWA manifest includes PNG icon
- [ ] Confirm Cloudflare Pages has deployed latest `main`

## Android

- [x] Gradle wrapper files added
- [x] Adaptive launcher icon resources added
- [x] Release signing configuration added
- [ ] Install Android Studio or Java + Android SDK
- [ ] Create release keystore
- [ ] Copy `android/keystore.properties.example` to `android/keystore.properties`
- [ ] Build signed release bundle with `./gradlew bundleRelease`

## Google Play

- [x] Store icon generated: `store/assets/icon-512.png`
- [x] Feature graphic generated: `store/assets/feature-graphic.png`
- [x] Phone screenshots generated under `store/assets/screenshots/`
- [x] Listing draft written in `store/play-store-listing.md`
- [x] Data Safety draft written in `store/data-safety.md`
- [ ] Create app in Play Console
- [ ] Fill App Content forms
- [ ] Add privacy policy URL
- [ ] Upload signed AAB to internal or closed test
- [ ] For new personal developer accounts, recruit 12 testers for 14 continuous days
