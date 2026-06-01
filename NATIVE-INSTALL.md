# Native app — best camera quality

The **native iOS app** in this repo uses **AVFoundation** directly. That is the highest quality path — better than the Safari web version.

You do **not** need the App Store. You can install on your own phone or use **TestFlight**.

---

## Option A — Install on your iPhone (free Apple ID)

1. Install **Xcode** from the Mac App Store.
2. Open `Teleprompter.xcodeproj`.
3. Connect your iPhone → trust the computer.
4. Select your iPhone as the run destination.
5. **Signing & Capabilities** → Team → your Apple ID.
6. Press **Run** (⌘R).

The app installs on your home screen. With a free account, you may need to re-run from Xcode about every 7 days.

### Camera settings in the app

- Tap **▶** on a script → native camera recorder opens.
- Tap **⚙** on the record screen for:
  - **720p / 1080p / 4K** (uses the best format your camera supports)
  - **24 / 30 / 60 fps**
  - Text, colors, scroll speed (same as reference apps)

Videos save to **Photos** when you stop recording.

---

## Option B — TestFlight (for you + testers)

Requires **Apple Developer Program** — **$99/year** at [developer.apple.com](https://developer.apple.com).

1. Enroll in the Developer Program with your Apple ID.
2. In Xcode: **Product → Archive** (select **Any iOS Device** first).
3. **Window → Organizer** → **Distribute App** → **TestFlight & App Store** → upload.
4. Open [App Store Connect](https://appstoreconnect.apple.com) → your app → **TestFlight**.
5. Add yourself as an internal tester (instant) or external testers (short beta review).

TestFlight builds use the **same native camera code** — full quality, no App Store listing required for personal use.

You can keep the app **unlisted** on the App Store and only use TestFlight.

---

## What quality to expect

| Setting | Notes |
|--------|--------|
| **1080p · 30 fps** | Reliable default on most iPhones |
| **4K** | Often works on **rear** camera; front camera may cap at 1080p (hardware limit) |
| **60 fps** | Smoother motion; larger files; not all formats support it |

The record screen shows the **actual** resolution (e.g. `1920×1080 · 30 fps`).

---

## Web app vs native

| | Safari PWA | Native app |
|--|------------|------------|
| Camera API | Browser | AVFoundation |
| Max quality | Good | **Best** |
| TestFlight | No | Yes |
| App Store required | No | No |

Use the **native app** for recording. The web version is fine for quick tests without Xcode.
