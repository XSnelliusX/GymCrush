# GymCrush implementation and verification — 2026-11-08

## Standalone iPhone installation — 2026-11-10

- Root cause of Abby's black screen: the shared Xcode Run scheme used Debug, which skips JavaScript bundling and asks Metro for a script URL. Her log showed the unreachable Mac address followed by `No script URL provided`.
- Changed the shared Run scheme to Release, added `npm run ios:release` (`expo run:ios --device --configuration Release --no-bundler`), and corrected the installation guide's default Debug commands. A configuration assertion failed before the change and passed afterward. CLI development commands retain their explicit Debug default.
- Fresh verification: TypeScript passed and all 34 app tests passed. Both unsigned and signed physical-device Release builds succeeded using Xcode. The signed app contains `main.jsbundle` (5,191,901 bytes), with both configured public Supabase values embedded; values were not printed.
- Installed over `tw.gymcrush.app` on Abby's connected iPhone 15 Pro using the existing signing team, without uninstalling or clearing data. `devicectl` reported successful installation and launch. The startup log recorded `evaluateJavaScript() with JS bundle`, with no packager timeout or missing-script-URL error.
- The reused provisioning profile expires 2026-11-15 at 02:47:49 UTC / 10:47:49 Asia/Taipei. Reinstalling does not necessarily issue a new seven-day profile.
- Markus confirmed the installed app opens normally, including in airplane mode. Native workout logging/persistence and full two-phone acceptance were not exercised in this install-fix session.

The sections below record the earlier 2026-11-08 verification state.

## Current state

The private Supabase schema and anonymous device sign-in are applied with user approval. **Eight direct backend API checks and eight app-level live integration checks passed. Two-physical-phone acceptance is still outstanding.** No app-store submission or signed-device build was performed.

The configured Supabase project responded to a read-only auth-settings request. Anonymous sign-in was initially disabled and has now been enabled. Both configured public environment values are now present in the compiled web, Android, and iOS bundles; the actual values were not printed in verification output.

## Corrections made

- **Duplicate notifications:** the compact header is the sole notification presenter. The Partner view no longer mounts another banner. Reactions expire in shared state and dismissal clears that state, preventing replay after a remount. Transport envelopes are deduplicated, and historical catch-up does not replay old cheers.
- **Cloud setup:** replaced the single public broadcast room with authenticated two-member pairing, a private Realtime channel, RLS-protected durable events, an idempotent append function, and a persistent outbound retry queue. Incoming catch-up runs independently of failed uploads. Device presence remains tied to the phone even while entering sets for the other partner. Live testing exposed Supabase’s client-presence rate limit: tracking is now throttled to once per 15 seconds, closed channels recover, and the latest status is resent on reconnect. Status sequence numbers reject delayed updates that could otherwise restart a cancelled rest timer.
- **Machine photos:** selected photos are compressed and retained in app storage; paired cloud records use a private Storage path resolved to an expiring signed URL. A phone-local file path is no longer the shared record. Camera/library denial still offers presets. Native photo capture/upload remains untested on hardware.
- **Workout lifecycle:** session-specific workout IDs, per-person set numbering, current-session exercise rows, a genuinely empty-start option, and removal of the final exercise. Session state and selected user survive restart.
- **Settings persistence:** store actions read current state at invocation, fixing the two-partner editor overwriting the first save. Removed stale catalog overrides that could hide later synced values. Profile changes preserve equipment/history and convert stored working weights/PRs when switching units.
- **Rest:** deadline-based countdowns catch up after suspension; rest changes are shared; redundant rest-start calls were removed. The plate-change direction follows the next selected lifter.
- **Progress:** counts completed training days per participant, deduplicates completions, rolls over Monday-based weeks, and derives shared streaks from completion history. Historical set logs are preserved; the old fixed `w-today` IDs do not contain enough information to reconstruct previously unrecorded workout boundaries.
- **Input and labels:** rejects incomplete/invalid set values, validates incoming event shapes, uses actual weight units, exposes both names consistently in machine editors, includes Full Body filtering, and hides simulated partner actions from release builds.
- **Build setup:** added EAS preview/production profiles and installation documentation, incorporated the separately completed Expo SDK 58 / React Native 0.88 upgrade, migrated file-system imports to the supported legacy entrypoint, removed the obsolete Xcode patch through that upgrade, and made the unauthenticated development relay explicitly opt-in in Metro.

## Verified locally

| Check | Result and scope |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 21 tests passed, zero failures; includes store behavior and simulated transport/queue cases |
| `npx expo-doctor` | 20/20 checks passed on SDK 58; old version exclusions were removed by the dependency upgrade |
| `npx expo export --platform all` | Web bundle and Android/iOS Hermes bundles compiled successfully |
| Direct live backend API tests | 8 passed: auth, pairing, duplicate inserts, Realtime, storage and RLS access isolation |
| Real app store/sync modules against Supabase | 8 passed: presence, machine/settings delivery, one-copy sets/cheers, rest cancellation, offline restart/retry and shared completion; native adapters simulated |
| Environment inlining | Supabase URL and publishable key found in all three bundles, values not logged |
| Browser at 390×844 | Onboarding, workout creation/logging/finish, rest Skip, history, weekly progress, kg→lbs conversion, safe settings, English/Traditional Chinese, exercise selection, and invalid-input feedback exercised |
| Notification navigation | Observed one PR banner in Partner immediately after logging a PR, then no replay after expiration/navigation |
| Two-person machine editor | Entered separate values for both partners, saved, reloaded, and observed the updated working setting |
| SDK 58 browser recheck | Upgraded app starts and the Partner/pairing/history screen renders with preserved local state |
| Session restoration | Active clock, history and settings survived reload |

Fresh release outputs are in `/tmp/gymcrush-release-check`; export log: `/tmp/gymcrush-final-export.log`. These are JavaScript/Hermes exports, **not** signed APK/IPA installers. Browser checks used synthetic local test data, not either phone's real workout history.

Two Gemini 3.8 Flash high-effort source reviews supported the review. Findings were checked against the app, tests, installed SDK source and official documentation. Suggestions contradicted by the installed SDK (such as requiring a separate token-refresh listener) were not applied blindly.

## Remaining checks and limits

1. The initial migration and anonymous sign-in are applied. `node --env-file=.env scripts/verify-supabase.mjs` passed all eight direct checks: anonymous identities, pairing, cross-couple read isolation, durable duplicate retries, denied direct forged writes, private-channel membership enforcement, one realtime message, and private photo access. App-level live testing additionally reproduced and fixed presence-rate-limit disconnects and status ordering. `node --env-file=.env scripts/verify-app-sync.mjs` subsequently passed all eight checks.
2. Markus uses Android and Abby uses iPhone; there is no paid Apple Developer membership. `docs/INSTALL.md` now covers Android APK installation and free local Xcode Personal Team installation for Abby (seven-day renewal), plus paid distribution options. Physical installation remains unperformed.
3. Check camera/library behavior, actual background/foreground transitions, OS keyboard/modal behavior, cross-network reconnection, and native photo display on those devices. No simulator run or native device build was counted as acceptance in this review.
4. Anonymous identity has no email/password recovery UI. Keep app data installed; a lost/cleared/replaced device currently needs administrator membership reassignment. The invite code cannot evict an existing member.
5. Set completion now has in-app alerts and permission-based native local notifications when live updates are received; there is no closed-app push-notification integration. PR detection currently tracks heaviest weight, not estimated-1RM/volume records. The broader ideas in PLAN.md such as post-workout check-in photos and a dedicated PR wall are not implemented UI features.

## Dependency audit

`npm audit --omit=dev` now reports **5 moderate affected dependency nodes**, with zero low, high or critical findings. The remaining roots are glob/minimatch in the Expo tooling. The separately authorized SDK 58 upgrade reduced the earlier 20-node result; no forced incompatible parser override was used.

These remaining build-tool advisories are separate from the passing feature checks. No clean-security-audit claim is included. The final audit JSON is `/tmp/gymcrush-final-audit.json`.

- [Expo installation/distribution documentation](https://docs.expo.dev/build/internal-distribution/)
- [Supabase Realtime authorization](https://supabase.com/docs/guides/realtime/authorization)

Live test evidence: `/tmp/gymcrush-supabase-smoke.json` and `/tmp/gymcrush-app-sync-smoke.json`. Failed diagnostic runs are not counted as passes. The final successful app run used SDK 58 dependencies. Test credentials remain in memory only; no credential/session reuse file is written. Disposable test identities/couples and a sample photo remain isolated from real app couples for administrator cleanup.


## History, exercise progress, and set alerts update — 2026-11-08

- Added separate History and Progress destinations to the five-item bottom navigation, preserving Workout, Machines, and Partner.
- Completed sessions persist title, start timestamp, finish timestamp, elapsed duration, and participants alongside the existing immutable set log. Remote completion metadata is saved even when another workout is active. Start times from older timestamp-based workout IDs can be recovered; unavailable timing is labeled rather than invented.
- History filters by person and expands to show exercise names, set numbers, weights, units, and repetitions. Progress filters by person, exercise, and 30 days / 90 days / all time. Separate, zero-based bar charts show heaviest weight and most repetitions in one set for each completed session. Weights are converted to the selected person's unit, and a session breakdown includes total repetitions. Maximum weight and maximum repetitions may come from different sets, as the screen explains.
- Every newly received partner set now produces one alert, including ordinary sets. Historical events and duplicate set deliveries stay silent. Local logging also confirms every set. The existing compact header remains the sole in-app presenter.
- Added Expo native local notification support with a user-invoked permission button under Partner. Permission denial does not block logging or in-app alerts. The foreground header supplies the visible alert; native Notification Center entries use the stable set ID. **This does not add remote push when the OS suspends or closes the app.** That requires a server push sender and APNs/FCM credentials.
- Both lifters have labeled rest progress bars. The second name resolves relative to the selected lifter instead of always using the fixed partner profile. Switching lifters exchanges countdown ownership instead of relabeling the same timer. Rest duration is persisted and sent with status updates.
- New controls use at least 48-point touch targets, selection/expanded accessibility state, chart labels and textual values, and safe-area-aware navigation. The existing dark palette and icon family are preserved. This is the existing React Native UI; it does not claim to use native SwiftUI Liquid Glass or Jetpack Compose components.

Validation for this update:

- `npm run typecheck`: passed.
- `npm test`: 29 passed, zero failures. Added persistence, live/duplicate/historical alerts, rest ownership, progress aggregation/unit conversion, historical completion, and native notification permission tests.
- `npx expo export --platform all --output-dir /tmp/gymcrush-history-progress-export`: Android, iOS, and web bundles compiled. These are bundle exports, not signed device installers.
- Browser preview with isolated synthetic data at 390×844: logged ordinary sets for both lifters, observed completion banners, switched to Abby and observed Markus as the other countdown, finished and expanded history with exact saved sets and timing, reloaded, and created another workout to observe +5 kg and +2 reps. English and Traditional Chinese progress rendered. The screenshot is `docs/previews/progress-phone.jpg`.
- No physical-device notification delivery or native UI acceptance was performed. A rebuilt native app is required because `expo-notifications` was added. Enable phone alerts under Partner after installing it.

Design references consulted: [Apple tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars), [Apple charting data](https://developer.apple.com/design/human-interface-guidelines/charting-data), [Material navigation bars](https://m3.material.io/components/navigation-bar/guidelines), and [Expo notifications](https://docs.expo.dev/versions/latest/sdk/notifications/).


## History session editing and deletion — 2026-11-10

- Open a session from History to rename it, tap a saved set to use the existing weight/reps editor, or delete the entire session after confirmation. English and Taiwan Traditional Chinese labels follow the existing native UI. Deletion explicitly includes both participants' sets.
- Session deletions remove associated sets and recalculate working weights, personal records, weekly totals, and streaks. Saved deletion markers reject delayed session completions, set uploads, and renames. Changes survive reload and use the durable sync outbox.
- TypeScript and all 38 tests passed. Four new tests cover rename persistence and incoming sync, shared deletion and stale replay after reload, changes arriving before completion, and native/web confirmation behavior.
- Browser preview used isolated synthetic local data. Renamed a session, changed a historical set from 40 kg × 10 to 42.5 kg × 11, and verified both after reload. Preview: `/private/tmp/gymcrush-history-session-edit.png`.
- iOS, Android, and web bundle exports compiled. No physical-device build, installation, or two-phone acceptance was performed for this change.
- **Deployment requirement:** apply `supabase/migrations/202611100001_session_edits.sql` to permit the new `SESSION_CHANGED` event before using partner sync for history changes. The migration is prepared locally and has not been applied to the live backend in this task. Both phones need the updated app.
