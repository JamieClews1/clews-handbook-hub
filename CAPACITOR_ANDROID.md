# RouteOne Driver — Android APK (no Play Store)

This produces an installable `.apk` you can host on your website as a direct
download link. It is a thin native wrapper around the live Driver App at
`https://clewshandbook.lovable.app/driver`, so once installed it always loads
the latest version — you only rebuild the APK if you change the wrapper itself
(icon, name, splash), **not** for normal app updates.

## One-time prerequisites (on a Mac/Windows/Linux dev machine)
1. Install **Android Studio** (includes the Android SDK + Gradle).
2. Install **Node.js 18+**.
3. Export this project to GitHub (Lovable → GitHub → Export), then `git clone` it.

## Build steps
Run these from the project root after cloning:

```bash
npm install
npx cap add android        # first time only — creates the /android folder
npx cap sync android       # copies config into the native project
```

Then build the APK:

```bash
cd android
./gradlew assembleRelease  # produces an unsigned/debug-signable release APK
# OR for a quick test build:
./gradlew assembleDebug
```

The APK appears at:
- Debug:   `android/app/build/outputs/apk/debug/app-debug.apk`
- Release: `android/app/build/outputs/apk/release/app-release.apk`

> A **debug** APK installs fine via sideload for internal/driver use.
> For a **release** APK you must sign it (see "Signing" below).

## Hosting the download link
1. Upload the `.apk` to your website (or `public/` folder) e.g.
   `https://clewsrecycling.co.uk/downloads/routeone-driver.apk`.
2. Add a button/link on a page that points to it.
3. On the phone: tap the link → allow **"Install unknown apps"** for the browser
   → install. (Android shows this prompt automatically the first time.)

## Signing a release APK (optional, recommended for wider distribution)
```bash
keytool -genkey -v -keystore routeone.keystore -alias routeone \
  -keyalg RSA -keysize 2048 -validity 10000
```
Add the keystore to `android/app/build.gradle` signingConfigs, then
`./gradlew assembleRelease`. Keep the keystore safe — you need the same one for
future updates.

## Updating the app
- **Content/feature changes** (anything in the Lovable app): just publish in
  Lovable. Installed apps pick it up automatically — no new APK needed.
- **Wrapper changes** (app name, icon, splash, Android permissions): edit, then
  re-run `npx cap sync android` and rebuild the APK.
