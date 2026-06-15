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

## Background location tracking (live driver map)

The Driver App reports each driver's GPS position to dispatch (RouteOne → Live
Map). On the web/PWA this only works while the app is open. For **all-day
background tracking** (phone locked, app backgrounded) the native APK must be
rebuilt with the background-geolocation plugin and the Android permissions
below — this is a one-time wrapper change.

1. Pull the latest project and install deps (the plugin is already in
   `package.json`):
   ```bash
   npm install
   npx cap sync android   # links @capacitor-community/background-geolocation
   ```
2. Add these permissions to `android/app/src/main/AndroidManifest.xml` inside
   the `<manifest>` element (the plugin also documents this in its README):
   ```xml
   <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
   <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
   <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
   <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
   <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
   ```
   And register the plugin's foreground service inside `<application>`:
   ```xml
   <service
     android:name="com.equimaps.capacitor_background_geolocation.BackgroundGeolocationService"
     android:foregroundServiceType="location"
     android:enabled="true"
     android:exported="false" />
   ```
3. Rebuild and sign the APK (see Build steps above), then redistribute it.
4. On the phone, the driver must grant location permission and choose
   **"Allow all the time"** when prompted, otherwise Android stops updates once
   the screen locks. A persistent notification ("RouteOne tracking active") is
   shown while tracking — this is required by Android for background location.

> **Privacy / UK GDPR:** Tracking staff location is personal data. Make sure
> drivers are informed (employment policy / privacy notice) and that there is a
> lawful basis before enabling this in production.

