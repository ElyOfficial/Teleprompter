# Get Teleprompter on your iPhone (no App Store)

You have **two options**. The web app is ready now; the native app needs Xcode later.

---

## Option A — Home Screen app (recommended, ~2 minutes)

This installs like an app from Safari. No Xcode, no AltStore.

### 1. Open this link on your iPhone

**https://elyofficial.github.io/Teleprompter/**

(Deployed automatically from the `web/` folder in this repo.)

### 2. On your iPhone

1. Open the link in **Safari** (not Chrome).
2. Tap the **Share** button (square with arrow).
3. Tap **Add to Home Screen**.
4. Tap **Add**.

Open **Teleprompter** from your home screen. It runs full screen, offline-capable, with scripts + scroll + timer + settings.

### Tips

- Rotate to landscape for recording.
- **Settings → Mirror** for glass teleprompters.
- Scripts are stored on your phone in Safari storage (not synced unless you export).

---

## Option B — Native Swift app (later)

Requires **Xcode** on your Mac (~12 GB download).

1. Install Xcode from the App Store.
2. Open `Teleprompter.xcodeproj`.
3. Connect iPhone → select it as run destination → set **Signing** team → **Run**.

Free Apple ID installs expire after ~7 days unless you refresh from Xcode or pay for a developer account.

---

## Option C — Sideload IPA (advanced)

Only worth it if you refuse Safari and won’t install Xcode. Tools like **AltStore** or **Sideloadly** still require building a signed IPA on a Mac with Xcode first.

We can set that up after Xcode is installed.
