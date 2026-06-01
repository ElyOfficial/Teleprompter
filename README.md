# Teleprompter (personal)

A simple iPhone teleprompter for your own scripts — no subscriptions, ads, or App Store cruft.

## Requirements

- **Xcode 15+** from the Mac App Store (Command Line Tools alone cannot build iOS apps)
- iPhone on iOS 17+ (or run in Simulator)

## Best quality — native app (recommended)

Open `Teleprompter.xcodeproj` in **Xcode**, run on your iPhone. Uses **AVFoundation** for maximum camera quality (720p / 1080p / 4K, 24–60 fps).

Full guide: **[NATIVE-INSTALL.md](NATIVE-INSTALL.md)** (direct install or **TestFlight** — no App Store required).

## Web app (quick, lower camera quality)

**https://elyofficial.github.io/Teleprompter/** in Safari → Add to Home Screen.  
See [INSTALL-IPHONE.md](INSTALL-IPHONE.md).

## Open in Xcode

1. Open `Teleprompter.xcodeproj` in Xcode.
2. Select your iPhone or a Simulator.
3. Set **Signing & Capabilities** → Team to your Apple ID (free account works for personal device installs).
4. Press **Run** (⌘R).

## Features

| Tab | What it does |
|-----|----------------|
| **Scripts** | Create, edit, search, and open scripts |
| **Timer** | Full-screen visual countdown / stopwatch for takes |
| **Settings** | Font size, scroll speed, colors, mirror mode, countdown |

### Teleprompter player

- Tap **Play** on a script to open full-screen scroll.
- **Tap** center: play / pause  
- **Swipe** up/down while paused: nudge position  
- **Mirror** (Settings): flips text for glass / beam-splitter prompters  
- Screen stays awake while scrolling

## Your reference media

- Screenshots: `.cursor/projects/.../assets/IMG_*.png`
- Screen recording: `~/Downloads/ScreenRecording_06-01-2026 09-41-39_1.MP4`

## Later ideas (not built yet)

- Camera recordings while reading
- Folders for scripts
- Voice-activated scroll
- iCloud sync
