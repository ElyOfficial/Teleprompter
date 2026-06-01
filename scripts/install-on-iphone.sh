#!/bin/bash
# Run after Xcode is installed from the Mac App Store.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="$ROOT/Teleprompter.xcodeproj"
SCHEME="Teleprompter"

if [[ ! -d /Applications/Xcode.app ]]; then
  echo "Xcode is not installed yet."
  echo "Opening the Mac App Store → Xcode page…"
  open "macappstore://apps.apple.com/app/xcode/id497799835"
  echo ""
  echo "Install Xcode, open it once to accept the license, then run this script again:"
  echo "  $0"
  exit 1
fi

sudo xcode-select -s /Applications/Xcode.app/Contents/Developer 2>/dev/null || true
xcodebuild -version

echo ""
echo "Opening the project in Xcode…"
open "$PROJECT"
echo ""
echo "In Xcode:"
echo "  1. Connect your iPhone with USB (or Wi‑Fi debugging after pairing)."
echo "  2. Select your iPhone in the toolbar device menu."
echo "  3. Teleprompter target → Signing & Capabilities → Team → your Apple ID."
echo "  4. Press Run (⌘R)."
echo ""
echo "On first install: iPhone → Settings → General → VPN & Device Management → trust your developer app."
echo ""
echo "For TestFlight: Product → Archive → Distribute → TestFlight (requires \$99/yr developer account)."
