# Install GymCrush on Markus's and Abby's phones

## Abby's black screen / Metro timeout: install Release

`http://192.168.31.132:8081/status` timing out followed by `No script URL provided` means the installed Debug app is looking for the Mac's Metro development server and has no embedded JavaScript to run. It cannot run independently at the gym. Rebuild and install **Release** over the existing app; do not uninstall it or clear its data.

With Abby's iPhone connected by USB, unlocked, trusted, and Developer Mode enabled:

1. Open `ios/GymCrush.xcworkspace` in Xcode. Select the GymCrush target → Signing & Capabilities → automatic signing and your existing Personal Team. Keep `tw.gymcrush.app` and the same team.
2. In Terminal, from this project directory, run:

   ```sh
   npm run ios:release
   ```

   Select Abby's physical iPhone when prompted. This runs `expo run:ios --device --configuration Release --no-bundler`: it embeds JavaScript and assets and does not start a Metro server. Keep the existing local `.env` with both public Supabase values for sync; Expo loads these at build time. No Expo account is needed.
3. Alternatively, in Xcode select Abby's phone, then Product → Scheme → Edit Scheme → Run → Info → **Build Configuration: Release**, and Product → Run. The saved shared scheme now defaults to Release; verify this setting if Xcode was already open or native projects were regenerated. Wait for the build and installation to finish.
4. Open the app, complete setup and pair the phones while online. Stop the Xcode run, unplug USB, force-close GymCrush, then reopen it from its Home Screen icon. Turn on airplane mode with Wi-Fi off and reopen once more: the UI and local workout logging must still work. Log a test set, restart, and check it persisted. Restore connectivity to check partner sync before leaving.

`npm run ios` and plain `npx expo run:ios` default to **Debug**, even when the shared Xcode scheme uses Release. Reserve those commands for development with Metro. `--no-bundler` alone does not make a Debug build standalone. If rebuilding still logs packager checks or `No script URL provided`, confirm **Release**, use Product → Clean Build Folder, then build again without deleting the installed app.

The app needs no Expo/Metro connection after a Release installation. First-time pairing and live partner sync need internet (Wi-Fi or mobile data); paired devices queue durable workout changes offline. Free Personal Team signing still expires seven days after issuance, so reinstall over the same app before the next expiry.

## After the 2026 redesign: rebuild the native app

The redesign added native modules (`expo-symbols` for SF Symbols / Material Symbols, `react-native-svg` for the weekly rings and charts) and uses `expo-router` native tabs. Because these components rely on compiled native code and new platform chrome, a JavaScript-only update is not enough. A new native build is required for both iOS and Android. For standalone use, run `npm run ios:release` on iOS or `npx expo run:android --device --variant release` on Android. Existing native projects are included; regenerate with `npx expo prebuild` only when native configuration changes require it, preserving signing first. A default Debug build needs Metro and is unsuitable for independent gym use.

## Local installation without an Expo account

Use local native builds for the first two-phone trial. An Expo account and EAS project are not needed for this route. `app.json` now supplies `assets/icon.png` and disables remote push notifications in the Expo notifications plugin so a free iOS Personal Team can sign the app. Local notifications remain enabled; closed-app remote push is not implemented.

- Android, with USB debugging enabled and the phone authorized: `npx expo run:android --device --variant release`.
- iPhone: open `ios/GymCrush.xcworkspace` after dependencies are installed, select the GymCrush target, automatic signing and your Personal Team. Select the connected iPhone and set Product → Scheme → Edit Scheme → Run → Build Configuration to Release, then Run. Free signing expires after seven days; reinstall over the same app to preserve data.
- If regenerating native projects, preserve any native signing changes and Android signing keystore first. Do not use `--clean` casually. Reinstall CocoaPods dependencies if the workspace needs regenerating.

### Abby's iPhone does not appear

1. Connect directly to the Mac using a data-capable USB cable. Unlock the iPhone: 「解鎖 iPhone」. Check Finder's sidebar for the phone. On the Mac click Trust if requested; on the phone choose 「信任這部電腦？」→「信任」, then enter 「裝置密碼」.
2. In Xcode open the run destination menu → Manage Devices, or Xcode → Open Developer Tool → Device Hub. Older Xcode versions use Window → Devices and Simulators. Select/pair the physical phone and follow any preparation prompts.
3. On the phone: 「設定」→「隱私權與安全性」→「開發者模式」→ turn on →「重新啟動」. After restarting, unlock, confirm 「開啟」, and enter the passcode. The Developer Mode option may appear only after pairing starts in Xcode.
4. If Finder cannot see the phone, try a different data cable and Mac port, keeping it unlocked. If Finder sees it but Xcode cannot use it, read the device's status in Device Hub (pairing, preparation or unsupported iOS version).
5. If opening the installed app requests developer trust: 「設定」→「一般」→「VPN 與裝置管理」→ your developer identity →「信任」. This entry may only appear after installation and when trust is required.

References: [Apple's trust instructions in Traditional Chinese](https://support.apple.com/zh-tw/109054), [Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device), [Device Hub](https://developer.apple.com/documentation/xcode/pairing-your-devices-with-your-mac).

The EAS sections below describe the optional cloud-build route, not a prerequisite for local installation.

These instructions build a standalone app. Once installed, it does not need Expo Go, Metro, the Mac, or the development relay. Both phones use the same Supabase project and pair inside the app. Internet access is needed for live sync; paired devices queue durable changes while offline.

**Your setup:** Markus uses Android, Abby uses iPhone, and you do not have a paid Apple Developer membership. Install the Android APK using step 3. For Abby, use the free Xcode Personal Team path in step 4; that installation needs renewal every seven days. TestFlight and ad hoc distribution become available if you later obtain paid membership.

## 1. Finish and verify the backend first

For this update, run `supabase/migrations/202611080002_exercise_set_edits.sql` in the existing project's SQL Editor before installing the updated app on either phone. It extends the existing event function to accept exercise deletions and set edits; without it, those changes cannot sync through Supabase. The initial migration must not be rerun.

The initial schema and anonymous sign-in are now applied to the configured GymCrush project. The live API tests passed. **Do not rerun the initial migration on this project.** The setup steps below describe provisioning a new project and rerunning verification intentionally.

1. In the GymCrush Supabase project's SQL Editor, run `supabase/migrations/202611080001_couple_sync.sql` **once**. It creates three RLS-protected tables, pairing/write functions, policies for private Realtime channels, and the private `gym-photos` bucket. It does not delete existing app data.
2. Under **Authentication → Sign In / Providers**, enable **Allow anonymous sign-ins**, then save. Each app installation receives a persisted authenticated device identity. Possessing the public project key alone does not grant access to workout records or photos.
3. After authorizing disposable backend test users/data, run:

   ```sh
   node --env-file=.env scripts/verify-supabase.mjs
   ```

   This tests pairing, duplicate retries, private messages, durable catch-up, cross-couple isolation, denied direct writes, and photo access. It leaves only disposable test data and lists the exact user/couple IDs in `/tmp/gymcrush-supabase-smoke.json` for administrator cleanup. Never delete real accounts or couples to clean up the test.
4. Run local release checks:

   ```sh
   npm ci
   npm run typecheck
   npm test
   npx expo-doctor
   npx expo export --platform all --output-dir /tmp/gymcrush-release-check
   ```

Compilation and simulated tests do not replace the two-physical-phone checks in step 6.

## 2. Link an Expo build project

From this project directory:

```sh
npx eas-cli login
EAS_NO_VCS=1 npx eas-cli init
```

Choose your Expo account and create or select GymCrush. This writes the real Expo project ID to `app.json`; no placeholder ID is included. `EAS_NO_VCS=1` is used because this workspace currently has no Git repository. If you later initialize Git, ordinary `npx eas-cli …` commands can be used instead.

The iOS bundle identifier and Android package are both `tw.gymcrush.app`. Keep this identifier stable for future updates. Android builds made with the previous package are separate apps: installing this package does not transfer their local data or anonymous device identity. Keep the old installation until you have preserved any needed records; do not uninstall it as an update step.

In the Expo project dashboard, create these two **production** environment variables using the values already in your local `.env`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` (your publishable/anon key, never a service-role or secret key)

Alternatively, use the interactive CLI and enter each value when prompted:

```sh
EAS_NO_VCS=1 npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --visibility plaintext
EAS_NO_VCS=1 npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --visibility plaintext
```

Both build profiles in `eas.json` use the `production` environment. These public values are bundled into the app, so server-side RLS remains the protection for private data. The local `.env` is ignored; do not rely on it being uploaded to the build service.

## 3. Android: install the signed APK

For either or both Android phones:

```sh
EAS_NO_VCS=1 npx eas-cli build --platform android --profile preview
```

Let Expo generate the Android signing keystore, or use the existing keystore if updating an earlier signed release. Keep the same keystore for updates.

When the build finishes, open its Expo installation URL on the Android phone, download the **APK**, and install it. If Android asks, allow that browser to install this APK. The production profile produces an AAB for Google Play; an AAB cannot be installed directly like an APK.

Use the same APK/build link for both phones if both are Android. For later updates, install the newly signed APK over the existing installation. Do not uninstall first, because this removes local state and the anonymous device identity.

## 4. Abby's iPhone without paid membership

Apple allows local device testing through a free **Personal Team** in Xcode. Its provisioning profile expires after **seven days**, requiring a rebuild/reinstall. This is the direct Xcode installation path with your current account setup. SideStore and AltStore can renew free signing as described below; they do not remove its expiry.

1. On your Mac, open **Xcode → Settings → Accounts** and sign in to the Apple Account used for the Personal Team. Complete Apple's sign-in and any account agreements yourself.
2. Connect Abby's iPhone to the Mac by USB, unlock it, and accept **Trust This Computer** on the phone. Enable **Settings → Privacy & Security → Developer Mode** if iOS requests it, then restart/confirm as directed.
3. From this project directory, open the existing native iOS workspace:

   ```sh
   open ios/GymCrush.xcworkspace
   ```

4. In Xcode, select the GymCrush app target → **Signing & Capabilities**. Enable automatic signing and select your **Personal Team**. Confirm the bundle identifier is `tw.gymcrush.app`, matching `app.json`. Keep it and the signing team stable for subsequent updates.
5. Select Abby's connected iPhone as the run destination. Under **Product → Scheme → Edit Scheme → Run**, select the **Release** build configuration so JavaScript and public Supabase configuration are embedded. Build and run onto the phone. After signing is configured, the CLI equivalent is:

   ```sh
   npm run ios:release
   ```

6. If iOS requests developer trust, follow its instructions under **Settings → General → VPN & Device Management**. Open GymCrush and pair it with your Android app using step 5 below.
7. After the seven-day profile expires, connect to the Mac and rebuild/reinstall **over the same app**, retaining the same signing team and bundle identifier. Preserve its app data and device identity; do not uninstall first.

On 2026-11-10, a local Release build was signed with the existing team, installed over GymCrush on Abby's connected iPhone, and launched successfully. Its embedded JavaScript was evaluated without the reported Metro/script-URL errors. Markus confirmed that the app opens normally, including in airplane mode. The reused provisioning profile expires **2026-11-15 at 10:47 AM Asia/Taipei**; rebuilding can reuse a still-valid profile, so do not assume every reinstall resets the seven-day period.

### Free renewal alternatives (checked 2026-11-08)

Apple's free Personal Team provisioning expires after seven days. Expo does not extend that period: local Expo/Xcode builds can use free signing, while EAS iPhone builds require paid Apple signing credentials. Expo Update changes app code/assets, not the installed binary's provisioning expiry.

- **SideStore:** the closest free option for ongoing standalone native use. Install SideStore using a computer once, then sideload a Release IPA of GymCrush. SideStore can periodically re-sign apps on the phone. Refresh requires Wi-Fi (cellular alone is insufficient) and the LocalDevVPN connection. Check renewal succeeds before seven days elapse; background refresh can fail. A free Apple Account permits three active sideloaded apps, including SideStore itself. Follow the official setup rather than installing an arbitrary signing profile.
- **AltStore Classic + AltServer:** another free way to refresh a GymCrush IPA. Leave AltServer running on the Mac and make it reachable for refreshes. This also keeps the seven-day expiry and depends on successful renewal.
- **Expo Go:** runs React Native UI inside Expo's host app; it does not give GymCrush its own standalone app identity. This project uses SDK 58, so the host must support SDK 58. Expo also offers development-certificate installation of Expo Go at `sign.expo.dev`; that route is still subject to signing expiry. It is not a solution for an independently installed GymCrush app without renewals.

For SideStore/AltStore, use a Release IPA with JavaScript bundled, so GymCrush does not depend on Metro after installation. An IPA has not been prepared or tested with these tools here. Keep the same Apple Account/team and app identifier, and preserve existing records before switching installation methods; do not delete the installed app first. These tools renew signing without rebuilding the app's JavaScript each week, but actual app updates still require a new build.

Sources: [Apple Personal Team limits](https://developer.apple.com/help/account/basics/about-your-developer-account), [Expo local development builds](https://docs.expo.dev/develop/development-builds/introduction/), [SideStore FAQ](https://docs.sidestore.io/docs/faq), [SideStore requirements](https://docs.sidestore.io/docs/installation/prerequisites), [AltServer](https://faq.altstore.io/altstore-classic/altserver), [Expo Go signing](https://sign.expo.dev/).

### If you later obtain paid Apple Developer membership

The ad hoc and TestFlight paths below require an active paid Apple Developer membership. Abby can install an invited build without buying her own developer membership.

### Direct installation for your two phones (ad hoc)

Register every iPhone **before** building:

```sh
EAS_NO_VCS=1 npx eas-cli device:create
```

Open the registration link in Safari on each iPhone and complete the device-registration steps. Then run:

```sh
EAS_NO_VCS=1 npx eas-cli build --platform ios --profile preview
```

Sign in to your Apple developer team when the CLI requests it, and select all iPhones that should install this build. Open the resulting installation URL in Safari on each registered phone and install GymCrush. Only devices included in that provisioning profile can install it. Adding another phone requires rebuilding or re-signing. Ad hoc provisioning expires and must be renewed; this is private distribution, not a permanent App Store release.

### TestFlight

Build a store-distribution binary, then submit it as a separate action:

```sh
EAS_NO_VCS=1 npx eas-cli build --platform ios --profile production
EAS_NO_VCS=1 npx eas-cli submit --platform ios --profile production
```

In App Store Connect → GymCrush → TestFlight, create a testing group and add the processed build. Invite Abby as an external tester if she is not a member of your App Store Connect team. The first external build requires Apple's Beta App Review. Install Apple's TestFlight app on the iPhone, accept the invitation, and tap Install. Do not grant App Store Connect administration access just to install the app.

TestFlight builds expire after **90 days**. Upload a replacement build before expiration. For a lasting App Store installation, a separate App Store release and review are required. No store submission or paid build was started by the local setup work.

## 5. Pair the installed apps

1. Complete first-time setup on both phones. Choose **Start Fresh** for your actual gym, or explicitly choose the sample catalog for a demo. Set the same weight unit and weekly goal initially.
2. On Markus's phone, select **Markus** in the header. Open **Partner → Connect your phones → Create couple**. This phone's name is recorded independently of the shared-machine set-entry toggle.
3. Copy/share its full 32-character invite code directly with Abby.
4. On Abby's phone, open **Partner**, paste that code, and tap **Join partner**. Do not create a second separate couple on her phone. Her profile slot is assigned as the other member automatically.
5. Keep both apps open initially. The connection indicator should show the partner live, and the shared machine catalog should appear. Each phone can then use its own network, including mobile data; they do not need the same Wi-Fi.

The header lets you enter sets for either person when sharing one machine. It does not change which paired device is physically online. Use **Setup** to edit names, units, or goals; existing machines and workout history are preserved.

**Device identity:** anonymous sign-in survives normal app restarts and app updates. Uninstalling, clearing app data, or replacing the phone loses that device identity. The invite code does not evict an already registered member. Do not uninstall as a troubleshooting step; recovery/reassignment currently requires the project administrator. There is no email/password recovery screen in this version.

## 6. Acceptance on the two actual phones

Before treating this as the accepted daily-use version:

- Add a machine using a real camera photo, then a library photo. Confirm both photos appear on the other phone and still appear after restarting the apps.
- Edit 1, 2, and 3 machine settings for each person. Check persistence and partner sync.
- Start a workout, add/remove exercises, filter routines, and enter multiple sets for both users. Verify weights, reps, per-person numbering, PR notifications, and the correct plate-change direction when alternating.
- Send one cheer from each phone. Confirm one banner appears on the receiving phone, then visit Partner and back to Workout; the cheer must not appear a second time.
- Check rest presets, +15 seconds, Skip, and elapsed time. Background a phone longer than the rest period and return; the timer should catch up.
- Disconnect a paired phone, log sets, restart it, restore connectivity, and confirm the waiting changes arrive exactly once. Keep the other phone connected during part of this test to check offline catch-up.
- Finish the session and check both histories and weekly progress. Multiple exercises or sets on one calendar day count as one completed training day per participant. The shared streak advances only when both weekly day goals are met. Weeks start Monday in the device's local timezone.
- Switch EN / 繁中, reopen Setup, edit/save/cancel, and restart the app. Confirm the language, history, settings, selected user, and any active session survive.
- Deny camera/library access and verify the app offers its preset-photo path. Check keyboard and modal behavior on both actual OS versions.

Reactions are in-app messages. This version does not deliver operating-system push notifications while the app is closed.

## Official references (checked 2026-11-08)

- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)
- [Build-service environment configuration](https://docs.expo.dev/eas/environment-variables/manage/)
- [Android APK and iOS ad hoc installation](https://docs.expo.dev/build/internal-distribution/)
- [TestFlight distribution and expiration](https://docs.expo.dev/submit/testflight/)
- [Supabase anonymous identities](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Private Realtime authorization](https://supabase.com/docs/guides/realtime/authorization)
- [Apple Personal Team and seven-day provisioning limits](https://developer.apple.com/help/account/basics/about-your-developer-account)
- [Expo CLI local iOS builds and device signing](https://docs.expo.dev/more/expo-cli/)
- [Expo Go SDK compatibility on physical iPhones](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/)

## API and migration tooling

The two `.env` variables authenticate the app's public SDK/API client. They cover sign-in, RLS-authorized data operations, pairing RPCs, Realtime, and private photo access. The live verification scripts use those variables directly and do not print their values.

Creating schemas or changing project auth configuration requires a separate administrative mechanism: an authenticated Supabase CLI, database connection credentials, or a Management API personal access token. A service-role/secret project key also is not a replacement for a Management API token. Administrative credentials must stay outside `EXPO_PUBLIC_*` variables and mobile bundles.

The initial setup used the existing signed-in dashboard because no administrative CLI/database credential was configured. Future migrations can use authenticated CLI/Management API automation. When adopting the CLI for this existing project, first baseline the initial migration as already applied; do not blindly run it again.

- [Supabase API key permissions](https://supabase.com/docs/guides/getting-started/api-keys)
- [Management API personal access tokens](https://supabase.com/docs/guides/platform/personal-access-tokens)


### Set-completion alerts (2026-11-08 update)

Rebuild/reinstall the native app after this update; it adds `expo-notifications` and its config plugin. Under **Partner → Set notifications**, choose **Enable phone alerts** and grant the OS permission. In-app alerts remain available if permission is denied. Android uses the **Completed sets** notification channel. Phone alerts require receipt of a live partner update; push delivery while the app is closed is not implemented. Validate permissions and delivery on both physical phones.
