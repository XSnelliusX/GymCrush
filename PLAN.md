# GymCrush — Shared Couple's Gym Tracker Plan

## 1. Tech Stack & Architecture
- **Mobile App (Android & iOS):** Expo (React Native + TypeScript) with Expo Router
- **Camera & Media:** `expo-image-picker` & `expo-image-manipulator` (compress machine photos before upload)
- **Backend & Real-Time Sync:** Supabase (Auth, Postgres, Realtime Broadcast/Postgres Changes, Storage buckets for machine & check-in photos)
- **Local / Offline Persistence:** `expo-sqlite` / `AsyncStorage` for instant gym-floor responsiveness

---

## 2. Core & Couple Features (v1 Scope)

### A. Visual Machine Catalog (Snap & Select)
- **First-Time Machine Setup:** Snap a photo of the exact machine at your gym using the camera, tag its muscle group (e.g., Chest, Back, Glutes, Legs), and name it.
- **Shared Visual Picker:** Next time either of you is at the gym, browse your shared visual grid of machine photos to pick the exact machine immediately—no guessing ambiguous exercise names.
- **Per-Partner Machine Settings:** Save individual seat height, back pad, or pin position notes right on the machine card (e.g., *Markus: Seat 5, Pad 3* | *Partner: Seat 2, Pad 1*).

### B. Real-Time Live Buddy Sessions
- **Joint Active Workout:** Start or join an active session together; both phones sync live via Supabase Realtime.
- **Live Status Bar:** Always see which machine, set number, and rest countdown your partner is on.

### C. Shared Machine / Barbell Mode
- **1-Tap Partner Toggle:** When alternating sets on the same machine or barbell, tap once to switch between your working weight/reps and hers, alongside seat/pin adjustment reminders.

### D. Live Hype & PR Reactions
- **Instant Banners:** Automatic PR detection (heaviest weight, highest estimated 1RM, or max volume) triggers a live alert on your partner's screen.
- **1-Tap Hype Reactions:** Send `🔥`, `💪`, `❤️`, or `👑` reactions that animate live on the other person's workout screen.

### E. Couple Streaks & Duo Feed
- **Joint Weekly Streak:** Set a personal weekly frequency target for each partner (e.g., 3x/week each). When both hit their target, the Couple Streak advances.
- **Shared Timeline:** Completed workouts, PR badges, and optional post-workout check-in photos.

---

## 3. Data Schema (Supabase Postgres)

| Table | Key Columns | Purpose |
| :--- | :--- | :--- |
| `profiles` | `id`, `display_name`, `avatar_url`, `unit_pref` (`kg`/`lbs`), `couple_id` | User settings & partner pairing |
| `couples` | `id`, `invite_code`, `weekly_goal_user_a`, `weekly_goal_user_b`, `current_streak` | Shared couple state & streak tracking |
| `machines` | `id`, `couple_id`, `name`, `muscle_group`, `photo_url`, `settings_json` | Shared visual catalog of gym machines + per-partner seat/pin notes |
| `workouts` | `id`, `couple_id`, `started_at`, `ended_at`, `is_live`, `status` | Solo or joint live workout sessions |
| `workout_sets` | `id`, `workout_id`, `user_id`, `machine_id`, `set_number`, `weight`, `reps`, `is_pr` | Real-time logged sets |
| `reactions` | `id`, `workout_id`, `set_id`, `sender_id`, `emoji`, `created_at` | Live hype reactions broadcast to active screen |

---

## 4. Implementation Phases

1. **Phase 1 — Expo Scaffold & Visual Machine Catalog:** Initialize Expo Router app, camera/photo picker for adding gym machines with photos + per-partner seat settings, and visual machine grid.
2. **Phase 2 — Active Workout & Shared Machine Swap:** Build the live workout screen, set logger, auto-rest timer, and 1-tap partner toggle for alternating sets on the same machine.
3. **Phase 3 — Real-Time Sync & Live Hype:** Connect Supabase Realtime channels for live buddy sessions, instant set updates across Android/iOS, and floating emoji reactions.
4. **Phase 4 — Couple Streak & Duo Dashboard:** Home dashboard with joint weekly streak ring, PR wall, and partner pairing flow.
