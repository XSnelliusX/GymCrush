# GymCrush design system & redesign spec (Nov 2026)

GymCrush is a two-person gym tracker. Markus uses an Android phone and Abby uses an iPhone. It runs **only on phones** (no web, no tablet). Grounding: Apple HIG (iOS 26+ Liquid Glass, tab bars, sheets, Dynamic Type) and Material 3 (48dp targets, edge-to-edge, predictive back, ripple).

## Thesis
*The app takes the color of whoever is lifting.* Each partner owns a hue: Markus is blue, the partner (Abby) is orange. That hue shows who a set, a ring, a button or a status belongs to. When "Logging as" switches to Abby, the Complete-set button, tab tint and set checks turn orange, so a set can't silently go to the wrong partner. The couple's shared weekly streak is the one place both hues meet: two concentric **DuoRings**. Everything else stays neutral and quiet.

## Color: `useTheme().colors` (src/theme/theme.ts)
| Token | Meaning | Rule |
|---|---|---|
| `bg` | screen background | |
| `surface` | cards, list sections | content layer; never glass |
| `surfaceRaised` | floating surfaces (rest panel, banners, mini bar), selected segment | |
| `fill` | input wells, stepper buttons, inactive chips/segments, ring tracks | |
| `separator` | hairlines | |
| `text` / `textSecondary` / `textTertiary` | text, all ≥5.0:1 on surface | never other greys |
| `partners[pid].color / onColor / subtle` | **identity**: whose thing it is; primary action tint for the active user | `onColor` is text on a `color` fill; `subtle` is a tinted background |
| `gold` / `goldSubtle` | personal record only | always with crown icon + "PR" text |
| `success` / `successSubtle` | completed set, online, synced | |
| `danger` / `dangerSubtle` | destructive actions, errors | |

The primary action on any screen is a **filled Button tinted with the active user's partner colors**: `tint={colors.partners[store.activeUser]}`. Use at most one filled button per view. Use no gradients, no hard-coded hex values in screens, and no glass on content.

## Type: `useTheme().type` / `<AppText variant>`
largeTitle 34 · title1 28 · title2 22 · title3 20 · headline 17 semibold · body 17 · callout 16 · subhead 15 · footnote 13 · caption 12 (the minimum).
Numerals use `display` 56, `timer` 34, `metric` 28 and `number` 17. They are tabular and use SF Pro Rounded on iOS, giving a "scoreboard" feel. Use them for every weight, rep count, timer and streak.
Text must scale with system font size (default RN behavior; `AppText` caps at 2×). Layouts must not clip at large sizes: use `flexWrap` and `numberOfLines` only where truncation is acceptable.
Copy uses sentence case on both platforms ("Start workout", "Add exercise"). Write it bilingual with `const c = useCopy(); c('English', '繁體中文')`. Existing keys in `src/i18n/translations.ts` (`t(language)`, `MUSCLE_LABELS`, `SPLIT_LABELS`) may be reused, and existing translation keys must not be deleted (tests use them).

## Spacing, shape and touch
Use `space` (2/4/8/12/16/20/24/32), screen gutter `16`, and `radius` (card 20, sheet 28, pill for buttons/chips/segments). Targets are a minimum of 44pt iOS / 48dp Android (`touch.min`), and gym-floor controls (set complete, steppers, rest controls) use `touch.large` = 56. Hands are sweaty and the phone sits on a bench, so the important workout controls belong in the lower half of the screen.

## Primitives: `src/ui/primitives.tsx` (use these; do not restyle them per screen)
`AppText`, `Icon` (always `{ ios: SF Symbol, android: Material Symbol }`), `Button` (filled/tinted/plain/destructive · small/regular/large · `tint`), `IconButton` (icon-only, **requires `label`**), `Card` (optionally pressable), `ListSection` + `ListRow` (iOS inset-grouped, Material list on a card), `SegmentedControl`, `Chip`, `Avatar` (partner initial in partner color, optional online dot), `EmptyState`, `SheetHeader` (title + close + optional action, for sheets), `TextField` (labeled input with error), `ScreenScroll` (tab screens: large-title-aware scroll), `haptics`.
Also `src/ui/DuoRings.tsx` and `src/ui/navigation.ts` (`sheetOptions`, `useTabStackOptions`).
Press feedback is opacity on iOS and ripple on Android (built in). Icon fallback: `@expo/vector-icons` is legacy, so do not use it in redesigned code.

## Navigation (expo-router, all routes already stubbed)
```
(tabs)  NativeTabs (UITabBar with Liquid Glass) on iOS; src/components/FloatingTabBar.tsx on Android, mirroring the iOS floating bar; tinted with active user's color
  today/index            Today dashboard
  machines/index, [id]   Machine grid → machine detail (push)
  history/index, [workoutId]  Workouts | Progress → workout detail (push)
  couple/index           Partner, pairing, profiles & goals, notifications, language
workout                  Active workout (iOS page sheet: swipe down = minimize; Android: full screen, back = minimize)
partner-workout          Read-only view of the other person's live workout
workout-summary          Shown after Finish
new-machine, profile, routine   Page-sheet modals (Android: full-screen slide-up)
add-exercise, machine-settings/[id], edit-set/[id], cheer   Form sheets (bottom sheets) — render <SheetHeader>, no native header
onboarding               First run (full screen)
```
- Each tab root screen is wrapped in `<TabScreen>` (src/components/TabScreen.tsx) and scrolls with `<ScreenScroll>`. Set the title with `<Stack.Screen options={{ title }} />` inside the screen. iOS shows a large title over a transparent Liquid Glass header. Header actions go through `headerRight` using `IconButton`, with at most two.
- While a session is active, a **mini workout bar** appears automatically: in the tab bar's bottom accessory on iOS 26+, and floating above the tab bar elsewhere. Tapping it reopens `/workout`. Screens leave 120pt of bottom padding (ScreenScroll already does).
- **Form-sheet layout rule (react-native-screens, iOS 26+):** a sheet that scrolls must render exactly `<><View collapsable={false}>{header…}</View><ScrollView>…</ScrollView></>` — a fragment root, the header as one non-collapsable view, then one ScrollView. Any other shape (a wrapping View, a footer after the ScrollView, the header inside the ScrollView, a FlatList) renders blank or overlapped on first open. Sheets without a ScrollView can be laid out freely. Code inside the iOS tab accessory (`WorkoutMiniBar`) must use the global `router` from expo-router, not `useRouter()`.
- Navigation: `useRouter()` → `router.push('/machines/' + id)`, `router.push({ pathname: '/machine-settings/[id]', params: { id } })`, and `router.back()` to dismiss a sheet or modal.
- Incoming cheers and PR alerts are presented **only** by `<ReactionBanner>` in the root layout. Do not build another presenter.
- Glass (`expo-glass-effect` GlassView) is allowed only on the floating rest-timer panel in the workout screen (iOS 26+, guarded by `isLiquidGlassAvailable()`, with a `surfaceRaised` fallback). It goes nowhere else.

## State
`useGymCrushStore()` (src/store/useGymCrushStore.ts) is a global store: every route can call it. **Do not change store behavior.** You may add a small pure selector or helper in your own files. If an action you need is missing, stop and report it instead of editing the store. `syncEngine.cloud` (src/services/syncEngine.ts) exposes pairing status (see the old PairingPanel). PartnerId values are `'markus' | 'partner'`; display names come from `store.profiles[pid].name`.

## Interaction rules
- Destructive actions (delete machine, delete routine, remove a set or exercise) get `Alert.alert` with a Cancel option and a destructive-style button. Finishing a workout gets a confirmation alert.
- Feedback stays in the UI: no success alerts. Use haptics: `selection` for pickers and steppers, `impact('medium')` for completing a set, `success` for PRs and finishing.
- Every icon-only control has an `accessibilityLabel`, and stateful controls set `accessibilityState`. Don't convey anything by color alone: a partner hue always comes with a name or initial, and PR always shows the crown and the "PR" text.
- Motion: RN `Animated` with native driver, brief and interruptible. Check `AccessibilityInfo.isReduceMotionEnabled()` before any non-essential animation. No reanimated.
- Empty states always offer the next action.
- Numbers come from the store's unit (`profiles[pid].unit`), so never hard-code "kg".

## Done means
`npx tsc --noEmit` shows no errors in your files. Old components you replace are not imported by your routes (the orchestrator deletes them). `npm test` still passes.
